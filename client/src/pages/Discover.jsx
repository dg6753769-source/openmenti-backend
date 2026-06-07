import { useEffect, useState } from "react";
import api from "../services/api";
import { usePlayer } from "../context/PlayerContext";
import { useMode } from "../context/ModeContext";
import { Link } from "react-router-dom";

export default function Discover() {
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { loadAndPlay, setQueue } = usePlayer();
  const { openVault } = useMode();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/music?limit=30`),
      api.get(`/artists?limit=20`),
    ]).then(([t, a]) => {
      setTracks(t.data || []);
      setArtists(a.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filteredTracks = tracks.filter((t) =>
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.artist_profiles?.users?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-32 px-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-black mb-6">Discover</h1>

        <input
          type="text"
          placeholder="Search tracks and artists..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-5 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-8 text-lg"
        />

        {/* Artists row */}
        <div className="mb-10">
          <h2 className="text-lg font-bold mb-4 text-gray-300">Artists</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {artists.map((artist) => (
              <Link
                key={artist.id}
                to={`/artist/${artist.id}`}
                className="flex-shrink-0 flex flex-col items-center gap-2 group"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-3xl font-black border-2 border-transparent group-hover:border-purple-400 transition-colors">
                  {artist.users?.name?.[0]?.toUpperCase()}
                </div>
                <p className="text-gray-300 text-xs text-center max-w-[80px] truncate">
                  {artist.users?.name}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Tracks */}
        <div>
          <h2 className="text-lg font-bold mb-4 text-gray-300">
            {search ? `Results for "${search}"` : "All Tracks"}
          </h2>
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : filteredTracks.length === 0 ? (
            <p className="text-gray-500">No tracks found</p>
          ) : (
            <div className="grid gap-2">
              {filteredTracks.map((track, idx) => (
                <div
                  key={track.id}
                  className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group cursor-pointer"
                  onClick={() => { setQueue(filteredTracks); loadAndPlay(track); }}
                >
                  <div className="w-12 h-12 bg-purple-900/50 rounded-lg flex items-center justify-center text-xl flex-shrink-0">
                    {track.cover_art_url
                      ? <img src={track.cover_art_url} alt="" className="w-full h-full object-cover rounded-lg" />
                      : "🎵"
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{track.title}</p>
                    <p className="text-gray-400 text-sm truncate">
                      {track.artist_profiles?.users?.name || "Unknown Artist"}
                    </p>
                  </div>
                  <span className="text-gray-600 text-sm hidden md:block">{track.play_count || 0} plays</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); openVault(track.artist_profiles); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-purple-600 hover:bg-purple-500 text-white text-xs px-3 py-1.5 rounded-full"
                  >
                    🔐 Vault
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
