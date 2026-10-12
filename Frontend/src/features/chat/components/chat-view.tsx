"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, RefreshCw, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ChatHeader } from "./chat-header";
import { ChatMessage } from "./chat-message";
import type { ChatUser, DocItem } from "../types";

// Module-level: one transport instance, not one per render.
const transport = new DefaultChatTransport({ api: "/api/chat" });

interface ChatViewProps {
  sessionId: string;
  title: string;
  initialMessages: UIMessage[];
  user: ChatUser;
  selectedDocs: DocItem[];
  onTurnFinished: (sessionId: string, messages: UIMessage[]) => void;
  onOpenSidebar: () => void;
  onRequestDelete: () => void;
}

export function ChatView({
  sessionId,
  title,
  initialMessages,
  user,
  selectedDocs,
  onTurnFinished,
  onOpenSidebar,
  onRequestDelete,
}: ChatViewProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastSaved = useRef(initialMessages);

  const { messages, sendMessage, status, stop, error, regenerate, setMessages } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  // Sent with every request so the backend can filter retrieval to these files.
  const requestBody = { session_id: sessionId, documentIds: selectedDocs.map((d) => d.id) };

  // Persist once a turn settles (not on every streamed token).
  useEffect(() => {
    if ((status === "ready" || status === "error") && messages !== lastSaved.current) {
      lastSaved.current = messages;
      onTurnFinished(sessionId, messages);
    }
  }, [status, messages, sessionId, onTurnFinished]);

  // Auto-scroll only while the reader is already near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    stickToBottom.current = true;
    sendMessage({ text }, { body: requestBody });
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        user={user}
        title={title}
        sourceCount={selectedDocs.length}
        hasMessages={messages.length > 0}
        onOpenSidebar={onOpenSidebar}
        onClear={() => setMessages([])}
        onDelete={onRequestDelete}
      />

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 py-6">
          {messages.length === 0 && !error ? (
            <div className="m-auto flex max-w-sm flex-col items-center gap-2 text-center">
              <Sparkles className="size-6 text-muted-foreground" />
              <h2 className="text-base font-medium">Ask about your sources</h2>
              <p className="text-sm text-muted-foreground">
                {selectedDocs.length === 0
                  ? "Add files in the sidebar and tick the ones to include."
                  : "Answers are drawn from the files ticked in the sidebar and cite where they came from."}
              </p>
            </div>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} />)
          )}

          {/* Only before the first token arrives */}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Searching your sources…
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error.message || "Something went wrong."}</p>
              <Button variant="outline" size="sm" onClick={() => regenerate({ body: requestBody })}>
                <RefreshCw /> Retry
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-background p-3">
        <form
          className="mx-auto flex max-w-3xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask a question about your sources"
            rows={1}
            className="max-h-40 min-h-9 flex-1 resize-none"
            aria-label="Message"
          />
          {busy ? (
            <Button type="button" variant="destructive" size="icon-lg" onClick={() => stop()} aria-label="Stop generating">
              <Square />
            </Button>
          ) : (
            <Button type="submit" size="icon-lg" disabled={!input.trim()} aria-label="Send message">
              <ArrowUp />
            </Button>
          )}
        </form>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-xs text-muted-foreground">
          Enter to send, Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
