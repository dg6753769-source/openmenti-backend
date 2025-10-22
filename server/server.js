import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const sessions = {}; // store active sessions

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-session", () => {
    const code = Math.random().toString(36).substring(2, 7).toUpperCase();
    sessions[code] = { question: "", options: [], votes: [] };
    socket.emit("session-created", code);
  });

  socket.on("send_question", ({ code, question, options }) => {
    if (!sessions[code]) return;
    sessions[code].question = question;
    sessions[code].options = options;
    sessions[code].votes = new Array(options.length).fill(0);
    io.emit("new_question", { code, question, options });
  });

  socket.on("send_vote", ({ code, index }) => {
    if (!sessions[code]) return;
    sessions[code].votes[index]++;
    io.emit("update_results", sessions[code].votes);
  });
});

app.get("/", (req, res) => res.send("✅ OpenMenti backend running"));

server.listen(3000, () => console.log("🚀 Backend running on http://localhost:3000"));
