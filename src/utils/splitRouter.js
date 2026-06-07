import razorpay from "../config/razorpay.js";
import supabase from "../config/supabase.js";

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT) || 10;

/**
 * Triggers Razorpay Route transfer after a confirmed payment.
 * Routes (100 - PLATFORM_FEE_PERCENT)% directly to the artist's linked account.
 * Updates the transaction split_status in the DB.
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

    console.error("[SplitRouter] Transfer failed:", err.message);
    return { success: false, error: err.message };
  }
};
