import "dotenv/config";
import { validateEnv } from "./src/config/validateEnv.js";
validateEnv(); // Fail fast if any required env var is missing

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { errorHandler } from "./src/middleware/errorHandler.js";
import { globalLimiter } from "./src/middleware/rateLimiter.js";
import authRoutes from "./src/routes/auth.routes.js";
import artistRoutes from "./src/routes/artist.routes.js";
import musicRoutes from "./src/routes/music.routes.js";
import commerceRoutes from "./src/routes/commerce.routes.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import analyticsRoutes from "./src/routes/analytics.routes.js";
import fanRoutes from "./src/routes/fan.routes.js";

const app = express();
const httpServer = createServer(app);

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ["http://localhost:5173", "http://localhost:3000"];

const corsOptions = {
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, mobile apps in dev)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});

app.set("io", io);
app.use(cors(corsOptions));
app.use(globalLimiter);

// Webhook: preserve raw body string for HMAC verification before JSON parse
app.use("/api/payments/webhook", express.raw({ type: "application/json" }), (req, res, next) => {
  req.rawBody = req.body.toString("utf8");
  req.body = JSON.parse(req.rawBody);
  next();
});

app.use(express.json({ limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/artists", artistRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/commerce", commerceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/fan", fanRoutes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", platform: "OpenMenti Music", env: process.env.NODE_ENV })
);

app.use(errorHandler);

io.on("connection", (socket) => {
  socket.on("join_artist_room", (artistId) => socket.join(`artist:${artistId}`));
  socket.on("join_fan_room", (fanId) => socket.join(`fan:${fanId}`));
  socket.on("disconnect", () => {});
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`OpenMenti Music Platform running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});
