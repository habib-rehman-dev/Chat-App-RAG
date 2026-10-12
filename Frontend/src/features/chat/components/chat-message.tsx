"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { Check, Copy, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ---------- minimal markdown: fenced code, `inline`, **bold** ---------- */

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((t, i) => {
        if (t.length > 1 && t.startsWith("`") && t.endsWith("`")) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
              {t.slice(1, -1)}
            </code>
          );
        }
        if (t.length > 4 && t.startsWith("**") && t.endsWith("**")) {
          return <strong key={i}>{t.slice(2, -2)}</strong>;
        }
        return t;
      })}
    </>
  );
}

function RichText({ text }: { text: string }) {
  // The `$` alternative keeps a still-streaming (unclosed) fence rendering as code.
  const blocks = text.split(/(```[\s\S]*?(?:```|$))/g).filter(Boolean);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) =>
        block.startsWith("```") ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-[0.85em] leading-relaxed"
          >
            <code>{block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}</code>
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-wrap wrap-break-word">
            <Inline text={block} />
          </p>
        ),
      )}
    </div>
  );
}

/* ---------- message ---------- */

interface Citation {
  key: string;
  label: string;
  href?: string;
}

function getCitations(message: UIMessage): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const p of message.parts) {
    if (p.type === "source-document") {
      const label = p.filename ?? p.title;
      if (!seen.has(p.sourceId)) {
        seen.add(p.sourceId);
        out.push({ key: p.sourceId, label });
      }
    } else if (p.type === "source-url") {
      if (!seen.has(p.url)) {
        seen.add(p.url);
        out.push({ key: p.url, label: p.title ?? p.url, href: p.url });
      }
    }
  }
  return out;
}

export function ChatMessage({ message }: { message: UIMessage }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const text = message.parts
    .flatMap((p) => (p.type === "text" ? [p.text] : []))
    .join("");
  const reasoning = message.parts
    .flatMap((p) => (p.type === "reasoning" ? [p.text] : []))
    .join("");
  const citations = isUser ? [] : getCitations(message);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (!text && !reasoning && citations.length === 0) return null;

  return (
    <div className={cn("group/msg flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
      {reasoning && (
        <details className="max-w-full text-sm text-muted-foreground">
          <summary className="cursor-pointer select-none">Thought process</summary>
          <p className="mt-1 whitespace-pre-wrap">{reasoning}</p>
        </details>
      )}

      {text && (
        <div
          className={cn(
            "max-w-full text-sm leading-relaxed",
            isUser
              ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground"
              : "w-full",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap wrap-break-word">{text}</p>
          ) : (
            <RichText text={text} />
          )}
        </div>
      )}

      {citations.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {citations.map((c, i) => {
            const chip = (
              <>
                <span className="font-medium">{i + 1}</span>
                <FileText className="size-3" />
                <span className="max-w-48 truncate">{c.label}</span>
              </>
            );
            const cls =
              "inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground";
            return c.href ? (
              <a key={c.key} href={c.href} target="_blank" rel="noreferrer" className={cn(cls, "hover:text-foreground")}>
                {chip}
              </a>
            ) : (
              <span key={c.key} className={cls} title={c.label}>
                {chip}
              </span>
            );
          })}
        </div>
      )}

      {!isUser && text && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={copy}
          className="opacity-0 transition-opacity group-hover/msg:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
          aria-label="Copy answer"
        >
          {copied ? <Check className="text-green-600" /> : <Copy />}
        </Button>
      )}
    </div>
  );
}
