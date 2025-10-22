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

const sessions = {}; // code -> {question, options, votes}

function generateCode() {
  return Math.random().toString(36).substring(2, 10);
}

io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  // 🟢 Host creates session
  socket.on("create-session", () => {
    const code = generateCode();
    sessions[code] = { question: null, options: [], votes: [] };
    socket.join(code);
    socket.emit("session-created", code);
    console.log("📦 Created session:", code);
  });

  // 🟢 Host sends question
  socket.on("send_question", ({ code, question, options }) => {
    if (!sessions[code]) return;
    sessions[code].question = question;
    sessions[code].options = options;
    sessions[code].votes = Array(options.length).fill(0);

    console.log(`📢 New question for ${code}:`, question);
    io.to(code).emit("receive_question", { question, options });
  });

  // 🟢 Participant joins
  socket.on("join_session", (code, callback) => {
    console.log("🔵 Join request:", code);

    if (!sessions[code]) {
      callback?.({ success: false, message: "Invalid session code" });
      console.log("❌ Invalid code:", code);
      return;
    }

    socket.join(code);
    callback?.({ success: true });
    console.log(`👥 ${socket.id} joined ${code}`);

    // If question already exists, send it immediately
    const session = sessions[code];
    if (session.question) {
      socket.emit("receive_question", {
        question: session.question,
        options: session.options,
      });
      console.log("📨 Sent existing question to new joiner");
    }
  });

  // 🟢 Participant votes
  socket.on("submit_vote", ({ code, index }) => {
    const session = sessions[code];
    if (!session) return;

    session.votes[index]++;
    io.to(code).emit("update_results", session.votes);
    console.log("🗳 Vote added for", code, "→", session.votes);
  });

  socket.on("disconnect", () =>
    console.log("❌ Disconnected:", socket.id)
  );
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
