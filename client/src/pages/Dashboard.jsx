import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", is_vault: false, price_paise: 4900 });
  const [audioFile, setAudioFile] = useState(null);

  useEffect(() => {
    if (!user || user.role !== "artist") { navigate("/"); return; }
    api.get("/analytics/dashboard")
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load dashboard"));
  }, [user, navigate]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!audioFile) return toast.error("Select an audio file");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("audio", audioFile);
      form.append("title", uploadForm.title);
      form.append("is_vault", uploadForm.is_vault);
      form.append("price_paise", uploadForm.price_paise);
      await api.post("/music/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Track uploaded!");
      setAudioFile(null);
      setUploadForm({ title: "", is_vault: false, price_paise: 4900 });
    } catch (err) {
      toast.error(err || "Upload failed");
    } finally {
      setUploading(false);
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black mb-2">Your Dashboard</h1>
        <p className="text-gray-400 mb-8">Transparent earnings — no hidden cuts</p>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Your Earnings" value={`₹${earningsRs}`} sub="90% of revenue" color="purple" />
          <StatCard label="Total Revenue" value={`₹${revenueRs}`} sub="fans paid" color="pink" />
          <StatCard label="Total Streams" value={data.streams.total} sub="all time" color="blue" />
          <StatCard label="Active Members" value={data.fans.active_members} sub="living room" color="green" />
        </div>

        {/* Earnings breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {Object.entries(data.earnings.by_type).map(([type, paise]) => (
            <div key={type} className="bg-white/5 rounded-xl p-4">
              <p className="text-gray-400 text-sm capitalize">{type.replace(/_/g, " ")}</p>
              <p className="text-white text-2xl font-bold mt-1">₹{(paise / 100).toFixed(0)}</p>
            </div>
          ))}
        </div>

        {/* Top Tracks */}
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-4">Top Tracks</h2>
          <div className="space-y-2">
            {data.top_tracks.map((track, i) => (
              <div key={track.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-xl">
                <span className="text-gray-600 w-4">{i + 1}</span>
                <span className="text-lg">🎵</span>
                <p className="flex-1 text-white">{track.title}</p>
                {track.is_vault && <span className="text-purple-400 text-xs">🔐 Vault</span>}
                <span className="text-gray-400 text-sm">{track.play_count} plays</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="mb-10">
          <h2 className="text-xl font-bold mb-4">Recent Earnings</h2>
          <div className="space-y-2">
            {data.recent_transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <div>
                  <span className="text-gray-400 text-sm capitalize">{tx.type.replace(/_/g, " ")}</span>
                  <span className="text-gray-600 text-xs ml-2">from {tx.users?.name || "fan"}</span>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-bold">+₹{(tx.artist_payout_paise / 100).toFixed(0)}</p>
                  <p className="text-gray-600 text-xs">₹{(tx.amount_paise / 100).toFixed(0)} total</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upload Track */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="text-xl font-bold mb-4">Upload New Track</h2>
          <form onSubmit={handleUpload} className="space-y-4 max-w-lg">
            <input
              type="text"
              placeholder="Track title"
              value={uploadForm.title}
              onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              required
            />
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files[0])}
              className="w-full text-gray-400 text-sm"
            />
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={uploadForm.is_vault}
                onChange={(e) => setUploadForm({ ...uploadForm, is_vault: e.target.checked })}
                className="w-4 h-4 accent-purple-500"
              />
              <span className="text-gray-300">Vault track (paid access only)</span>
            </label>
            {uploadForm.is_vault && (
              <div>
                <label className="text-gray-400 text-sm block mb-1">Price (₹)</label>
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
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors"
            >
              {uploading ? "Uploading..." : "Upload Track"}
            </button>
          </form>
        </div>
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
