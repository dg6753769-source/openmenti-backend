import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import razorpay from "../config/razorpay.js";
import supabase from "../config/supabase.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { paymentLimiter } from "../middleware/rateLimiter.js";
import { verifyRazorpayWebhook } from "../middleware/webhookVerify.js";
import { executeSplit, retrySplit } from "../utils/splitRouter.js";
import { sendSuccess, sendError } from "../utils/response.js";

const router = Router();

// POST /api/payments/create-order
router.post("/create-order", authenticate, paymentLimiter, async (req, res) => {
  const { type, amount_paise, artist_id, track_id } = req.body;
  const validTypes = ["tip", "vault_unlock", "living_room_sub", "album_purchase"];

  if (!validTypes.includes(type)) return sendError(res, 400, "Invalid payment type");
  if (!amount_paise || amount_paise < 100) return sendError(res, 400, "Minimum amount is ₹1 (100 paise)");
  if (!artist_id) return sendError(res, 400, "artist_id is required");

  const transactionId = uuidv4();

  let order;
  try {
    order = await razorpay.orders.create({
      amount: amount_paise,
      currency: "INR",
      receipt: transactionId,
      notes: {
        transaction_id: transactionId,
        fan_id: req.user.id,
        artist_id,
        track_id: track_id || "",
        type,
        platform: "OpenMenti",
      },
    });
  } catch (err) {
    console.error("[Payment] Razorpay order creation failed:", err.message);
    return sendError(res, 502, "Payment gateway error. Please try again.");
  }

  const { error: dbError } = await supabase.from("transactions").insert({
    id: transactionId,
    fan_id: req.user.id,
    artist_id,
    track_id: track_id || null,
    type,
    amount_paise,
    razorpay_order_id: order.id,
    status: "pending",
    split_status: "pending",
  });

  if (dbError) {
    console.error("[Payment] DB insert failed:", dbError.message);
    return sendError(res, 500, "Failed to record transaction");
  }

  return sendSuccess(res, {
    order_id: order.id,
    transaction_id: transactionId,
    amount: order.amount,
    currency: order.currency,
    key_id: process.env.RAZORPAY_KEY_ID,
  });
});

// POST /api/payments/webhook — Razorpay events (HMAC-verified)
router.post("/webhook", verifyRazorpayWebhook, async (req, res) => {
  const event = req.body;

  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const notes = payment.notes;
    const { transaction_id: txId, fan_id, artist_id, track_id, type } = notes;

    // Idempotency: skip if already processed
    const { data: existing } = await supabase
      .from("transactions")
      .select("status")
      .eq("id", txId)
      .single();

    if (existing?.status === "paid") return res.json({ received: true });

    await supabase
      .from("transactions")
      .update({ status: "paid", razorpay_payment_id: payment.id })
      .eq("id", txId);

    if (type === "vault_unlock" && track_id) {
      await supabase.from("vault_access").insert({
        fan_id,
        track_id,
        transaction_id: txId,
      });
    }

    if (type === "living_room_sub") {
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("fan_memberships").upsert(
        { fan_id, artist_id, tier: "living_room", status: "active", current_period_end: thirtyDays, transaction_id: txId },
        { onConflict: "fan_id,artist_id" }
      );
    }

    const { data: artistProfile } = await supabase
      .from("artist_profiles")
      .select("razorpay_linked_account_id")
      .eq("id", artist_id)
      .single();

    if (artistProfile?.razorpay_linked_account_id) {
      await executeSplit({
        transactionId: txId,
        paymentId: payment.id,
        amountPaise: payment.amount,
        artistLinkedAccountId: artistProfile.razorpay_linked_account_id,
      });
    } else {
      // No linked account yet — mark split as not applicable
      await supabase
        .from("transactions")
        .update({ split_status: "not_applicable" })
        .eq("id", txId);
    }

    req.app.get("io")?.to(`artist:${artist_id}`).emit("payment_received", {
      type,
      amount_paise: payment.amount,
      fan_id,
    });
  }

  if (event.event === "subscription.charged") {
    const sub = event.payload.subscription.entity;
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("fan_memberships")
      .update({ status: "active", current_period_end: thirtyDays })
      .eq("razorpay_subscription_id", sub.id);
  }

  return res.json({ received: true });
});

// GET /api/payments/history
router.get("/history", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount_paise, status, split_status, created_at, artist_profiles(users(name))")
    .eq("fan_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data);
});

// GET /api/payments/splits — artist's payout split history
router.get("/splits", authenticate, requireRole("artist"), async (req, res) => {
  const { data: profile } = await supabase
    .from("artist_profiles")
    .select("id")
    .eq("user_id", req.user.id)
    .single();

  if (!profile) return sendError(res, 404, "Artist profile not found");

  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount_paise, artist_payout_paise, platform_fee_paise, split_status, split_error, razorpay_transfer_id, created_at")
    .eq("artist_id", profile.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data);
});

// POST /api/payments/splits/:transactionId/retry — retry a failed split transfer
router.post("/splits/:transactionId/retry", authenticate, requireRole("artist"), async (req, res) => {
  // Verify this transaction belongs to the requesting artist
  const { data: profile } = await supabase
    .from("artist_profiles")
    .select("id")
    .eq("user_id", req.user.id)
    .single();

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, artist_id, split_status")
    .eq("id", req.params.transactionId)
    .single();

  if (!tx) return sendError(res, 404, "Transaction not found");
  if (tx.artist_id !== profile.id) return sendError(res, 403, "Not your transaction");
  if (tx.split_status !== "failed") return sendError(res, 400, `Split status is '${tx.split_status}', not failed`);

  const result = await retrySplit(req.params.transactionId);
  if (!result.success) return sendError(res, 502, result.error);
  return sendSuccess(res, { retried: true });
});

export default router;
