import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import toast from "react-hot-toast";

export default function ArtistSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    bio: "",
    genre: "",
    living_room_price_paise: 19900,
    living_room_description: "",
  });
  const [socialLinks, setSocialLinks] = useState({ instagram: "", twitter: "", spotify: "", youtube: "" });
  const [razorpayAccountId, setRazorpayAccountId] = useState("");

  useEffect(() => {
    if (!user || user.role !== "artist") navigate("/");
  }, [user, navigate]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const social_links = Object.fromEntries(
        Object.entries(socialLinks).filter(([, v]) => v.trim())
      );
      await api.patch("/artists/profile", {
        ...profile,
        living_room_price_paise: Number(profile.living_room_price_paise),
        social_links,
      });
      toast.success("Profile saved!");
      setStep(2);
    } catch (err) {
      toast.error(err || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const linkRazorpay = async (e) => {
    e.preventDefault();
    if (!razorpayAccountId.trim()) {
      toast.error("Enter your Razorpay linked account ID");
      return;
    }
    setSaving(true);
    try {
      await api.post("/artists/link-razorpay", { razorpay_linked_account_id: razorpayAccountId.trim() });
      toast.success("Razorpay account linked! You can now receive payouts.");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err || "Failed to link Razorpay account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 pt-20">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= s ? "bg-purple-600 text-white" : "bg-white/10 text-gray-500"
              }`}>
                {s}
              </div>
              {s < 2 && <div className={`h-0.5 w-12 ${step > s ? "bg-purple-600" : "bg-white/10"}`} />}
            </div>
          ))}
          <span className="text-gray-400 text-sm ml-2">
            {step === 1 ? "Artist profile" : "Payout account"}
          </span>
        </div>

        {step === 1 && (
          <div className="bg-gray-900 rounded-2xl p-8 border border-white/10">
            <h2 className="text-2xl font-black mb-1">Set up your artist profile</h2>
            <p className="text-gray-400 text-sm mb-6">This is what fans will see on your page</p>

            <form onSubmit={saveProfile} className="space-y-5">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Genre</label>
                <input
                  type="text"
                  placeholder="e.g. Hip-hop, Indie, Classical..."
                  value={profile.genre}
                  onChange={(e) => setProfile({ ...profile, genre: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Bio</label>
                <textarea
                  rows={4}
                  placeholder="Tell your story..."
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="p-4 bg-purple-900/30 rounded-xl border border-purple-500/30">
                <h3 className="text-white font-bold mb-3">🏠 Living Room Setup</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Monthly price (₹)</label>
                    <input
                      type="number"
                      min={49}
                      value={profile.living_room_price_paise / 100}
                      onChange={(e) => setProfile({ ...profile, living_room_price_paise: Number(e.target.value) * 100 })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">What fans get</label>
                    <input
                      type="text"
                      placeholder="e.g. Raw demos, voice notes, monthly Q&A..."
                      value={profile.living_room_description}
                      onChange={(e) => setProfile({ ...profile, living_room_description: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <h3 className="text-white font-bold mb-3 text-sm">Social Links (optional)</h3>
                <div className="space-y-2">
                  {[
                    { key: "instagram", placeholder: "Instagram username", prefix: "@" },
                    { key: "twitter", placeholder: "Twitter / X username", prefix: "@" },
                    { key: "spotify", placeholder: "Spotify artist URL" },
                    { key: "youtube", placeholder: "YouTube channel URL" },
                  ].map(({ key, placeholder, prefix }) => (
                    <div key={key} className="flex items-center gap-2">
                      {prefix && <span className="text-gray-500 text-sm w-4">{prefix}</span>}
                      <input
                        type="text"
                        placeholder={placeholder}
                        value={socialLinks[key]}
                        onChange={(e) => setSocialLinks({ ...socialLinks, [key]: e.target.value })}
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all"
              >
                {saving ? "Saving..." : "Save & Continue →"}
              </button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="bg-gray-900 rounded-2xl p-8 border border-white/10">
            <h2 className="text-2xl font-black mb-1">Link your payout account</h2>
            <p className="text-gray-400 text-sm mb-6">
              Connect your Razorpay account so 90% of every payment goes directly to you — instantly.
            </p>

            <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 mb-6">
              <h4 className="text-blue-300 font-bold text-sm mb-2">How to get your Linked Account ID</h4>
              <ol className="text-gray-400 text-sm space-y-1 list-decimal list-inside">
                <li>Log in to Razorpay Dashboard</li>
                <li>Go to Route → Linked Accounts</li>
                <li>Create a new Linked Account (your bank details)</li>
                <li>Copy the Account ID (starts with <code className="text-blue-300">acc_</code>)</li>
              </ol>
            </div>

            <form onSubmit={linkRazorpay} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Razorpay Linked Account ID</label>
                <input
                  type="text"
                  placeholder="acc_xxxxxxxxxxxx"
                  value={razorpayAccountId}
                  onChange={(e) => setRazorpayAccountId(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all"
              >
                {saving ? "Linking..." : "Link Account & Go to Dashboard"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="w-full text-gray-500 hover:text-gray-300 text-sm transition-colors py-2"
              >
                Skip for now →
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
