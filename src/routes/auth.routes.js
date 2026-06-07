import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import supabase from "../config/supabase.js";
import { authenticate } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

const router = Router();

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password, name, role = "fan" } = req.body;
  if (!email || !password || !name) {
    return sendError(res, 400, "email, password, and name are required");
  }
  if (!["fan", "artist"].includes(role)) {
    return sendError(res, 400, "role must be fan or artist");
  }

  const hash = await bcrypt.hash(password, 12);
  const { data: user, error } = await supabase
    .from("users")
    .insert({ email, password_hash: hash, name, role })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return sendError(res, 409, "Email already registered");
    return sendError(res, 500, error.message);
  }

  // If registering as artist, create artist profile
  if (role === "artist") {
    await supabase.from("artist_profiles").insert({ user_id: user.id });
  }

  return sendSuccess(res, { token: signToken(user), user: { id: user.id, name, email, role } }, 201);
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return sendError(res, 400, "email and password are required");

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !user) return sendError(res, 401, "Invalid credentials");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return sendError(res, 401, "Invalid credentials");

  return sendSuccess(res, { token: signToken(user), user: { id: user.id, name: user.name, email, role: user.role } });
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  const { data: user, error } = await supabase
    .from("users")
    .select("id, name, email, role, avatar_url, created_at")
    .eq("id", req.user.id)
    .single();

  if (error) return sendError(res, 404, "User not found");
  return sendSuccess(res, user);
});

export default router;
