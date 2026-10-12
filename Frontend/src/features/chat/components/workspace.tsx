"use client";

import { useEffect, useState } from "react";
import type { UIMessage } from "ai";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { documentsApi } from "@/features/documents/documents-api";
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

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function Workspace({ user }: { user: ChatUser }) {
  // Chat sessions live on the backend. Only the file list/selection is local for now.
  const { sessions, error: sessionsError, refresh, remove } = useSessions();
  const [docs, updateDocs] = useStored<DocItem[]>(`rag:${user.id}:docs`, EMPTY_DOCS);
  const [selected, updateSelected] = useStored<string[]>(`rag:${user.id}:selected`, EMPTY_IDS);
  const hydrated = useHydrated();

  // First screen is an unsaved draft; the backend creates the session on its first message.
  const [boot] = useState(() => {
    const id = newId();
    return { id, initial: { [id]: [] as UIMessage[] } };
  });
  const [activeId, setActiveId] = useState(boot.id);
  // Messages each opened session starts from (fetched from the backend, or [] for a draft).
  const [initial, setInitial] = useState<Record<string, UIMessage[]>>(boot.initial);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const readyDocs = docs.filter((d) => d.status === "ready");
  const selectedIds = selected.filter((id) => readyDocs.some((d) => d.id === id));
  const selectedDocs = readyDocs.filter((d) => selectedIds.includes(d.id));

  const activeSession = sessions.find((s) => s.id === activeId);
  const isDraft = !activeSession;
  const listItems: SessionSummary[] = isDraft
    ? [{ id: activeId, title: NEW_CHAT, updatedAt: 0 }, ...sessions]
    : sessions;

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
        if (!cancelled) setNotice(`Could not open this chat: ${errMsg(e, "unknown error")}`);
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
    updateDocs((p) => p.map((d) => (d.id === id ? { ...d, status, error } : d)));
  }

  async function addFiles(files: File[]) {
    const items: DocItem[] = files.map((f) => ({
      id: newId(),
      name: f.name,
      size: f.size,
      mime: f.type,
      addedAt: Date.now(),
      status: "uploading",
    }));
    updateDocs((p) => [...items, ...p]);

    await Promise.all(
      items.map(async (item, i) => {
        try {
          await documentsApi.upload(files[i], item.id);
          setStatus(item.id, "ready");
          updateSelected((p) => [...new Set([...p, item.id])]);
        } catch (e) {
          setStatus(item.id, "failed", errMsg(e, "Upload failed"));
        }
      }),
    );
  }

  async function removeDoc(id: string) {
    try {
      await documentsApi.remove(id);
    } catch (e) {
      setNotice(`Could not remove the file: ${errMsg(e, "unknown error")}`);
      return;
    }
    updateDocs((p) => p.filter((d) => d.id !== id));
    updateSelected((p) => p.filter((x) => x !== id));
  }

  /* ---------- delete confirmation ---------- */

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

  const banner = notice ?? (sessionsError ? `Could not load chats: ${sessionsError}` : null);
  const activeMessages = initial[activeId];

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
            updateSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
          }
          onToggleAll={(checked) => updateSelected(() => (checked ? readyDocs.map((d) => d.id) : []))}
          onAddFiles={addFiles}
          onRemove={(id) => setPending({ kind: "doc", id })}
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

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden w-80 shrink-0 border-e bg-sidebar text-sidebar-foreground md:block">{sidebar}</aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[85%] bg-sidebar p-0 md:hidden" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Sources and chats</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1 flex-col">
        {banner && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive">{banner}</div>
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

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.kind === "doc" ? "Remove this source?" : "Delete this chat?"}</AlertDialogTitle>
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
