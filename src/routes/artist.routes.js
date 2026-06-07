import { Router } from "express";
import supabase from "../config/supabase.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

const router = Router();

// GET /api/artists — discover all artists
router.get("/", async (req, res) => {
  const { search, limit = 20, offset = 0 } = req.query;

  let query = supabase
    .from("artist_profiles")
    .select("*, users(id, name, avatar_url)")
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (search) query = query.ilike("users.name", `%${search}%`);

  const { data, error } = await query;
  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data);
});

// GET /api/artists/:id — artist public profile
router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("artist_profiles")
    .select(`
      *,
      users(id, name, avatar_url, created_at),
      tracks(id, title, cover_art_url, is_vault, price_paise, play_count, created_at)
    `)
    .eq("id", req.params.id)
    .single();

  if (error || !data) return sendError(res, 404, "Artist not found");
  return sendSuccess(res, data);
});

// GET /api/artists/by-user/:userId — get artist profile by user id
router.get("/by-user/:userId", async (req, res) => {
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("*")
    .eq("user_id", req.params.userId)
    .single();

  if (error || !data) return sendError(res, 404, "Artist profile not found");
  return sendSuccess(res, data);
});

// PATCH /api/artists/profile — update own artist profile
router.patch("/profile", authenticate, requireRole("artist"), async (req, res) => {
  const { bio, genre, living_room_price_paise, living_room_description, social_links } = req.body;

  const { data: profile } = await supabase
    .from("artist_profiles")
    .select("id")
    .eq("user_id", req.user.id)
    .single();

  if (!profile) return sendError(res, 404, "Artist profile not found");

  const { data, error } = await supabase
    .from("artist_profiles")
    .update({ bio, genre, living_room_price_paise, living_room_description, social_links })
    .eq("id", profile.id)
    .select()
    .single();

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data);
});

// POST /api/artists/link-razorpay — save Razorpay linked account id for split routing
router.post("/link-razorpay", authenticate, requireRole("artist"), async (req, res) => {
  const { razorpay_linked_account_id } = req.body;
  if (!razorpay_linked_account_id) return sendError(res, 400, "razorpay_linked_account_id required");

  const { data, error } = await supabase
    .from("artist_profiles")
    .update({ razorpay_linked_account_id })
    .eq("user_id", req.user.id)
    .select()
    .single();

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, { linked: true, account_id: data.razorpay_linked_account_id });
});

export default router;
