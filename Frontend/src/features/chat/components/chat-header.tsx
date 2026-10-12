"use client";

import { signOut } from "next-auth/react";
import { Eraser, LogOut, PanelLeft, Trash2, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatUser } from "../types";

interface ChatHeaderProps {
  user: ChatUser;
  title: string;
  sourceCount: number;
  hasMessages: boolean;
  onOpenSidebar: () => void;
  onClear: () => void;
  onDelete: () => void;
}

export function ChatHeader({
  user,
  title,
  sourceCount,
  hasMessages,
  onOpenSidebar,
  onClear,
  onDelete,
}: ChatHeaderProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex items-center gap-2 border-b bg-background px-3 py-2.5">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenSidebar}
        aria-label="Open sources and chats"
      >
        <PanelLeft />
      </Button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-medium">{title}</h1>
        <p className="text-xs text-muted-foreground">
          {sourceCount === 0
            ? "No sources selected"
            : `${sourceCount} ${sourceCount === 1 ? "source" : "sources"} selected`}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        disabled={!hasMessages}
        title="Clear messages"
        aria-label="Clear messages"
      >
        <Eraser />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        title="Delete chat"
        aria-label="Delete chat"
      >
        <Trash2 />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" className="size-9 rounded-full p-0" aria-label="Account">
              <Avatar className="size-8">
                {user.image && <AvatarImage src={user.image} alt={user.name} />}
                <AvatarFallback className="bg-secondary">
                  {initials || <UserIcon className="size-4" />}
                </AvatarFallback>
              </Avatar>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
