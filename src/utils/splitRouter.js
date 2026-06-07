import razorpay from "../config/razorpay.js";
import supabase from "../config/supabase.js";
import { PLATFORM_FEE_PERCENT } from "../config/constants.js";

/**
 * Routes (100 - PLATFORM_FEE_PERCENT)% of the payment directly to the artist's
 * Razorpay linked account. Updates split_status in transactions table.
 */
export const executeSplit = async ({ transactionId, paymentId, amountPaise, artistLinkedAccountId }) => {
  const artistSharePaise = Math.floor(amountPaise * ((100 - PLATFORM_FEE_PERCENT) / 100));

  try {
    const transfer = await razorpay.payments.transfer(paymentId, {
      transfers: [
        {
          account: artistLinkedAccountId,
          amount: artistSharePaise,
          currency: "INR",
          notes: { transaction_id: transactionId, platform: "OpenMenti" },
          on_hold: 0,
        },
      ],
    });

    await supabase
      .from("transactions")
      .update({
        split_status: "routed",
        artist_payout_paise: artistSharePaise,
        platform_fee_paise: amountPaise - artistSharePaise,
        razorpay_transfer_id: transfer.items?.[0]?.id,
      })
      .eq("id", transactionId);

    return { success: true, transfer };
  } catch (err) {
    await supabase
      .from("transactions")
      .update({ split_status: "failed", split_error: err.message })
      .eq("id", transactionId);

    console.error("[SplitRouter] Transfer failed for tx:", transactionId, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Retries a previously failed split. Can be triggered manually by admin or artist.
 */
export const retrySplit = async (transactionId) => {
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, razorpay_payment_id, amount_paise, artist_id, split_status")
    .eq("id", transactionId)
    .single();

  if (!tx) return { success: false, error: "Transaction not found" };
  if (tx.split_status === "routed") return { success: false, error: "Already routed" };

  const { data: profile } = await supabase
    .from("artist_profiles")
    .select("razorpay_linked_account_id")
    .eq("id", tx.artist_id)
    .single();

  if (!profile?.razorpay_linked_account_id) {
    return { success: false, error: "Artist has no linked Razorpay account" };
  }

  return executeSplit({
    transactionId: tx.id,
    paymentId: tx.razorpay_payment_id,
    amountPaise: tx.amount_paise,
    artistLinkedAccountId: profile.razorpay_linked_account_id,
  });
};
