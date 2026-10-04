import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

const THEME_KEY = "philfida.theme";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // private mode etc. — fall through to system preference
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore write failures (private mode)
    }
  }, [theme]);

  const isDark = theme === "dark";

  function toggleTheme() {
    // Briefly enable color transitions so the flip feels smooth instead of
    // jarring. Skipped entirely for users who prefer reduced motion.
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      document.documentElement.classList.add("theme-transition");
      window.setTimeout(() => {
        document.documentElement.classList.remove("theme-transition");
      }, 450);
    }
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="h-9 w-9"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
