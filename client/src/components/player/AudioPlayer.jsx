import { usePlayer } from "../../context/PlayerContext";
import { useMode } from "../../context/ModeContext";

export default function AudioPlayer() {
  const { currentTrack, isPlaying, progress, volume, togglePlay, seek, playNext, playPrev, changeVolume } = usePlayer();
  const { openVault } = useMode();

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-t border-white/10 px-6 py-4">
      <div className="max-w-screen-xl mx-auto flex items-center gap-6">

        {/* Track info */}
        <div className="flex items-center gap-3 w-64 min-w-0">
          {currentTrack.cover_art_url && (
            <img
              src={currentTrack.cover_art_url}
              alt={currentTrack.title}
              className="w-12 h-12 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{currentTrack.title}</p>
            <p className="text-gray-400 text-xs truncate">
              {currentTrack.artist_profiles?.users?.name || "Artist"}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="flex items-center gap-6">
            <button onClick={playPrev} className="text-gray-400 hover:text-white transition-colors">
              <PrevIcon />
            </button>
            <button
              onClick={togglePlay}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button onClick={playNext} className="text-gray-400 hover:text-white transition-colors">
              <NextIcon />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-md flex items-center gap-2">
            <div
              className="flex-1 h-1 bg-white/20 rounded-full cursor-pointer relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - rect.left) / rect.width) * 100);
              }}
            >
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Volume + Vault CTA */}
        <div className="flex items-center gap-4 w-64 justify-end">
          <div className="flex items-center gap-2">
            <VolumeIcon />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="w-20 accent-purple-500"
            />
          </div>

          {/* The signature Dual-Mode button */}
          <button
            onClick={() => openVault(currentTrack.artist_profiles)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold px-4 py-2 rounded-full transition-all hover:scale-105 shadow-lg shadow-purple-900/50"
          >
            <span>🔐</span>
            <span>Unlock Vault</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const PlayIcon = () => (
  <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const PrevIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
  </svg>
);

const NextIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6 18l8.5-6L6 6v12zm2-8.14 5.16 3.64L8 17.14V9.86zm7 8.14h2V6h-2v12z" />
  </svg>
);

const VolumeIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
  </svg>
);
