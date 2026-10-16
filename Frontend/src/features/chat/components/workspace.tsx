"use client";
import {
  documentsApi,
  type RemoteDoc,
} from "@/features/documents/documents-api";
import type { UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { documentsApi } from "@/featuresdocuments/uploaddocuments/upload-api";
import { ChatView } from "./chat-view";
import { ChatsPanel } from "./chats-panel";
import { SourcesPanel } from "./sources-panel";
import { newId, sessionsApi } from "../sessions-api";
import { useSessions } from "../use-sessions";
import { useHydrated, useStored } from "../storage";
import type { ChatUser, DocItem, DocStatus, SessionSummary } from "../types";

const EMPTY_DOCS: DocItem[] = [];
const EMPTY_IDS: string[] = [];
const NEW_CHAT = "New chat";

type Pending = { kind: "chat" | "doc"; id: string } | null;

const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

export function Workspace({ user }: { user: ChatUser }) {
  // Chat sessions live on the backend. Only the file list/selection is local for now.
  const { sessions, error: sessionsError, refresh, remove } = useSessions();
  const [docs, updateDocs] = useStored<DocItem[]>(
    `rag:${user.id}:docs`,
    EMPTY_DOCS,
  );
  const [selected, updateSelected] = useStored<string[]>(
    `rag:${user.id}:selected`,
    EMPTY_IDS,
  );
  const hydrated = useHydrated();

  // First screen is an unsaved draft; the backend creates the session on its first message.
  const [boot] = useState(() => {
    const id = newId();
    return { id, initial: { [id]: [] as UIMessage[] } };
  });
  const [activeId, setActiveId] = useState(boot.id);
  // Messages each opened session starts from (fetched from the backend, or [] for a draft).
  const [initial, setInitial] = useState<Record<string, UIMessage[]>>(
    boot.initial,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const readyDocs = docs.filter((d) => d.status === "ready");
  const selectedIds = selected.filter((id) =>
    readyDocs.some((d) => d.id === id),
  );
  const selectedDocs = readyDocs.filter((d) => selectedIds.includes(d.id));

  const activeSession = sessions.find((s) => s.id === activeId);
  const isDraft = !activeSession;
  const listItems: SessionSummary[] = isDraft
    ? [{ id: activeId, title: NEW_CHAT, updatedAt: 0 }, ...sessions]
    : sessions;

  const toLocalStatus = (s: RemoteDoc["status"]): DocStatus =>
    s === "pending" || s === "processing" ? "indexing" : s;

  const files = useRef(new Map<string, File>());

  // Load history for a past session the first time it is opened.
  useEffect(() => {
    if (initial[activeId] !== undefined) return;
    let cancelled = false;
    sessionsApi
      .get(activeId)
      .then((messages) => {
        if (!cancelled) setInitial((p) => ({ ...p, [activeId]: messages }));
      })
      .catch((e) => {
        if (!cancelled)
          setNotice(`Could not open this chat: ${errMsg(e, "unknown error")}`);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, initial]);

  /* ---------- chats ---------- */

  function startFresh() {
    const id = newId();
    setInitial((p) => ({ ...p, [id]: [] }));
    setActiveId(id);
  }

  function newChat() {
    setNotice(null);
    setSidebarOpen(false);
    // Already on an empty draft: nothing to create.
    if (isDraft && (initial[activeId]?.length ?? 0) === 0) return;
    startFresh();
  }

  function openSession(id: string) {
    setNotice(null);
    setActiveId(id);
    setSidebarOpen(false);
  }

  // Called by ChatView when a turn finishes: keep the local copy fresh and pull the
  // backend's list so a new session, its title and ordering show up in the sidebar.
  function onTurnFinished(sessionId: string, messages: UIMessage[]) {
    setInitial((p) => ({ ...p, [sessionId]: messages }));
    void refresh();
  }

  /* ---------- sources ---------- */

  function setStatus(id: string, status: DocStatus, error?: string) {
    updateDocs((p) =>
      p.map((d) => (d.id === id ? { ...d, status, error } : d)),
    );
  }

  async function uploadOne(file: File, tempId: string) {
    files.current.set(tempId, file);
    try {
      const { document_id } = await documentsApi.upload(file);
      files.current.delete(tempId);
      updateDocs((p) => {
        // Server said "already exists": don't show the same file twice.
        if (p.some((d) => d.id === document_id && d.id !== tempId)) {
          return p.filter((d) => d.id !== tempId);
        }
        return p.map((d) =>
          d.id === tempId
            ? { ...d, id: document_id, status: "indexing", error: undefined }
            : d,
        );
      });
    } catch (e) {
      setStatus(tempId, "failed", errMsg(e, "Upload failed"));
    }
  }

  async function addFiles(list: File[]) {
    const placeholders: DocItem[] = list.map((f) => ({
      id: newId(),
      name: f.name,
      size: f.size,
      mime: f.type,
      addedAt: Date.now(),
      status: "uploading",
    }));
    updateDocs((p) => [...placeholders, ...p]);
    await Promise.all(list.map((f, i) => uploadOne(f, placeholders[i].id)));
  }

  function retryDoc(id: string) {
    const file = files.current.get(id);
    if (!file) {
      setNotice(
        "The original file is no longer in memory (the page was reloaded). Remove it and add the file again.",
      );
      return;
    }
    setNotice(null);
    setStatus(id, "uploading");
    void uploadOne(file, id);
  }

  /* ---------- delete confirmation ---------- */

  async function removeDoc(id: string) {
    // Still in memory = never reached the server (temp id), so nothing to delete there.
    if (!files.current.has(id)) {
      try {
        await documentsApi.remove(id);
      } catch (e) {
        setNotice(`Could not remove the file: ${errMsg(e, "unknown error")}`);
        return;
      }
    }
    files.current.delete(id);
    updateDocs((p) => p.filter((d) => d.id !== id));
    updateSelected((p) => p.filter((x) => x !== id));
  }

  async function confirmDelete() {
    if (!pending) return;
    const target = pending;
    setPending(null);

    if (target.kind === "doc") {
      await removeDoc(target.id);
      return;
    }

    try {
      // A draft was never saved on the backend, so there is nothing to delete there.
      if (sessions.some((s) => s.id === target.id)) await remove(target.id);
    } catch (e) {
      setNotice(`Could not delete the chat: ${errMsg(e, "unknown error")}`);
      return;
    }
    setInitial((p) => {
      const next = { ...p };
      delete next[target.id];
      return next;
    });
    if (activeId === target.id) startFresh();
  }

  const pendingName =
    pending?.kind === "chat"
      ? (listItems.find((s) => s.id === pending.id)?.title ?? NEW_CHAT)
      : docs.find((d) => d.id === pending?.id)?.name;

  const banner =
    notice ?? (sessionsError ? `Could not load chats: ${sessionsError}` : null);
  const activeMessages = initial[activeId];

  useEffect(() => {
    const pending = docs.filter(
      (d) => d.status === "uploading" || d.status === "indexing",
    );
    if (pending.length === 0) return;

    const timer = setInterval(async () => {
      try {
        const remote = await documentsApi.list();
        updateDocs((prev) =>
          prev.map((d) => {
            const match = remote.find((r) => r.id === d.id);
            if (!match) return d;
            // Server's status wins. Also pull the error message if any.
            return {
              ...d,
              status:
                match.status === "pending" || match.status === "processing"
                  ? "indexing"
                  : match.status,
              error: match.error,
            };
          }),
        );

        // Auto-select files that just became ready.
        const newlyReady = remote
          .filter((r) => r.status === "ready")
          .map((r) => r.id);
        if (newlyReady.length) {
          updateSelected((p) => [...new Set([...p, ...newlyReady])]);
        }
      } catch {
        /* network hiccup — try again next tick */
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [docs, updateDocs, updateSelected]);

  const sidebar = (
    <Tabs defaultValue="sources" className="h-full min-h-0 gap-0">
      <TabsList className="m-3 mb-0 w-[calc(100%-1.5rem)]">
        <TabsTrigger value="sources">Sources</TabsTrigger>
        <TabsTrigger value="chats">Chats</TabsTrigger>
      </TabsList>
      <TabsContent value="sources" className="min-h-0">
        <SourcesPanel
          docs={docs}
          selectedIds={selectedIds}
          onToggle={(id) =>
            updateSelected((p) =>
              p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
            )
          }
          onToggleAll={(checked) =>
            updateSelected(() => (checked ? readyDocs.map((d) => d.id) : []))
          }
          onAddFiles={addFiles}
          onRemove={(id) => setPending({ kind: "doc", id })}
          onRetry={retryDoc}
        />
      </TabsContent>
      <TabsContent value="chats" className="min-h-0">
        <ChatsPanel
          chats={listItems}
          activeId={activeId}
          onSelect={openSession}
          onNew={newChat}
          onDelete={(id) => setPending({ kind: "chat", id })}
        />
      </TabsContent>
    </Tabs>
  );

  useEffect(() => {
  if (!hydrated) return;
  let cancelled = false;

  documentsApi
    .list()
    .then((remote) => {
      if (cancelled) return;
      const byId = new Map(remote.map((r) => [r.id, r]));

      updateDocs((prev) => {
        const kept = prev.flatMap((d): DocItem[] => {
          const r = byId.get(d.id);
          if (r) return [{ ...d, status: toLocalStatus(r.status), error: r.error }];
          if (files.current.has(d.id) || d.status === "failed") return [d];
          if (d.status === "uploading") {
            return [{ ...d, status: "failed", error: "Upload interrupted. Remove it and add the file again." }];
          }
          return []; // deleted on the server, drop the stale local copy
        });
        const known = new Set(kept.map((d) => d.id));
        const added: DocItem[] = remote
          .filter((r) => !known.has(r.id))
          .map((r) => ({
            id: r.id,
            name: r.filename,
            size: r.size,
            mime: "",
            addedAt: r.created_at ? Date.parse(r.created_at) : Date.now(),
            status: toLocalStatus(r.status),
            error: r.error,
          }));
        return [...added, ...kept];
      });
    })
    .catch(() => {});

  return () => {
    cancelled = true;
  };
}, [hydrated, updateDocs]);

useEffect(() => {
  const inFlight = docs.filter((d) => d.status === "uploading" || d.status === "indexing");
  if (inFlight.length === 0) return;
  const waiting = new Set(inFlight.map((d) => d.id));

  const timer = setInterval(async () => {
    try {
      const remote = await documentsApi.list();
      updateDocs((prev) =>
        prev.map((d) => {
          const match = remote.find((r) => r.id === d.id);
          if (!match) return d;
          return { ...d, status: toLocalStatus(match.status), error: match.error };
        }),
      );
      const newlyReady = remote
        .filter((r) => r.status === "ready" && waiting.has(r.id))
        .map((r) => r.id);
      if (newlyReady.length) updateSelected((p) => [...new Set([...p, ...newlyReady])]);
    } catch {
      /* try again next tick */
    }
  }, 2500);

  return () => clearInterval(timer);
}, [docs, updateDocs, updateSelected]);

useEffect(() => {
  const inFlight = docs.filter((d) => d.status === "uploading" || d.status === "indexing");
  if (inFlight.length === 0) return;
  const waiting = new Set(inFlight.map((d) => d.id));

  const timer = setInterval(async () => {
    try {
      const remote = await documentsApi.list();
      updateDocs((prev) =>
        prev.map((d) => {
          const match = remote.find((r) => r.id === d.id);
          if (!match) return d;
          return { ...d, status: toLocalStatus(match.status), error: match.error };
        }),
      );
      const newlyReady = remote
        .filter((r) => r.status === "ready" && waiting.has(r.id))
        .map((r) => r.id);
      if (newlyReady.length) updateSelected((p) => [...new Set([...p, ...newlyReady])]);
    } catch {
      /* try again next tick */
    }
  }, 2500);

  return () => clearInterval(timer);
}, [docs, updateDocs, updateSelected]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-80 shrink-0 border-e bg-sidebar text-sidebar-foreground md:block">
        {sidebar}
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="w-[85%] bg-sidebar p-0 md:hidden"
          showCloseButton={false}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sources and chats</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1 flex-col">
        {banner && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {banner}
          </div>
        )}
        <div className="min-h-0 flex-1">
          {hydrated && activeMessages !== undefined ? (
            <ChatView
              key={activeId}
              sessionId={activeId}
              title={activeSession?.title ?? NEW_CHAT}
              initialMessages={activeMessages}
              user={user}
              selectedDocs={selectedDocs}
              onTurnFinished={onTurnFinished}
              onOpenSidebar={() => setSidebarOpen(true)}
              onRequestDelete={() => setPending({ kind: "chat", id: activeId })}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Spinner className="size-5" />
            </div>
          )}
        </div>
      </main>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "doc"
                ? "Remove this source?"
                : "Delete this chat?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "doc"
                ? `“${pendingName}” will be removed from every chat. This can't be undone.`
                : `“${pendingName}” and its messages will be deleted. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {pending?.kind === "doc" ? "Remove source" : "Delete chat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
