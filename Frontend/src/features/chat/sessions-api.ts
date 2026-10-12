import type { UIMessage } from "ai";
import type { SessionSummary } from "./types";

/**
 * Session API -> your FastAPI backend, through the existing
 * /api/backend/[...path] proxy (it attaches the Auth.js bearer token).
 *
 * ASSUMED CONTRACT (edit ROUTES / normalisers below to match your backend):
 *   GET    /api/sessions        -> [{ session_id, title, updated_at }]
 *   GET    /api/sessions/{id}   -> { messages: [{ role, content }] }   (or UIMessage[] with `parts`)
 *   DELETE /api/sessions/{id}
 * The proxy maps /api/backend/<path> -> BACKEND_URL/<path>.
 */
const PROXY = "/api/backend";
const ROUTES = {
  list: "/api/sessions",
  one: (id: string) => `/api/sessions/${encodeURIComponent(id)}`,
};

type Raw = Record<string, unknown>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PROXY}${path}`, { cache: "no-store", ...init });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as Raw;
      detail = typeof body.detail === "string" ? body.detail : "";
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** crypto.randomUUID only exists on localhost/HTTPS; fall back so "New chat" never throws. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function toMs(v: unknown): number {
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

function toSummary(r: Raw): SessionSummary {
  return {
    id: String(r.session_id ?? r.id ?? r.sessionId ?? ""),
    title: String(r.title ?? r.name ?? "").trim() || "New chat",
    updatedAt: toMs(r.updated_at ?? r.updatedAt ?? r.created_at ?? r.createdAt),
  };
}

function toRole(v: unknown): "user" | "assistant" | null {
  if (v === "user" || v === "human") return "user";
  if (v === "assistant" || v === "ai") return "assistant";
  return null; // system/tool rows are not shown
}

function toUIMessage(r: Raw): UIMessage | null {
  const role = toRole(r.role ?? r.type);
  if (!role) return null;
  const id = String(r.id ?? newId());
  if (Array.isArray(r.parts)) return { id, role, parts: r.parts } as UIMessage;
  const text = typeof r.content === "string" ? r.content : typeof r.text === "string" ? r.text : "";
  return { id, role, parts: [{ type: "text", text }] };
}

export const sessionsApi = {
  async list(): Promise<SessionSummary[]> {
    const data = await request<unknown>(ROUTES.list);
    const rows = Array.isArray(data) ? data : ((data as Raw)?.sessions ?? (data as Raw)?.items ?? []);
    return (rows as Raw[])
      .map(toSummary)
      .filter((s) => s.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async get(id: string): Promise<UIMessage[]> {
    const data = await request<unknown>(ROUTES.one(id));
    const rows = Array.isArray(data) ? data : ((data as Raw)?.messages ?? (data as Raw)?.history ?? []);
    return (rows as Raw[]).map(toUIMessage).filter((m): m is UIMessage => m !== null);
  },

  async remove(id: string): Promise<void> {
    await request<void>(ROUTES.one(id), { method: "DELETE" });
  },
};
