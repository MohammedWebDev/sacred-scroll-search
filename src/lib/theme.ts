import { useCallback, useEffect, useState } from "react";

const KEY = "raqeem-theme";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) as
      | "light"
      | "dark"
      | null;
    const prefers =
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = stored ?? (prefers ? "dark" : "light");
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
