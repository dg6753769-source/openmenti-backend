import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const TABS = ["overview", "tracks", "upload", "living-room"];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");
  const [tracks, setTracks] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [uploadForm, setUploadForm] = useState({ title: "", description: "", is_vault: false, price_paise: 4900 });
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [lrForm, setLrForm] = useState({ title: "", type: "voice_note", description: "" });
  const [lrFile, setLrFile] = useState(null);
  const [lrUploading, setLrUploading] = useState(false);

  const loadDashboard = useCallback(() => {
    api.get("/analytics/dashboard")
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load dashboard"));
  }, []);

  const loadTracks = useCallback(() => {
    if (!user) return;
    api.get("/artists/by-user/" + user.id).then((profileRes) => {
      const artistId = profileRes.data?.id;
      if (artistId) {
        api.get(`/music?artist_id=${artistId}&limit=50`)
          .then((res) => setTracks(res.data || []));
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "artist") { navigate("/"); return; }
    loadDashboard();
    loadTracks();
  }, [user, navigate, loadDashboard, loadTracks]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!audioFile) return toast.error("Select an audio file");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("audio", audioFile);
      form.append("title", uploadForm.title);
      form.append("description", uploadForm.description);
      form.append("is_vault", String(uploadForm.is_vault));
      form.append("price_paise", String(uploadForm.price_paise));
      if (coverFile) form.append("cover", coverFile);
      await api.post("/music/upload", form);
      toast.success("Track uploaded!");
      setAudioFile(null);
      setCoverFile(null);
      setUploadForm({ title: "", description: "", is_vault: false, price_paise: 4900 });
      loadTracks();
      setTab("tracks");
    } catch (err) {
      toast.error(err || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (trackId) => {
    if (!window.confirm("Delete this track permanently?")) return;
    setDeleting(trackId);
    try {
      await api.delete(`/music/${trackId}`);
      toast.success("Track deleted");
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
    } catch (err) {
      toast.error(err || "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const handleLrUpload = async (e) => {
    e.preventDefault();
    if (!lrFile) return toast.error("Select a file");
    setLrUploading(true);
    try {
      const form = new FormData();
      form.append("file", lrFile);
      form.append("title", lrForm.title);
      form.append("type", lrForm.type);
      form.append("description", lrForm.description);
      await api.post("/commerce/living-room/upload", form);
      toast.success("Content uploaded to Living Room!");
      setLrFile(null);
      setLrForm({ title: "", type: "voice_note", description: "" });
    } catch (err) {
      toast.error(err || "Upload failed");
    } finally {
      setLrUploading(false);
    }
  };

  if (!data) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      Loading dashboard...
    </div>
  );

  const earningsRs = (data.earnings.total_paise / 100).toFixed(0);
  const revenueRs = (data.earnings.total_revenue_paise / 100).toFixed(0);

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black mb-1">Dashboard</h1>
            <p className="text-gray-400 text-sm">Transparent earnings — no hidden cuts</p>
          </div>
          <Link
            to="/setup"
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors border border-purple-500/30 px-4 py-2 rounded-full"
          >
            Edit profile
          </Link>
        </div>

        {/* Tab Nav */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-8 w-fit">
          {[
            { id: "overview", label: "Overview" },
            { id: "tracks", label: `Tracks (${tracks.length})` },
            { id: "upload", label: "Upload Track" },
            { id: "living-room", label: "🏠 Living Room" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t.id ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Your Earnings" value={`₹${earningsRs}`} sub="90% of revenue" color="purple" />
              <StatCard label="Total Revenue" value={`₹${revenueRs}`} sub="fans paid" color="pink" />
              <StatCard label="Total Streams" value={data.streams.total} sub="all time" color="blue" />
              <StatCard label="Active Members" value={data.fans.active_members} sub="living room" color="green" />
            </div>

            {Object.keys(data.earnings.by_type).length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold mb-3 text-gray-300">Earnings by type</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(data.earnings.by_type).map(([type, paise]) => (
                    <div key={type} className="bg-white/5 rounded-xl p-4">
                      <p className="text-gray-400 text-xs capitalize">{type.replace(/_/g, " ")}</p>
                      <p className="text-white text-xl font-bold mt-1">₹{(paise / 100).toFixed(0)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-bold mb-3 text-gray-300">Top Tracks</h2>
                <div className="space-y-2">
                  {data.top_tracks.length === 0 && <p className="text-gray-600 text-sm">No tracks yet</p>}
                  {data.top_tracks.map((track, i) => (
                    <div key={track.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                      <span className="text-gray-600 text-sm w-4">{i + 1}</span>
                      <span>🎵</span>
                      <p className="flex-1 text-white text-sm">{track.title}</p>
                      {track.is_vault && <span className="text-purple-400 text-xs">🔐</span>}
                      <span className="text-gray-400 text-xs">{track.play_count} plays</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold mb-3 text-gray-300">Recent Earnings</h2>
                <div className="space-y-2">
                  {data.recent_transactions.length === 0 && <p className="text-gray-600 text-sm">No transactions yet</p>}
                  {data.recent_transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                      <div>
                        <span className="text-gray-400 text-xs capitalize">{tx.type.replace(/_/g, " ")}</span>
                        <span className="text-gray-600 text-xs ml-2">from {tx.users?.name || "fan"}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-green-400 text-sm font-bold">+₹{((tx.artist_payout_paise || 0) / 100).toFixed(0)}</p>
                        <p className="text-gray-600 text-xs">₹{(tx.amount_paise / 100).toFixed(0)} total</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* TRACKS TAB */}
        {tab === "tracks" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Your Tracks</h2>
              <button onClick={() => setTab("upload")} className="text-purple-400 hover:text-purple-300 text-sm">+ Upload new</button>
            </div>
            {tracks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">🎵</div>
                <p>No tracks uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tracks.map((track) => (
                  <div key={track.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl group">
                    <div className="w-10 h-10 rounded-lg bg-purple-900/50 flex items-center justify-center text-lg flex-shrink-0">
                      {track.cover_art_url
                        ? <img src={track.cover_art_url} alt="" className="w-full h-full object-cover rounded-lg" />
                        : "🎵"
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{track.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {track.is_vault && (
                          <span className="text-purple-400 text-xs font-medium bg-purple-500/20 px-2 py-0.5 rounded-full">
                            🔐 Vault · ₹{(track.price_paise / 100).toFixed(0)}
                          </span>
                        )}
                        <span className="text-gray-500 text-xs">{track.play_count} plays</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(track.id)}
                      disabled={deleting === track.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400 text-xs px-3 py-1.5 border border-red-500/30 rounded-full"
                    >
                      {deleting === track.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* UPLOAD TAB */}
        {tab === "upload" && (
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 max-w-lg">
            <h2 className="text-xl font-bold mb-5">Upload New Track</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <input
                type="text"
                placeholder="Track title *"
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                required
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <div>
                <label className="text-gray-400 text-sm block mb-1">Audio file * (max 50MB)</label>
                <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files[0])} className="w-full text-gray-400 text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Cover art (optional)</label>
                <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files[0])} className="w-full text-gray-400 text-sm" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadForm.is_vault}
                  onChange={(e) => setUploadForm({ ...uploadForm, is_vault: e.target.checked })}
                  className="w-4 h-4 accent-purple-500"
                />
                <span className="text-gray-300 text-sm">Vault track (fans pay to unlock)</span>
              </label>
              {uploadForm.is_vault && (
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Unlock price (₹)</label>
                  <input
                    type="number"
                    min={10}
                    value={uploadForm.price_paise / 100}
                    onChange={(e) => setUploadForm({ ...uploadForm, price_paise: Number(e.target.value) * 100 })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors"
              >
                {uploading ? "Uploading..." : "Upload Track"}
              </button>
            </form>
          </div>
        )}

        {/* LIVING ROOM TAB */}
        {tab === "living-room" && (
          <div className="max-w-lg">
            <p className="text-gray-400 text-sm mb-6">
              Upload exclusive content for your Living Room members — raw demos, voice notes, studio sessions.
            </p>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h2 className="text-xl font-bold mb-5">Upload Exclusive Content</h2>
              <form onSubmit={handleLrUpload} className="space-y-4">
                <input
                  type="text"
                  placeholder="Content title *"
                  value={lrForm.title}
                  onChange={(e) => setLrForm({ ...lrForm, title: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  required
                />
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Content type</label>
                  <select
                    value={lrForm.type}
                    onChange={(e) => setLrForm({ ...lrForm, type: e.target.value })}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="voice_note">🎙️ Voice Note</option>
                    <option value="demo_track">🎵 Demo Track</option>
                    <option value="studio_session">🎚️ Studio Session</option>
                    <option value="livestream">🎥 Livestream Recording</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={lrForm.description}
                  onChange={(e) => setLrForm({ ...lrForm, description: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <div>
                  <label className="text-gray-400 text-sm block mb-1">Audio/Video file *</label>
                  <input type="file" accept="audio/*,video/*" onChange={(e) => setLrFile(e.target.files[0])} className="w-full text-gray-400 text-sm" />
                </div>
                <button
                  type="submit"
                  disabled={lrUploading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all"
                >
                  {lrUploading ? "Uploading..." : "Publish to Living Room"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  const colors = {
    purple: "from-purple-900/40 border-purple-500/30 text-purple-400",
    pink: "from-pink-900/40 border-pink-500/30 text-pink-400",
    blue: "from-blue-900/40 border-blue-500/30 text-blue-400",
    green: "from-green-900/40 border-green-500/30 text-green-400",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-5`}>
      <p className="text-gray-400 text-sm">{label}</p>
      <p className={`text-3xl font-black mt-1 ${colors[color].split(" ")[2]}`}>{value}</p>
      <p className="text-gray-600 text-xs mt-1">{sub}</p>
    </div>
  );
}
