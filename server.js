import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { errorHandler } from "./src/middleware/errorHandler.js";
import authRoutes from "./src/routes/auth.routes.js";
import artistRoutes from "./src/routes/artist.routes.js";
import musicRoutes from "./src/routes/music.routes.js";
import commerceRoutes from "./src/routes/commerce.routes.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import analyticsRoutes from "./src/routes/analytics.routes.js";
import fanRoutes from "./src/routes/fan.routes.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || "*", methods: ["GET", "POST"] },
});

// Make io accessible to route handlers (used in payment webhook)
app.set("io", io);

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));

// Webhook route needs raw body for HMAC verification — must be before express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json" }), (req, res, next) => {
  req.body = JSON.parse(req.body.toString());
  next();
});

app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/artists", artistRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/commerce", commerceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/fan", fanRoutes);

app.get("/health", (req, res) => res.json({ status: "ok", platform: "OpenMenti Music" }));

app.use(errorHandler);

// WebSocket: artists join a private room to receive real-time payment notifications
io.on("connection", (socket) => {
  socket.on("join_artist_room", (artistId) => {
    socket.join(`artist:${artistId}`);
  });

  socket.on("join_fan_room", (fanId) => {
    socket.join(`fan:${fanId}`);
  });

  socket.on("disconnect", () => {});
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`OpenMenti Music Platform running on port ${PORT}`);
});
