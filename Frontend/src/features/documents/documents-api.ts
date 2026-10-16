/**
 * Document API — talks to Next.js proxy routes, which forward to FastAPI.
 *
 *   POST   /api/documents              multipart "file"  → upload + start ingestion
 *   GET    /api/documents              → list this user's files with status
 *   DELETE /api/documents/:id          → delete file + vectors
 */

export interface RemoteDoc {
  id: string;
  filename: string;
  status: "pending" | "processing" | "ready" | "failed";
  size: number;
  error?: string;
  created_at?: string;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    return body.detail ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export const documentsApi = {
  async upload(file: File): Promise<{ document_id: string; status: string }> {
    const body = new FormData();
    body.append("file", file);

    const res = await fetch("/api/documents", { method: "POST", body });
    if (!res.ok) throw new Error(await readError(res));
    return (await res.json()) as { document_id: string; status: string };
  },

  async list(): Promise<RemoteDoc[]> {
    const res = await fetch("/api/documents", { cache: "no-store" });
    if (!res.ok) throw new Error(await readError(res));
    const data = (await res.json()) as RemoteDoc[] | { documents: RemoteDoc[] };
    return Array.isArray(data) ? data : data.documents;
  },

  async remove(id: string): Promise<void> {
    const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(await readError(res));
  },
};