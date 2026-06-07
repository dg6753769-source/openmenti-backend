import { Router } from "express";
import supabase from "../config/supabase.js";
import { authenticate } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

const router = Router();

// GET /api/fan/following
router.get("/following", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("fan_follows")
    .select("artist_profiles(id, bio, genre, users(name, avatar_url))")
    .eq("fan_id", req.user.id);

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data.map((f) => f.artist_profiles));
});

// POST /api/fan/follow/:artistId
router.post("/follow/:artistId", authenticate, async (req, res) => {
  const { error } = await supabase
    .from("fan_follows")
    .upsert({ fan_id: req.user.id, artist_id: req.params.artistId }, { onConflict: "fan_id,artist_id" });

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, { following: true });
});

// DELETE /api/fan/follow/:artistId
router.delete("/follow/:artistId", authenticate, async (req, res) => {
  await supabase
    .from("fan_follows")
    .delete()
    .eq("fan_id", req.user.id)
    .eq("artist_id", req.params.artistId);

  return sendSuccess(res, { following: false });
});

// GET /api/fan/memberships — active + recently expired memberships
router.get("/memberships", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("fan_memberships")
    .select("id, tier, status, current_period_end, artist_profiles(id, users(name, avatar_url))")
    .eq("fan_id", req.user.id)
    .order("current_period_end", { ascending: false });

  if (error) return sendError(res, 500, error.message);

  // Compute live is_active flag (don't rely solely on DB status column)
  const enriched = (data || []).map((m) => ({
    ...m,
    is_active: m.status === "active" && new Date(m.current_period_end) > new Date(),
  }));

  return sendSuccess(res, enriched);
});

// DELETE /api/fan/memberships/:artistId — cancel a living room membership
router.delete("/memberships/:artistId", authenticate, async (req, res) => {
  const { data: membership } = await supabase
    .from("fan_memberships")
    .select("id, status")
    .eq("fan_id", req.user.id)
    .eq("artist_id", req.params.artistId)
    .single();

  if (!membership) return sendError(res, 404, "Membership not found");
  if (membership.status === "cancelled") return sendError(res, 400, "Membership already cancelled");

  const { error } = await supabase
    .from("fan_memberships")
    .update({ status: "cancelled" })
    .eq("id", membership.id);

  if (error) return sendError(res, 500, error.message);

  // Note: access remains until current_period_end (don't revoke immediately)
  return sendSuccess(res, { cancelled: true, message: "Access continues until end of current period" });
});

// GET /api/fan/tips
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
