import { Router } from "express";
import supabase from "../config/supabase.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { globalLimiter } from "../middleware/rateLimiter.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { PAGINATION } from "../config/constants.js";

const router = Router();

// GET /api/analytics/dashboard — full artist dashboard data
router.get("/dashboard", authenticate, requireRole("artist"), async (req, res) => {
  const { data: profile } = await supabase
    .from("artist_profiles")
    .select("id")
    .eq("user_id", req.user.id)
    .single();

  if (!profile) return sendError(res, 404, "Artist profile not found");

  const artistId = profile.id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch artist track IDs first (Supabase JS v2 doesn't support subquery in .in())
  const { data: artistTracks } = await supabase
    .from("tracks")
    .select("id")
    .eq("artist_id", artistId);

  const trackIds = (artistTracks || []).map((t) => t.id);

  const [
    earningsResult,
    streamsResult,
    fansResult,
    topTracksResult,
    recentTransactionsResult,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount_paise, artist_payout_paise, type, created_at")
      .eq("artist_id", artistId)
      .eq("status", "paid"),

    trackIds.length > 0
      ? supabase
          .from("stream_events")
          .select("created_at, type")
          .in("track_id", trackIds)
          .gte("created_at", thirtyDaysAgo)
      : Promise.resolve({ data: [] }),

    supabase
      .from("fan_memberships")
      .select("fan_id")
      .eq("artist_id", artistId)
      .eq("status", "active"),

    supabase
      .from("tracks")
      .select("id, title, play_count, is_vault, cover_art_url")
      .eq("artist_id", artistId)
      .order("play_count", { ascending: false })
      .limit(5),

    supabase
      .from("transactions")
      .select("id, type, amount_paise, artist_payout_paise, status, created_at, users!fan_id(name)")
      .eq("artist_id", artistId)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const transactions = earningsResult.data || [];
  const totalEarningsPaise = transactions.reduce((sum, t) => sum + (t.artist_payout_paise || 0), 0);
  const totalRevenuePaise = transactions.reduce((sum, t) => sum + t.amount_paise, 0);

  const earningsByType = transactions.reduce((acc, t) => {
    acc[t.type] = (acc[t.type] || 0) + (t.artist_payout_paise || 0);
    return acc;
  }, {});

  // Group stream events by date for chart (last 30 days)
  const streamsByDay = (streamsResult.data || []).reduce((acc, ev) => {
    const day = ev.created_at.slice(0, 10);
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  const streamChart = Object.entries(streamsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return sendSuccess(res, {
    earnings: {
      total_paise: totalEarningsPaise,
      total_revenue_paise: totalRevenuePaise,
      by_type: earningsByType,
      platform_fee_paise: totalRevenuePaise - totalEarningsPaise,
    },
    streams: {
      total: streamsResult.data?.length || 0,
      chart: streamChart,
    },
    fans: {
      active_members: fansResult.data?.length || 0,
    },
    top_tracks: topTracksResult.data || [],
    recent_transactions: recentTransactionsResult.data || [],
  });
});

// POST /api/analytics/event — stream event ingestion (rate-limited, auth optional)
router.post("/event", globalLimiter, async (req, res) => {
  const { track_id, type, duration_seconds } = req.body;
  const validTypes = ["play", "skip", "complete", "vault_play"];

  if (!track_id || !type) return sendError(res, 400, "track_id and type are required");
  if (!validTypes.includes(type)) return sendError(res, 400, "Invalid event type");

  await supabase.from("stream_events").insert({
    track_id,
    type,
    duration_seconds: duration_seconds ? Number(duration_seconds) : null,
  });

  return sendSuccess(res, { recorded: true });
});

export default router;
