import { Router } from "express";
import supabase from "../config/supabase.js";
import { authenticate } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

const router = Router();

// GET /api/fan/following — artists the fan follows
router.get("/following", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("fan_follows")
    .select("artist_profiles(id, bio, genre, users(name, avatar_url))")
    .eq("fan_id", req.user.id);

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data.map((f) => f.artist_profiles));
});

// POST /api/fan/follow/:artistId — follow an artist
router.post("/follow/:artistId", authenticate, async (req, res) => {
  const { error } = await supabase
    .from("fan_follows")
    .upsert({ fan_id: req.user.id, artist_id: req.params.artistId }, { onConflict: "fan_id,artist_id" });

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, { following: true });
});

// DELETE /api/fan/follow/:artistId — unfollow
router.delete("/follow/:artistId", authenticate, async (req, res) => {
  await supabase
    .from("fan_follows")
    .delete()
    .eq("fan_id", req.user.id)
    .eq("artist_id", req.params.artistId);

  return sendSuccess(res, { following: false });
});

// GET /api/fan/memberships — all active living room memberships
router.get("/memberships", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("fan_memberships")
    .select("id, tier, status, current_period_end, artist_profiles(id, users(name, avatar_url))")
    .eq("fan_id", req.user.id)
    .eq("status", "active");

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data);
});

// GET /api/fan/tips — fan's tipping history
router.get("/tips", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, amount_paise, created_at, artist_profiles(users(name))")
    .eq("fan_id", req.user.id)
    .eq("type", "tip")
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data);
});

export default router;
