"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SessionSummary } from "../types";

interface ChatsPanelProps {
  chats: SessionSummary[];
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ChatsPanel({ chats, activeId, onSelect, onNew, onDelete }: ChatsPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3">
        <Button variant="outline" className="h-9 w-full" onClick={onNew}>
          <Plus />
          New chat
        </Button>
      </div>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {chats.map((chat) => (
          <li
            key={chat.id}
            className={cn(
              "group/chat flex items-center gap-1 rounded-lg pe-1 hover:bg-muted/60",
              chat.id === activeId && "bg-muted",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(chat.id)}
              className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg"
            >
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{chat.title}</span>
            </button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 transition-opacity group-hover/chat:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
              onClick={() => onDelete(chat.id)}
              aria-label={`Delete chat ${chat.title}`}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
