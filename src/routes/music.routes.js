import { Router } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import supabase from "../config/supabase.js";
import s3, { BUCKET } from "../config/storage.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { generateSignedUrl, getPublicUrl } from "../utils/signedUrl.js";
import { sendSuccess, sendError } from "../utils/response.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/music — public track feed (non-vault tracks)
router.get("/", async (req, res) => {
  const { artist_id, limit = 20, offset = 0 } = req.query;

  let query = supabase
    .from("tracks")
    .select("id, title, description, cover_art_url, is_vault, price_paise, play_count, duration_seconds, artist_profiles(id, living_room_price_paise, users(name, avatar_url)), created_at")
    .eq("is_vault", false)
    .order("created_at", { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (artist_id) query = query.eq("artist_id", artist_id);

  const { data, error } = await query;
  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data);
});

// GET /api/music/:id/stream — get streaming URL for a track
router.get("/:id/stream", async (req, res) => {
  const { data: track, error } = await supabase
    .from("tracks")
    .select("*, artist_profiles(id, living_room_price_paise, razorpay_linked_account_id, users(name, avatar_url))")
    .eq("id", req.params.id)
    .single();

  if (error || !track) return sendError(res, 404, "Track not found");

  // Vault tracks require verified purchase
  if (track.is_vault) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(res, 401, "Authentication required for vault content");
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch {
      return sendError(res, 401, "Invalid token");
    }

    const { data: access } = await supabase
      .from("vault_access")
      .select("id, expires_at")
      .eq("fan_id", decoded.id)
      .eq("track_id", track.id)
      .single();

    if (!access || (access.expires_at && new Date(access.expires_at) <= new Date())) {
      return sendError(res, 403, "Purchase required to access vault content");
    }

    const url = await generateSignedUrl(track.storage_key);
    await Promise.all([
      supabase.from("stream_events").insert({ track_id: track.id, type: "vault_play" }),
      supabase.from("tracks").update({ play_count: track.play_count + 1 }).eq("id", track.id),
    ]);

    return sendSuccess(res, { url, expires_in: 14400, is_vault: true });
  }

  // Public track — CDN URL (HLS playlist preferred, raw file fallback)
  const url = track.hls_playlist_key
    ? getPublicUrl(track.hls_playlist_key)
    : getPublicUrl(track.storage_key);

  await Promise.all([
    supabase.from("stream_events").insert({ track_id: track.id, type: "play" }),
    supabase.from("tracks").update({ play_count: track.play_count + 1 }).eq("id", track.id),
  ]);

  return sendSuccess(res, { url, is_vault: false });
});

// POST /api/music/upload — artist uploads a track
router.post(
  "/upload",
  authenticate,
  requireRole("artist"),
  upload.fields([{ name: "audio", maxCount: 1 }, { name: "cover", maxCount: 1 }]),
  async (req, res) => {
    const { title, description, is_vault = "false", price_paise = "0", duration_seconds } = req.body;
    if (!title || !req.files?.audio) return sendError(res, 400, "title and audio file are required");

    const { data: artistProfile } = await supabase
      .from("artist_profiles")
      .select("id")
      .eq("user_id", req.user.id)
      .single();

    if (!artistProfile) return sendError(res, 404, "Artist profile not found");

    const trackId = uuidv4();
    const audioKey = `audio/${artistProfile.id}/${trackId}/original${getExt(req.files.audio[0].originalname)}`;
    let coverKey = null;

    try {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: audioKey,
        Body: req.files.audio[0].buffer,
        ContentType: req.files.audio[0].mimetype,
      }));

      if (req.files?.cover) {
        coverKey = `covers/${artistProfile.id}/${trackId}${getExt(req.files.cover[0].originalname)}`;
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: coverKey,
          Body: req.files.cover[0].buffer,
          ContentType: req.files.cover[0].mimetype,
        }));
      }
    } catch (err) {
      console.error("[Music] Storage upload failed:", err.message);
      return sendError(res, 502, "File upload to storage failed");
    }

    const { data: track, error } = await supabase
      .from("tracks")
      .insert({
        id: trackId,
        artist_id: artistProfile.id,
        title,
        description: description || null,
        storage_key: audioKey,
        cover_art_url: coverKey ? getPublicUrl(coverKey) : null,
        is_vault: is_vault === "true",
        price_paise: Number(price_paise),
        duration_seconds: duration_seconds ? Number(duration_seconds) : null,
        play_count: 0,
      })
      .select()
      .single();

    if (error) return sendError(res, 500, error.message);
    return sendSuccess(res, track, 201);
  }
);

// DELETE /api/music/:id — artist deletes own track
router.delete("/:id", authenticate, requireRole("artist"), async (req, res) => {
  const { data: profile } = await supabase
    .from("artist_profiles")
    .select("id")
    .eq("user_id", req.user.id)
    .single();

  if (!profile) return sendError(res, 404, "Artist profile not found");

  const { error } = await supabase
    .from("tracks")
    .delete()
    .eq("id", req.params.id)
    .eq("artist_id", profile.id);

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, { deleted: true });
});

const getExt = (filename) => {
  const parts = filename.split(".");
  return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : "";
};

export default router;
