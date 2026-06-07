import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import api from "../services/api";

const PlayerContext = createContext(null);

export const PlayerProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [queue, setQueue] = useState([]);
  const audioRef = useRef(null);

  // Ref always points to latest queue + currentTrack — avoids stale closures in audio callbacks
  const queueRef = useRef(queue);
  const currentTrackRef = useRef(currentTrack);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  const loadAndPlay = useCallback(async (track) => {
    try {
      const res = await api.get(`/music/${track.id}/stream`);
      const url = res.data.url;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.ontimeupdate = null;
        audioRef.current.onended = null;
      }

      const audio = new Audio(url);
      audio.volume = volume;
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        const pct = (audio.currentTime / audio.duration) * 100;
        setProgress(Number.isFinite(pct) ? pct : 0);
      };

      // Use refs so this callback always sees the latest queue/currentTrack
      audio.onended = () => {
        setIsPlaying(false);
        const q = queueRef.current;
        const ct = currentTrackRef.current;
        if (!ct || q.length === 0) return;
        const idx = q.findIndex((t) => t.id === ct.id);
        if (idx < q.length - 1) loadAndPlay(q[idx + 1]);
      };

      await audio.play();
      setCurrentTrack(track);
      setIsPlaying(true);
    } catch (err) {
      console.error("Playback failed:", err);
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const seek = (pct) => {
    if (!audioRef.current || !Number.isFinite(audioRef.current.duration)) return;
    audioRef.current.currentTime = (pct / 100) * audioRef.current.duration;
  };

  const playNext = useCallback(() => {
    const q = queueRef.current;
    const ct = currentTrackRef.current;
    if (!ct || q.length === 0) return;
    const idx = q.findIndex((t) => t.id === ct.id);
    if (idx < q.length - 1) loadAndPlay(q[idx + 1]);
  }, [loadAndPlay]);

  const playPrev = useCallback(() => {
    const q = queueRef.current;
    const ct = currentTrackRef.current;
    if (!ct || q.length === 0) return;
    const idx = q.findIndex((t) => t.id === ct.id);
    if (idx > 0) loadAndPlay(q[idx - 1]);
  }, [loadAndPlay]);

  const changeVolume = (v) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  return (
    <PlayerContext.Provider value={{
      currentTrack, isPlaying, progress, volume, queue,
      loadAndPlay, togglePlay, seek, playNext, playPrev,
      changeVolume, setQueue,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePlayer = () => useContext(PlayerContext);
