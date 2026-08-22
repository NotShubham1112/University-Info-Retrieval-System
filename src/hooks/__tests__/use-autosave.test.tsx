// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutosave } from "@/hooks/use-autosave";

describe("useAutosave", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  it("round-trip debounced write and restore with banner", async () => {
    const key = "test:autosave:1";
    const initial = { first_name: "Rahul", email: "r@example.com" } as Record<string, unknown>;

    const { result, rerender } = renderHook(
      ({ value }) => useAutosave({ key, value, delay: 10, enabled: true }),
      { initialProps: { value: initial } },
    );

    // initially no draft
    expect(result.current.hasDraft).toBe(false);
    expect(result.current.showBanner).toBe(false);

    // update value -> should debounce write
    const next = { first_name: "Priya", email: "p@example.com" } as Record<string, unknown>;
    rerender({ value: next });

    // advance timers to trigger debounce
    act(() => {
      vi.advanceTimersByTime(20);
    });

    // value should be persisted
    const raw = window.localStorage.getItem(`autosave:${key}`);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual(next);

    // new hook instance should restore draft with banner
    const { result: result2 } = renderHook(() => useAutosave({ key, value: { first_name: "", email: "" }, delay: 10 }));
    expect(result2.current.hasDraft).toBe(true);
    expect(result2.current.showBanner).toBe(true);

    // restore returns draft
    const draft = result2.current.restore();
    expect(draft).toEqual(next);

    // dismiss banner hides it
    act(() => {
      result2.current.dismissBanner();
    });
    expect(result2.current.showBanner).toBe(false);

    // clearDraft removes storage
    act(() => {
      result2.current.clearDraft();
    });
    expect(window.localStorage.getItem(`autosave:${key}`)).toBeNull();
    expect(result2.current.hasDraft).toBe(false);

    vi.useRealTimers();
  });

  it("does not save empty drafts", async () => {
    const key = "test:empty";
    const empty = { first_name: "", email: "" } as Record<string, unknown>;
    renderHook(() => useAutosave({ key, value: empty, delay: 10 }));
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(window.localStorage.getItem(`autosave:${key}`)).toBeNull();
    vi.useRealTimers();
  });
});
