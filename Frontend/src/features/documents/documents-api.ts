/**
 * Document API layer. Currently a stub (no backend yet).
 * When FastAPI is ready, implement these against /api/documents (Next proxy):
 *   POST   /api/documents        multipart "file"  -> index the file for this user
 *   DELETE /api/documents/:id                      -> remove file + its vectors
 *   GET    /api/documents                          -> list this user's files
 */
export const documentsApi = {
  async upload(file: File, id: string): Promise<void> {
    void file;
    void id;
    // const body = new FormData();
    // body.append("file", file);
    // body.append("id", id);
    // const res = await fetch("/api/documents", { method: "POST", body });
    // if (!res.ok) throw new Error((await res.json()).detail ?? "Upload failed");
    await new Promise((r) => setTimeout(r, 900));
  },

  async remove(id: string): Promise<void> {
    void id;
    // const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    // if (!res.ok) throw new Error("Delete failed");
  },
};
