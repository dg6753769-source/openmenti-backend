import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { Api_evaluate } from "./bhavishyawani-engine/dist/src/Api.js";

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

// ---------- Bhavishyawani prediction engine ----------

// Coerces an HTTP body into the engine's UserMetricsDto. Palm fields default
// to "" (= not observed); the engine itself validates all field values.
function toEngineDto(body) {
  const errors = [];
  const birth = body.birthUtc ?? {};
  const intField = (name, fallback) => {
    const v = birth[name] ?? fallback;
    if (!Number.isInteger(v)) {
      errors.push(`birthUtc.${name}: integer required`);
      return 0;
    }
    return v;
  };
  const numField = (name) => {
    const v = body[name];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      errors.push(`${name}: number required`);
      return 0;
    }
    return v;
  };
  const str = (v) => (v == null ? "" : String(v));
  const dto = {
    birthUtc: {
      year: intField("year"),
      month: intField("month"),
      day: intField("day"),
      hourUtc: intField("hourUtc", 0),
      minuteUtc: intField("minuteUtc", 0),
      secondUtc: intField("secondUtc", 0),
    },
    latitude: numField("latitude"),
    longitude: numField("longitude"),
    heartLine: str(body.heartLine),
    headLine: str(body.headLine),
    lifeLine: str(body.lifeLine),
    fateLine: str(body.fateLine),
    jupiterMount: str(body.jupiterMount),
    saturnMount: str(body.saturnMount),
    sunMount: str(body.sunMount),
    mercuryMount: str(body.mercuryMount),
    signs: Array.isArray(body.signs)
      ? body.signs.map((s) => ({ marking: str(s?.marking), location: str(s?.location) }))
      : [],
  };
  return { dto, errors };
}

app.post("/api/bhavishyawani", (req, res) => {
  const { dto, errors } = toEngineDto(req.body ?? {});
  if (errors.length > 0) {
    return res.status(400).json({ status: "InvalidInput", events: [], reasons: errors });
  }
  const reading = Api_evaluate(dto);
  res.status(reading.status === "InvalidInput" ? 400 : 200).json(reading);
});

// Browser-friendly smoke test with a reference chart (New Delhi, 1990).
app.get("/api/bhavishyawani/demo", (req, res) => {
  const reading = Api_evaluate({
    birthUtc: { year: 1990, month: 3, day: 14, hourUtc: 2, minuteUtc: 30, secondUtc: 0 },
    latitude: 28.6139,
    longitude: 77.209,
    heartLine: "Chained",
    headLine: "",
    lifeLine: "Broken",
    fateLine: "Deep",
    jupiterMount: "High",
    saturnMount: "",
    sunMount: "",
    mercuryMount: "",
    signs: [{ marking: "Fish", location: "Jupiter" }],
  });
  res.json(reading);
});

app.get("/", (req, res) => res.send("✅ OpenMenti backend with live questions running!"));

server.listen(4000, () => console.log("🚀 Server running on port 4000"));
