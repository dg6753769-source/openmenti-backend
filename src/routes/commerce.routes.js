import { Router } from "express";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import supabase from "../config/supabase.js";
import s3, { BUCKET } from "../config/storage.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { generateSignedUrl, getPublicUrl } from "../utils/signedUrl.js";
import { sendSuccess, sendError } from "../utils/response.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// GET /api/commerce/vault/:artistId — list vault tracks
router.get("/vault/:artistId", async (req, res) => {
  const { data, error } = await supabase
    .from("tracks")
    .select("id, title, description, cover_art_url, price_paise, duration_seconds, play_count, created_at")
    .eq("artist_id", req.params.artistId)
    .eq("is_vault", true)
    .order("created_at", { ascending: false });

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data);
});

// GET /api/commerce/vault/:artistId/:trackId/access — check fan access
router.get("/vault/:artistId/:trackId/access", authenticate, async (req, res) => {
  const { data } = await supabase
    .from("vault_access")
    .select("id, granted_at, expires_at")
    .eq("fan_id", req.user.id)
    .eq("track_id", req.params.trackId)
    .single();

  const hasAccess = data && (!data.expires_at || new Date(data.expires_at) > new Date());
  return sendSuccess(res, { has_access: !!hasAccess, access: data });
});

// GET /api/commerce/living-room/:artistId — living room public info
router.get("/living-room/:artistId", async (req, res) => {
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("id, living_room_price_paise, living_room_description, users(name, avatar_url)")
    .eq("id", req.params.artistId)
    .single();

  if (error || !data) return sendError(res, 404, "Artist not found");
  return sendSuccess(res, data);
});

// GET /api/commerce/living-room/:artistId/membership — fan membership status
router.get("/living-room/:artistId/membership", authenticate, async (req, res) => {
  const { data } = await supabase
    .from("fan_memberships")
    .select("id, tier, status, current_period_end")
    .eq("fan_id", req.user.id)
    .eq("artist_id", req.params.artistId)
    .eq("status", "active")
    .single();

  const isActive = data && new Date(data.current_period_end) > new Date();
  return sendSuccess(res, { is_member: !!isActive, membership: data });
});

// GET /api/commerce/living-room/:artistId/content — exclusive content (members only)
router.get("/living-room/:artistId/content", authenticate, async (req, res) => {
  const { data: membership } = await supabase
    .from("fan_memberships")
    .select("id, status, current_period_end")
    .eq("fan_id", req.user.id)
    .eq("artist_id", req.params.artistId)
    .eq("status", "active")
    .single();

  if (!membership || new Date(membership.current_period_end) <= new Date()) {
    return sendError(res, 403, "Active living room membership required");
  }

  const { data, error } = await supabase
    .from("living_room_content")
    .select("id, title, type, description, created_at, storage_key")
    .eq("artist_id", req.params.artistId)
    .order("created_at", { ascending: false });

  if (error) return sendError(res, 500, error.message);

  const contentWithUrls = await Promise.all(
    data.map(async (item) => ({
      ...item,
      url: await generateSignedUrl(item.storage_key),
    }))
  );

  return sendSuccess(res, contentWithUrls);
});

// POST /api/commerce/living-room/upload — artist uploads exclusive content
router.post(
  "/living-room/upload",
  authenticate,
  requireRole("artist"),
  upload.single("file"),
  async (req, res) => {
    const { title, type, description } = req.body;
    const validTypes = ["voice_note", "demo_track", "studio_session", "livestream"];

    if (!title || !req.file) return sendError(res, 400, "title and file are required");
    if (!validTypes.includes(type)) return sendError(res, 400, "Invalid content type");

    const { data: profile } = await supabase
      .from("artist_profiles")
      .select("id")
      .eq("user_id", req.user.id)
      .single();

    if (!profile) return sendError(res, 404, "Artist profile not found");

    const fileId = uuidv4();
    const ext = req.file.originalname.includes(".") ? "." + req.file.originalname.split(".").pop().toLowerCase() : "";
    const storageKey = `living-room/${profile.id}/${fileId}${ext}`;

    try {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: storageKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));
    } catch (err) {
      console.error("[Commerce] Storage upload failed:", err.message);
      return sendError(res, 502, "File upload to storage failed");
    }

    const { data, error } = await supabase
      .from("living_room_content")
      .insert({
        artist_id: profile.id,
        title,
        type,
        description: description || null,
        storage_key: storageKey,
      })
      .select()
      .single();

    if (error) return sendError(res, 500, error.message);
    return sendSuccess(res, data, 201);
  }
);

// GET /api/commerce/my-purchases — fan's vault purchase history
router.get("/my-purchases", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount_paise, status, created_at, tracks(title, cover_art_url), artist_profiles(users(name))")
    .eq("fan_id", req.user.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data);
});

export default router;
