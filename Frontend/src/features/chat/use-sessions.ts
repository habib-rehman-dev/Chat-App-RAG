"use client";

import { useCallback, useEffect, useState } from "react";
import { sessionsApi } from "./sessions-api";
import type { SessionSummary } from "./types";

export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSessions(await sessionsApi.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load chats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await sessionsApi.remove(id);
    setSessions((p) => p.filter((s) => s.id !== id));
  }, []);

  return { sessions, loading, error, refresh, remove };
}
