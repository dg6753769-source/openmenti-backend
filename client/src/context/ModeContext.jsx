import { createContext, useContext, useState } from "react";

// Controls the Dual-Mode UI: "stream" (default) | "vault" (commerce layer)
const ModeContext = createContext(null);

export const ModeProvider = ({ children }) => {
  const [mode, setMode] = useState("stream");
  const [vaultArtist, setVaultArtist] = useState(null);

  const openVault = (artist) => {
    setVaultArtist(artist);
    setMode("vault");
  };

  const closeVault = () => {
    setMode("stream");
    setVaultArtist(null);
  };

  return (
    <ModeContext.Provider value={{ mode, vaultArtist, openVault, closeVault }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => useContext(ModeContext);
