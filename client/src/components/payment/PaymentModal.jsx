import { useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID;

export default function PaymentModal({ type, track, artist, onClose, onSuccess }) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);

  const getAmount = () => {
    if (type === "tip") return track?.price_paise;
    if (type === "vault_unlock") return track?.price_paise;
    if (type === "living_room_sub") return artist?.living_room_price_paise || 19900;
    return 0;
  };

  const getLabel = () => {
    const labels = {
      tip: "Send Tip",
      vault_unlock: `Unlock "${track?.title}"`,
      living_room_sub: "Join Living Room",
      album_purchase: "Purchase Album",
    };
    return labels[type] || "Pay";
  };

  const handlePay = async () => {
    if (!user) {
      toast.error("Please sign in to make a payment");
      return;
    }

    setProcessing(true);
    try {
      const orderRes = await api.post("/payments/create-order", {
        type,
        amount_paise: getAmount(),
        artist_id: artist?.id,
        track_id: track?.id || null,
      });

      const order = orderRes.data;

      const options = {
        key: RAZORPAY_KEY,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "OpenMenti",
        description: getLabel(),
        prefill: { email: user.email, name: user.name },
        theme: { color: "#9333ea" },
        handler: () => {
          onSuccess();
        },
        modal: {
          ondismiss: () => setProcessing(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err || "Payment initialization failed");
      setProcessing(false);
    }
  };

  const amountRs = (getAmount() / 100).toFixed(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
        <button onClick={onClose} className="float-right text-gray-500 hover:text-white">✕</button>
        <div className="clear-right">
          <h3 className="text-white font-bold text-lg mb-1">{getLabel()}</h3>
          <p className="text-gray-400 text-sm mb-6">
            Supporting{" "}
            <span className="text-purple-400 font-medium">
              {artist?.users?.name || "the artist"}
            </span>
          </p>

          <div className="bg-white/5 rounded-xl p-4 mb-6 text-center">
            <p className="text-gray-400 text-sm">Amount</p>
            <p className="text-white text-3xl font-black mt-1">₹{amountRs}</p>
            {type === "living_room_sub" && (
              <p className="text-gray-500 text-xs mt-1">per month</p>
            )}
            <p className="text-green-400 text-xs mt-3 font-medium">
              ✓ 90% goes directly to the artist
            </p>
          </div>

          <button
            onClick={handlePay}
            disabled={processing}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all text-base"
          >
            {processing ? "Opening payment..." : `Pay ₹${amountRs} via UPI / Card`}
          </button>

          <p className="text-gray-600 text-xs text-center mt-3">
            Secured by Razorpay · UPI · Cards · Wallets
          </p>
        </div>
      </div>
    </div>
  );
}
