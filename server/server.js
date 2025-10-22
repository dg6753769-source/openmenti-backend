import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);

// In production you can restrict 'origin' to your Vercel domain.
// For now keep "*" so local dev + deployed frontend both work.
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const sessions = {}; // { CODE: { question, options, votes: number[] } }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-session", () => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    sessions[code] = { question: "", options: [], votes: [] };
    socket.join(code);
    socket.emit("session-created", code);
  });

  socket.on("join_session", ({ code }) => {
    if (sessions[code]) socket.join(code);
  });

  socket.on("send_question", ({ code, question, options }) => {
    if (!sessions[code]) return;
    sessions[code].question = question;
    sessions[code].options = options;
    sessions[code].votes = new Array(options.length).fill(0);
    io.to(code).emit("new_question", { code, question, options });
    io.to(code).emit("update_results", sessions[code].votes);
  });

  socket.on("send_vote", ({ code, index }) => {
    if (!sessions[code]) return;
    if (index >= 0 && index < sessions[code].options.length) {
      sessions[code].votes[index] = (sessions[code].votes[index] || 0) + 1;
      io.to(code).emit("update_results", sessions[code].votes);
    }
  });
});

app.get("/", (_, res) => res.send("✅ OpenMenti backend running"));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
