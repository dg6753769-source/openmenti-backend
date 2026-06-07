import { useEffect, useState } from "react";
import { useMode } from "../../context/ModeContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import PaymentModal from "../payment/PaymentModal";
import toast from "react-hot-toast";

export default function VaultOverlay() {
  const { mode, vaultArtist, closeVault } = useMode();
  const { user } = useAuth();
  const [vaultTracks, setVaultTracks] = useState([]);
  const [membership, setMembership] = useState(null);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [paymentType, setPaymentType] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== "vault" || !vaultArtist) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [tracksRes, membershipRes] = await Promise.all([
          api.get(`/commerce/vault/${vaultArtist.id}`),
          user ? api.get(`/commerce/living-room/${vaultArtist.id}/membership`) : Promise.resolve({ data: null }),
        ]);
        setVaultTracks(tracksRes.data || []);
        setMembership(membershipRes.data);
      } catch {
        toast.error("Failed to load vault content");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mode, vaultArtist, user]);

  if (mode !== "vault") return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-white/10 shadow-2xl">

        {/* Header */}
        <div className="relative p-6 border-b border-white/10">
          <button
            onClick={closeVault}
            className="absolute right-4 top-4 text-gray-500 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔐</span>
            <div>
              <h2 className="text-xl font-bold text-white">
                {vaultArtist?.users?.name || "Artist"}'s Vault
              </h2>
              <p className="text-gray-400 text-sm">Exclusive content for real fans</p>
            </div>
          </div>
        </div>

        {/* Living Room CTA */}
        <div className="m-6 p-5 bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl border border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-lg">🏠 Join the Living Room</h3>
              <p className="text-gray-400 text-sm mt-1">
                Raw voice notes, demo tracks, studio livestreams — monthly access
              </p>
              {membership?.is_member ? (
                <span className="inline-flex items-center gap-1 text-green-400 text-sm font-medium mt-2">
                  ✓ Active member
                </span>
              ) : (
                <p className="text-purple-300 font-bold mt-2">
                  ₹{((vaultArtist?.living_room_price_paise || 19900) / 100).toFixed(0)}/month
                </p>
              )}
            </div>
            {!membership?.is_member && (
              <button
                onClick={() => { setPaymentType("living_room_sub"); setSelectedTrack(null); }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-6 py-3 rounded-full text-sm transition-all hover:scale-105 whitespace-nowrap"
              >
                Join Now
              </button>
            )}
          </div>
        </div>

        {/* Vault Tracks */}
        <div className="px-6 pb-6">
          <h3 className="text-white font-semibold mb-4">Exclusive Tracks</h3>
          {loading ? (
            <div className="text-gray-500 text-center py-8">Loading vault...</div>
          ) : vaultTracks.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No vault tracks yet</div>
          ) : (
            <div className="space-y-3">
              {vaultTracks.map((track) => (
                <VaultTrackRow
                  key={track.id}
                  track={track}
                  onUnlock={() => { setSelectedTrack(track); setPaymentType("vault_unlock"); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Tip Widget */}
        <div className="mx-6 mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
          <p className="text-gray-400 text-sm mb-3">Support this artist directly</p>
          <div className="flex gap-2 flex-wrap">
            {[20, 50, 100, 200].map((amount) => (
              <button
                key={amount}
                onClick={() => { setPaymentType("tip"); setSelectedTrack({ price_paise: amount * 100 }); }}
                className="bg-yellow-500/20 hover:bg-yellow-500/40 border border-yellow-500/40 text-yellow-300 text-sm font-bold px-4 py-2 rounded-full transition-colors"
              >
                ₹{amount} Tip
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentType && (
        <PaymentModal
          type={paymentType}
          track={selectedTrack}
          artist={vaultArtist}
          onClose={() => { setPaymentType(null); setSelectedTrack(null); }}
          onSuccess={() => {
            toast.success("Payment successful! Access granted.");
            setPaymentType(null);
            setSelectedTrack(null);
          }}
        />
      )}
    </div>
  );
}

function VaultTrackRow({ track, onUnlock }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-purple-500/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-900/50 rounded-lg flex items-center justify-center text-lg">
          🎵
        </div>
        <div>
          <p className="text-white text-sm font-medium">{track.title}</p>
          <p className="text-gray-500 text-xs">{track.description || "Exclusive track"}</p>
        </div>
      </div>
      <button
        onClick={onUnlock}
        className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
      >
        ₹{(track.price_paise / 100).toFixed(0)} Unlock
      </button>
    </div>
  );
}
