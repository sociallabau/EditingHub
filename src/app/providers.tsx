"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { LinkProvider } from "@astryxdesign/core/Link";
import { chocolateTheme } from "@astryxdesign/theme-chocolate/built";

type Mode = "light" | "dark";
const ModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({ mode: "dark", setMode: () => {} });
export const useColorMode = () => useContext(ModeContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>("dark");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("eh-mode");
      if (saved === "dark" || saved === "light") setModeState(saved);
    } catch {}
  }, []);
  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem("eh-mode", m);
    } catch {}
  }, []);
  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      <Theme theme={chocolateTheme} mode={mode}>
        <LinkProvider component={Link}>{children}</LinkProvider>
      </Theme>
    </ModeContext.Provider>
  );
}
