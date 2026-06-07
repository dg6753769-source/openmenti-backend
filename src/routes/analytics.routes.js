import { Router } from "express";
import supabase from "../config/supabase.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";

const router = Router();

// GET /api/analytics/dashboard — artist's full dashboard data
router.get("/dashboard", authenticate, requireRole("artist"), async (req, res) => {
  const { data: profile } = await supabase
    .from("artist_profiles")
    .select("id")
    .eq("user_id", req.user.id)
    .single();

  if (!profile) return sendError(res, 404, "Artist profile not found");

  const artistId = profile.id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Run all queries in parallel for performance
  const [
    earningsResult,
    streamsResult,
    fansResult,
    topTracksResult,
    recentTransactionsResult,
  ] = await Promise.all([
    // Total earnings (paid transactions)
    supabase
      .from("transactions")
      .select("amount_paise, artist_payout_paise, type, created_at")
      .eq("artist_id", artistId)
      .eq("status", "paid"),

    // Stream events last 30 days
    supabase
      .from("stream_events")
      .select("created_at, type")
      .in("track_id",
        supabase.from("tracks").select("id").eq("artist_id", artistId)
      )
      .gte("created_at", thirtyDaysAgo),

    // Total unique fans
    supabase
      .from("fan_memberships")
      .select("fan_id")
      .eq("artist_id", artistId)
      .eq("status", "active"),

    // Top tracks by play count
    supabase
      .from("tracks")
      .select("id, title, play_count, is_vault, cover_art_url")
      .eq("artist_id", artistId)
      .order("play_count", { ascending: false })
      .limit(5),

    // Recent transactions
    supabase
      .from("transactions")
      .select("id, type, amount_paise, artist_payout_paise, status, created_at, users(name)")
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

  return sendSuccess(res, {
    earnings: {
      total_paise: totalEarningsPaise,
      total_revenue_paise: totalRevenuePaise,
      by_type: earningsByType,
      platform_fee_paise: totalRevenuePaise - totalEarningsPaise,
    },
    streams: {
      total: streamsResult.data?.length || 0,
      last_30_days: streamsResult.data || [],
    },
    fans: {
      active_members: fansResult.data?.length || 0,
    },
    top_tracks: topTracksResult.data || [],
    recent_transactions: recentTransactionsResult.data || [],
  });
});

// POST /api/analytics/event — client-side stream event ingestion
router.post("/event", async (req, res) => {
  const { track_id, type, duration_seconds } = req.body;
  if (!track_id || !type) return sendError(res, 400, "track_id and type are required");

  await supabase.from("stream_events").insert({ track_id, type, duration_seconds });
  return sendSuccess(res, { recorded: true });
});

export default router;
