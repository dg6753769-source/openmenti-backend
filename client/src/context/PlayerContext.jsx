import { createContext, useContext, useState, useRef, useCallback } from "react";
import api from "../services/api";

const PlayerContext = createContext(null);

export const PlayerProvider = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [queue, setQueue] = useState([]);
  const audioRef = useRef(null);

  const loadAndPlay = useCallback(async (track) => {
    try {
      const res = await api.get(`/music/${track.id}/stream`);
      const url = res.data.url;

      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(url);
      audioRef.current.volume = volume;

      audioRef.current.ontimeupdate = () => {
        const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setProgress(pct || 0);
      };

      audioRef.current.onended = () => {
        setIsPlaying(false);
        playNext();
      };

      await audioRef.current.play();
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
    if (!audioRef.current) return;
    audioRef.current.currentTime = (pct / 100) * audioRef.current.duration;
  };

  const playNext = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    if (idx < queue.length - 1) loadAndPlay(queue[idx + 1]);
  }, [currentTrack, queue, loadAndPlay]);

  const playPrev = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    if (idx > 0) loadAndPlay(queue[idx - 1]);
  }, [currentTrack, queue, loadAndPlay]);

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

export const usePlayer = () => useContext(PlayerContext);
