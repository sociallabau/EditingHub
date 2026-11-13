import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0e0e10",
        panel: "#141416",
        card: "#1a1a1d",
        hover: "#222226",
        line: "#2a2a2e",
        muted: "#8b8b93",
        accent: "#f2542d",
      },
      fontSize: { xxs: ["11px", "14px"] },
    },
  },
  plugins: [],
} satisfies Config;
