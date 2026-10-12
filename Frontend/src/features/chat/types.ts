export interface ChatUser {
  id: string;
  name: string;
  email: string;
  image: string;
}

/** One row in the Chats tab. Comes from the backend session list. */
export interface SessionSummary {
  id: string; // the backend session_id
  title: string;
  updatedAt: number; // ms
}

export type DocStatus = "uploading" | "indexing" | "ready" | "failed";

export interface DocItem {
  id: string;
  name: string;
  size: number;
  mime: string;
  addedAt: number;
  status: DocStatus;
  error?: string;
}
