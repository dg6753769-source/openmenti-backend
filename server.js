import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

const sessions = {};

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // host creates a session
  socket.on("create_session", (code) => {
    sessions[code] = { hostId: socket.id, question: null, responses: [] };
    socket.join(code);
    console.log("📡 Session created:", code);
  });

  // participant joins
  socket.on("join_session", (code) => {
    if (sessions[code]) {
      socket.join(code);
      io.to(sessions[code].hostId).emit("participant_joined", socket.id);
      console.log("👥 Participant joined:", code);
    }
  });

  // host sends question
  socket.on("send_question", ({ code, question, options }) => {
    if (sessions[code]) {
      sessions[code].question = { question, options, votes: Array(options.length).fill(0) };
      io.to(code).emit("new_question", sessions[code].question);
      console.log("❓ Question sent:", question);
    }
  });

  // participant submits answer
  socket.on("submit_answer", ({ code, optionIndex }) => {
    if (sessions[code]) {
      sessions[code].question.votes[optionIndex]++;
      io.to(code).emit("update_results", sessions[code].question.votes);
    }
  });

  socket.on("disconnect", () => console.log("🚪 Disconnected:", socket.id));
});

app.get("/", (req, res) => res.send("✅ OpenMenti backend with live questions running!"));

server.listen(4000, () => console.log("🚀 Server running on port 4000"));
