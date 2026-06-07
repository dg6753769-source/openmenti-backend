import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { usePlayer } from "../context/PlayerContext";
import { useMode } from "../context/ModeContext";

export default function Home() {
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const { loadAndPlay, setQueue } = usePlayer();
  const { openVault } = useMode();

  useEffect(() => {
    Promise.all([
      api.get("/music?limit=10"),
      api.get("/artists?limit=6"),
    ]).then(([tracksRes, artistsRes]) => {
      setTracks(tracksRes.data || []);
      setArtists(artistsRes.data || []);
    }).catch(console.error);
  }, []);

  const handlePlay = (track, idx) => {
    setQueue(tracks);
    loadAndPlay(track);
  };

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-32">
      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto">
        <h1 className="text-6xl font-black leading-tight mb-6">
          Music the way{" "}
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            artists deserve
          </span>
        </h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-8">
          Stream free. Pay directly. 90% of every rupee goes straight to the artist.
          No labels. No middlemen. No bullshit.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/discover"
            className="bg-white text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-transform text-lg"
          >
            Start Listening
          </Link>
          <Link
            to="/register?role=artist"
            className="border border-white/30 text-white font-bold px-8 py-4 rounded-full hover:bg-white/10 transition-colors text-lg"
          >
            I'm an Artist →
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-12 mt-16 text-center">
          {[
            { label: "Platform fee", value: "10%" },
            { label: "Artist earnings", value: "90%" },
            { label: "Payment delay", value: "Instant" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-4xl font-black text-purple-400">{stat.value}</p>
              <p className="text-gray-500 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Tracks */}
      <section className="px-6 max-w-6xl mx-auto mb-16">
        <h2 className="text-2xl font-bold mb-6">Featured Tracks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tracks.map((track, idx) => (
            <TrackRow
              key={track.id}
              track={track}
              onPlay={() => handlePlay(track, idx)}
              onVault={() => openVault(track.artist_profiles)}
            />
          ))}
        </div>
      </section>

      {/* Artists */}
      <section className="px-6 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Discover Artists</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {artists.map((artist) => (
            <Link
              key={artist.id}
              to={`/artist/${artist.id}`}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-2xl font-black text-white">
                {artist.users?.name?.[0]?.toUpperCase() || "A"}
              </div>
              <p className="text-white text-sm font-medium text-center">{artist.users?.name}</p>
              <p className="text-gray-500 text-xs">{artist.genre || "Artist"}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrackRow({ track, onPlay, onVault }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors group">
      <button
        onClick={onPlay}
        className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-purple-500 transition-colors"
      >
        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{track.title}</p>
        <p className="text-gray-400 text-sm truncate">
          {track.artist_profiles?.users?.name || "Artist"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-600 text-xs">{track.play_count || 0} plays</span>
        <button
          onClick={onVault}
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-purple-600/80 hover:bg-purple-600 text-white text-xs px-3 py-1.5 rounded-full font-medium"
        >
          🔐 Vault
        </button>
      </div>
    </div>
  );
}
