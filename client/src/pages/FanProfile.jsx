import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import toast from "react-hot-toast";

export default function FanProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("memberships");
  const [memberships, setMemberships] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }

    Promise.all([
      api.get("/fan/memberships"),
      api.get("/commerce/my-purchases"),
      api.get("/fan/following"),
    ]).then(([m, p, f]) => {
      setMemberships(m.data || []);
      setPurchases(p.data || []);
      setFollowing(f.data || []);
    }).catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleLogout = () => { logout(); navigate("/"); };

  const handleCancelMembership = async (artistId) => {
    if (!window.confirm("Cancel membership? You'll keep access until the end of the current period.")) return;
    setCancelling(artistId);
    try {
      await api.delete(`/fan/memberships/${artistId}`);
      toast.success("Membership cancelled — access continues until period end");
      setMemberships((prev) => prev.map((m) =>
        m.artist_profiles?.id === artistId ? { ...m, status: "cancelled" } : m
      ));
    } catch (err) {
      toast.error(err || "Failed to cancel");
    } finally {
      setCancelling(null);
    }
  };

  const tabs = [
    { id: "memberships", label: "🏠 Living Rooms" },
    { id: "purchases", label: "🔐 Vault Tracks" },
    { id: "following", label: "❤️ Following" },
  ];

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-32 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-2xl font-black">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-black">{user?.name}</h1>
              <p className="text-gray-400 text-sm">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-white text-sm transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatBadge label="Active memberships" value={memberships.length} />
          <StatBadge label="Vault unlocks" value={purchases.length} />
          <StatBadge label="Artists followed" value={following.length} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-12">Loading...</p>
        ) : (
          <>
            {tab === "memberships" && (
              <div className="space-y-3">
                {memberships.length === 0 ? (
                  <EmptyState
                    icon="🏠"
                    title="No active memberships"
                    sub="Join an artist's Living Room to get exclusive access"
                    cta="Discover artists"
                    href="/discover"
                  />
                ) : memberships.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center font-bold text-sm">
                        {m.artist_profiles?.users?.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{m.artist_profiles?.users?.name}</p>
                        <p className="text-gray-500 text-xs">Living Room · {m.tier}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`text-xs font-medium ${m.status === "cancelled" ? "text-gray-400" : "text-green-400"}`}>
                          {m.status === "cancelled" ? "Cancelled" : "Active"}
                        </span>
                        <p className="text-gray-600 text-xs">
                          Until {new Date(m.current_period_end).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      {m.status === "active" && (
                        <button
                          onClick={() => handleCancelMembership(m.artist_profiles?.id)}
                          disabled={cancelling === m.artist_profiles?.id}
                          className="text-xs px-3 py-1.5 border border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-full transition-colors disabled:opacity-50"
                        >
                          {cancelling === m.artist_profiles?.id ? "..." : "Cancel"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "purchases" && (
              <div className="space-y-3">
                {purchases.length === 0 ? (
                  <EmptyState
                    icon="🔐"
                    title="No vault tracks unlocked"
                    sub="Support artists by unlocking their exclusive content"
                    cta="Discover artists"
                    href="/discover"
                  />
                ) : purchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎵</span>
                      <div>
                        <p className="text-white font-medium">{p.tracks?.title || "Track"}</p>
                        <p className="text-gray-500 text-xs">{p.artist_profiles?.users?.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-purple-400 text-sm font-bold">₹{(p.amount_paise / 100).toFixed(0)}</p>
                      <p className="text-gray-600 text-xs">{new Date(p.created_at).toLocaleDateString("en-IN")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "following" && (
              <div className="grid grid-cols-2 gap-3">
                {following.length === 0 ? (
                  <div className="col-span-2">
                    <EmptyState
                      icon="❤️"
                      title="Not following anyone yet"
                      sub="Follow artists to stay updated with new releases"
                      cta="Discover artists"
                      href="/discover"
                    />
                  </div>
                ) : following.map((artist) => (
                  <Link
                    key={artist.id}
                    to={`/artist/${artist.id}`}
                    className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {artist.users?.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{artist.users?.name}</p>
                      <p className="text-gray-500 text-xs truncate">{artist.genre || "Artist"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value }) {
  return (
    <div className="bg-white/5 rounded-xl p-4 text-center">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-gray-500 text-xs mt-1">{label}</p>
    </div>
  );
}

function EmptyState({ icon, title, sub, cta, href }) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-white font-medium mb-1">{title}</p>
      <p className="text-gray-500 text-sm mb-4">{sub}</p>
      <Link to={href} className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors">
        {cta} →
      </Link>
    </div>
  );
}
