"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { setTheme, theme, systemTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800 transition-colors">
        <Sun className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </button>
    );
  }

  const currentTheme = theme === "system" ? systemTheme : theme;

  return (
    <button
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-0"
      onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
      aria-label="切换主题"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-yellow-500" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-indigo-400" />
    </button>
  );
}
