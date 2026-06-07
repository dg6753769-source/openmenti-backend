import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { PlayerProvider } from "./context/PlayerContext";
import { ModeProvider } from "./context/ModeContext";
import Navbar from "./components/common/Navbar";
import AudioPlayer from "./components/player/AudioPlayer";
import VaultOverlay from "./components/vault/VaultOverlay";
import Home from "./pages/Home";
import Discover from "./pages/Discover";
import ArtistProfile from "./pages/ArtistProfile";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PlayerProvider>
          <ModeProvider>
            <div className="bg-black min-h-screen">
              <Navbar />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/artist/:id" element={<ArtistProfile />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/login" element={<Auth mode="login" />} />
                <Route path="/register" element={<Auth mode="register" />} />
              </Routes>

              {/* Global persistent player — stays alive across route changes */}
              <AudioPlayer />

              {/* Dual-mode vault overlay — slides over streaming UI */}
              <VaultOverlay />

              <Toaster
                position="top-right"
                toastOptions={{
                  style: { background: "#1a1a1a", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" },
                }}
              />
            </div>
          </ModeProvider>
        </PlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
