"use client";

import * as React from "react";

/**
 * Debounced autosave to localStorage (Task 6 spec §3).
 * - Debounce 800ms to localStorage keyed by form id.
 * - Restores on mount with a "Resume draft?" banner (caller renders banner).
 *
 * Only used in student add/edit + import forms (G7).
 */

export interface UseAutosaveOptions<T> {
  /** Unique key per form, e.g. `student:create` or `student:edit:42` */
  key: string;
  /** Current form values */
  value: T;
  /** Debounce in ms (default 800) */
  delay?: number;
  /** Whether autosave is enabled (default true) */
  enabled?: boolean;
}

export interface UseAutosaveReturn<T> {
  /** Draft restored from localStorage on mount, or null */
  draft: T | null;
  /** Whether a draft exists in localStorage */
  hasDraft: boolean;
  /** Clear the draft from storage */
  clearDraft: () => void;
  /** Dismiss banner without clearing (hides banner until next mount) */
  dismissBanner: () => void;
  /** Whether banner should be shown (hasDraft && not dismissed) */
  showBanner: boolean;
  /** Restore draft by calling the caller's restore callback */
  restore: () => T | null;
}

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or unavailable — non-fatal
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

export function useAutosave<T>(options: UseAutosaveOptions<T>): UseAutosaveReturn<T> {
  const { key, value, delay = 800, enabled = true } = options;
  const storageKey = `autosave:${key}`;

  // Restore synchronously on first render where possible (avoid flash)
  const [draft, setDraft] = React.useState<T | null>(() => safeGet<T>(storageKey));
  const [dismissed, setDismissed] = React.useState(false);
  const hasDraft = draft !== null;
  const showBanner = hasDraft && !dismissed;

  // Debounced write
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValueRef = React.useRef<string>("");

  React.useEffect(() => {
    if (!enabled) return;
    // Don't save if value is empty-ish (e.g. initial defaults with empty strings only)
    // We still save — caller decides what "empty" means; we avoid thrash by comparing JSON
    const serialized = JSON.stringify(value);
    if (serialized === lastValueRef.current) return;
    lastValueRef.current = serialized;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      // Avoid saving trivial empty drafts: if all string fields are empty -> skip
      const isEmpty = (() => {
        try {
          const obj = value as Record<string, unknown>;
          const keys = Object.keys(obj);
          if (keys.length === 0) return true;
          // consider non-empty if any string with length > 0 or any non-null number
          for (const v of Object.values(obj)) {
            if (typeof v === "string" && v.trim().length > 0) return false;
            if (typeof v === "number" && !Number.isNaN(v)) return false;
            if (v !== null && v !== undefined && v !== "" && (typeof v !== "object" || Object.keys(v as object).length > 0)) return false;
          }
          return true;
        } catch {
          return false;
        }
      })();
      if (!isEmpty) {
        safeSet(storageKey, value);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [storageKey, value, delay, enabled]);

  const clearDraft = React.useCallback(() => {
    safeRemove(storageKey);
    setDraft(null);
    setDismissed(false);
  }, [storageKey]);

  const dismissBanner = React.useCallback(() => setDismissed(true), []);

  const restore = React.useCallback(() => {
    const d = safeGet<T>(storageKey);
    if (d) setDraft(d);
    return d;
  }, [storageKey]);

  // Keep draft in sync if storage changes externally (e.g., clearDraft from another tab)
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) {
        try {
          const next = e.newValue ? (JSON.parse(e.newValue) as T) : null;
          setDraft(next);
          setDismissed(false);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  return { draft, hasDraft, clearDraft, dismissBanner, showBanner, restore };
}
