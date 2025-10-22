import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors({ origin: "*" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const sessions = {}; // { code: { question, options, votes } }

// ✅ Generate a random code
function generateCode() {
  return Math.random().toString(36).substring(2, 12);
}

io.on("connection", (socket) => {
  console.log("🟢 New user connected:", socket.id);

  // ✅ Create a new session
  socket.on("create-session", () => {
    const code = generateCode();
    sessions[code] = { question: null, options: [], votes: [] };
    socket.join(code);
    socket.emit("session-created", code);
    console.log("📦 Session created:", code);
  });

  // ✅ Join an existing session
  socket.on("join_session", (code, callback) => {
    if (!sessions[code]) {
      console.warn("❌ Invalid join attempt:", code);
      if (callback) callback({ success: false, message: "Invalid code" });
      return;
    }

    socket.join(code);
    console.log(`👥 User ${socket.id} joined ${code}`);
    if (callback) callback({ success: true });

    // If question is already live, send it immediately
    const session = sessions[code];
    if (session.question) {
      socket.emit("receive_question", {
        question: session.question,
        options: session.options,
      });
    }
  });

  // ✅ Host sends question
  socket.on("send_question", ({ code, question, options }) => {
    if (!sessions[code]) return;
    sessions[code].question = question;
    sessions[code].options = options;
    sessions[code].votes = Array(options.length).fill(0);

    console.log("📢 Question sent:", { code, question, options });
    io.to(code).emit("receive_question", { question, options });
  });

  // ✅ Participant votes
  socket.on("submit_vote", ({ code, index }) => {
    const session = sessions[code];
    if (!session) return;

    if (session.votes[index] !== undefined) {
      session.votes[index] += 1;
      io.to(code).emit("update_results", session.votes);
      console.log("🗳 Vote registered:", code, session.votes);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
