import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import { usePlayer } from "../context/PlayerContext";
import { useMode } from "../context/ModeContext";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function ArtistProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { loadAndPlay, setQueue } = usePlayer();
  const { openVault } = useMode();
  const [artist, setArtist] = useState(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/artists/${id}`)
      .then((res) => { setArtist(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const handleFollow = async () => {
    if (!user) { toast.error("Sign in to follow artists"); return; }
    try {
      if (following) {
        await api.delete(`/fan/follow/${id}`);
        setFollowing(false);
        toast.success("Unfollowed");
      } else {
        await api.post(`/fan/follow/${id}`);
        setFollowing(true);
        toast.success("Following!");
      }
    } catch { toast.error("Action failed"); }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  if (!artist) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Artist not found</div>;

  const publicTracks = artist.tracks?.filter((t) => !t.is_vault) || [];
  const vaultCount = artist.tracks?.filter((t) => t.is_vault).length || 0;

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-32">
      {/* Artist Header */}
      <div className="relative h-64 bg-gradient-to-b from-purple-900/50 to-black">
        <div className="absolute bottom-0 left-0 right-0 px-8 pb-8 flex items-end gap-6">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-5xl font-black border-4 border-black">
            {artist.users?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="text-gray-400 text-sm uppercase tracking-wider">Artist</p>
            <h1 className="text-4xl font-black">{artist.users?.name}</h1>
            <p className="text-gray-400 mt-1">{artist.genre}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleFollow}
              className={`px-6 py-2.5 rounded-full font-bold text-sm border transition-colors ${
                following
                  ? "border-white text-white hover:bg-white/10"
                  : "bg-white text-black hover:bg-gray-200"
              }`}
            >
              {following ? "Following" : "Follow"}
            </button>
            <button
              onClick={() => openVault(artist)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-6 py-2.5 rounded-full text-sm flex items-center gap-2 transition-all hover:scale-105"
            >
              🔐 Unlock Vault {vaultCount > 0 && `(${vaultCount})`}
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 mt-8">
        {/* Bio */}
        {artist.bio && (
          <p className="text-gray-400 max-w-2xl mb-6 leading-relaxed">{artist.bio}</p>
        )}

        {/* Social links */}
        {artist.social_links && Object.keys(artist.social_links).length > 0 && (
          <div className="flex gap-3 mb-8 flex-wrap">
            {Object.entries(artist.social_links).map(([platform, handle]) => {
              if (!handle) return null;
              const cfg = {
                instagram: { label: "Instagram", icon: "📷", href: `https://instagram.com/${handle.replace(/^@/, "")}` },
                twitter:   { label: "Twitter",   icon: "𝕏",   href: `https://twitter.com/${handle.replace(/^@/, "")}` },
                spotify:   { label: "Spotify",   icon: "🎧",  href: handle.startsWith("http") ? handle : `https://open.spotify.com/artist/${handle}` },
                youtube:   { label: "YouTube",   icon: "▶️",  href: handle.startsWith("http") ? handle : `https://youtube.com/${handle}` },
              };
              const info = cfg[platform];
              if (!info) return null;
              return (
                <a
                  key={platform}
                  href={info.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <span>{info.icon}</span>
                  <span>{info.label}</span>
                </a>
              );
            })}
          </div>
        )}

        {/* Living Room teaser */}
        <div className="mb-10 p-5 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-2xl border border-purple-500/20 max-w-2xl">
          <h3 className="text-white font-bold text-lg mb-1">🏠 Living Room</h3>
          <p className="text-gray-400 text-sm">
            {artist.living_room_description || "Exclusive access — raw tracks, voice notes, studio sessions"}
          </p>
          <button
            onClick={() => openVault(artist)}
            className="mt-3 text-purple-400 text-sm font-medium hover:text-purple-300 transition-colors"
          >
            ₹{((artist.living_room_price_paise || 19900) / 100).toFixed(0)}/mo → Join →
          </button>
        </div>

        {/* Public Tracks */}
        <h2 className="text-xl font-bold mb-4">Popular</h2>
        <div className="space-y-2 max-w-3xl">
          {publicTracks.length === 0 && (
            <p className="text-gray-500">No public tracks yet</p>
          )}
          {publicTracks.map((track, idx) => (
            <div
              key={track.id}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer"
              onClick={() => { setQueue(publicTracks); loadAndPlay({ ...track, artist_profiles: artist }); }}
            >
              <span className="text-gray-600 text-sm w-4">{idx + 1}</span>
              <div className="w-10 h-10 bg-purple-900/50 rounded-lg flex items-center justify-center text-sm">
                🎵
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{track.title}</p>
              </div>
              <span className="text-gray-600 text-sm">{track.play_count} plays</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
