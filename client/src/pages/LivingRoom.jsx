import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMode } from "../context/ModeContext";
import api from "../services/api";
import toast from "react-hot-toast";

const TYPE_ICONS = {
  voice_note: "🎙️",
  demo_track: "🎵",
  livestream: "🎥",
  studio_session: "🎚️",
};

export default function LivingRoom() {
  const { artistId } = useParams();
  const { user } = useAuth();
  const { openVault } = useMode();
  const navigate = useNavigate();
  const [membership, setMembership] = useState(null);
  const [content, setContent] = useState([]);
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }

    const init = async () => {
      try {
        const [artistRes, membershipRes] = await Promise.all([
          api.get(`/artists/${artistId}`),
          api.get(`/commerce/living-room/${artistId}/membership`),
        ]);
        setArtist(artistRes.data);
        setMembership(membershipRes.data);

        if (membershipRes.data?.is_member) {
          const contentRes = await api.get(`/commerce/living-room/${artistId}/content`);
          setContent(contentRes.data || []);
        }
      } catch {
        toast.error("Failed to load living room");
      } finally {
        setLoading(false);
      }
    };
    init();

    return () => { audioRef.current?.pause(); };
  }, [user, artistId, navigate]);

  const playContent = (item) => {
    if (!item.url) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    const el = new Audio(item.url);
    el.play().catch(() => toast.error("Playback failed"));
    el.onended = () => setPlaying(null);
    audioRef.current = el;
    setPlaying(item.id);
  };

  const stopPlaying = () => {
    audioRef.current?.pause();
    setPlaying(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>
  );

  if (!membership?.is_member) {
    return (
      <div className="min-h-screen bg-black text-white pt-20 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-4">🏠</div>
          <h2 className="text-2xl font-black mb-2">
            {artist?.users?.name}'s Living Room
          </h2>
          <p className="text-gray-400 mb-2">
            {artist?.living_room_description || "Exclusive access to raw demos, voice notes, and studio sessions."}
          </p>
          <p className="text-purple-300 font-bold text-xl mb-6">
            ₹{((artist?.living_room_price_paise || 19900) / 100).toFixed(0)}/month
          </p>
          <button
            onClick={() => openVault(artist)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-8 py-4 rounded-full text-lg transition-all hover:scale-105"
          >
            Join the Living Room
          </button>
          <p className="text-gray-600 text-xs mt-4">Cancel anytime · 90% goes to the artist</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-32 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-2xl font-black">
            {artist?.users?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">{artist?.users?.name}'s Living Room</h1>
              <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full border border-green-500/30">
                Member
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              Access until {new Date(membership.membership?.current_period_end).toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>

        <p className="text-gray-400 text-sm mb-8 ml-18">
          {artist?.living_room_description}
        </p>

        {/* Content Feed */}
        {content.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">🎙️</div>
            <p>No exclusive content yet — check back soon</p>
          </div>
        ) : (
          <div className="space-y-3">
            {content.map((item) => (
              <div key={item.id} className="bg-white/5 rounded-xl p-5 border border-white/10 hover:border-purple-500/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{TYPE_ICONS[item.type] || "🎵"}</span>
                    <div className="min-w-0">
                      <p className="text-white font-medium">{item.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5 capitalize">{item.type?.replace(/_/g, " ")}</p>
                      {item.description && (
                        <p className="text-gray-400 text-sm mt-2">{item.description}</p>
                      )}
                      <p className="text-gray-600 text-xs mt-2">
                        {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {item.url && (
                    <button
                      onClick={() => playing === item.id ? stopPlaying() : playContent(item)}
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        playing === item.id
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-white/10 hover:bg-purple-600"
                      }`}
                    >
                      {playing === item.id ? (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
