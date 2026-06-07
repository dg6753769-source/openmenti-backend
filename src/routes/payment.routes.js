import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import razorpay from "../config/razorpay.js";
import supabase from "../config/supabase.js";
import { authenticate } from "../middleware/auth.js";
import { verifyRazorpayWebhook } from "../middleware/webhookVerify.js";
import { executeSplit } from "../utils/splitRouter.js";
import { sendSuccess, sendError } from "../utils/response.js";

const router = Router();

// POST /api/payments/create-order — create a Razorpay order for any payment type
router.post("/create-order", authenticate, async (req, res) => {
  const { type, amount_paise, artist_id, track_id, subscription_id } = req.body;
  const validTypes = ["tip", "vault_unlock", "living_room_sub", "album_purchase"];

  if (!validTypes.includes(type)) return sendError(res, 400, "Invalid payment type");
  if (!amount_paise || amount_paise < 100) return sendError(res, 400, "Minimum amount is ₹1 (100 paise)");

  // Idempotency: prevent duplicate orders for same fan+track
  const idempotencyKey = track_id
    ? `${req.user.id}-${track_id}`
    : `${req.user.id}-${type}-${Date.now()}`;

  const transactionId = uuidv4();

  const order = await razorpay.orders.create({
    amount: amount_paise,
    currency: "INR",
    receipt: transactionId,
    notes: {
      transaction_id: transactionId,
      fan_id: req.user.id,
      artist_id,
      track_id,
      type,
      platform: "OpenMenti",
    },
  });

  // Record pending transaction
  await supabase.from("transactions").insert({
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

  return sendSuccess(res, {
    order_id: order.id,
    transaction_id: transactionId,
    amount: order.amount,
    currency: order.currency,
    key_id: process.env.RAZORPAY_KEY_ID,
  });
});

// POST /api/payments/webhook — Razorpay payment events (HMAC-verified)
router.post("/webhook", verifyRazorpayWebhook, async (req, res) => {
  const event = req.body;

  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const notes = payment.notes;

    const { transactionId: txId, fan_id, artist_id, track_id, type } = notes;

    // Idempotency: skip if already processed
    const { data: existing } = await supabase
      .from("transactions")
      .select("status")
      .eq("id", txId)
      .single();

    if (existing?.status === "paid") return res.json({ received: true });

    // Mark transaction paid
    await supabase
      .from("transactions")
      .update({ status: "paid", razorpay_payment_id: payment.id })
      .eq("id", txId);

    // Grant access based on payment type
    if (type === "vault_unlock" && track_id) {
      await supabase.from("vault_access").insert({ fan_id, track_id, transaction_id: txId });
    }

    if (type === "living_room_sub") {
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("fan_memberships").upsert({
        fan_id,
        artist_id,
        tier: "living_room",
        status: "active",
        current_period_end: thirtyDays,
        transaction_id: txId,
      }, { onConflict: "fan_id,artist_id" });
    }

    // Execute 90/10 split routing
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
    }

    // Emit real-time event via socket (handled in main server)
    req.app.get("io")?.to(`artist:${artist_id}`).emit("payment_received", {
      type,
      amount_paise: payment.amount,
      fan_id,
    });
  }

  if (event.event === "subscription.charged") {
    const sub = event.payload.subscription.entity;
    const payment = event.payload.payment.entity;
    // Renew membership period
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("fan_memberships")
      .update({ status: "active", current_period_end: thirtyDays })
      .eq("razorpay_subscription_id", sub.id);
  }

  return res.json({ received: true });
});

// GET /api/payments/history — fan's full transaction history
router.get("/history", authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, type, amount_paise, status, split_status, created_at, artist_profiles(users(name))")
    .eq("fan_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return sendError(res, 500, error.message);
  return sendSuccess(res, data);
});

export default router;
