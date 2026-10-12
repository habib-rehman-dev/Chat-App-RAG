"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store (SSR safe). Swap for real API calls once
 * the backend exists; components only see `[value, update]`.
 */
const listeners = new Set<() => void>();
const cache = new Map<string, unknown>();

function load<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let value = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = JSON.parse(raw) as T;
  } catch {
    /* corrupted or unavailable storage: use fallback */
  }
  cache.set(key, value);
  return value;
}

export function useStored<T>(key: string, fallback: T) {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => load(key, fallback),
    () => fallback,
  );

  const update = useCallback(
    (fn: (prev: T) => T) => {
      const next = fn(load(key, fallback));
      cache.set(key, next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* quota exceeded: keep in-memory value */
      }
      listeners.forEach((l) => l());
    },
    [key, fallback],
  );

  return [value, update] as const;
}

export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
