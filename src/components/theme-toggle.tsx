"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Render identical placeholder on server and first client paint to avoid
  // hydration mismatch (react.dev/link/hydration-mismatch at src/components/theme-toggle.tsx:18).
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled suppressHydrationWarning>
        <Moon className="h-4 w-4" />
      </Button>
    );
  }

  const dark = (resolvedTheme ?? theme) === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      suppressHydrationWarning
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
