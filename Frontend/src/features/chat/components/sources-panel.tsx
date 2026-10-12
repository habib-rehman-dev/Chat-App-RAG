"use client";

import { useRef, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { cn, formatBytes } from "@/lib/utils";
import type { DocItem } from "../types";

interface SourcesPanelProps {
  docs: DocItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}

function DocIcon({ doc }: { doc: DocItem }) {
  const name = doc.name.toLowerCase();
  if (doc.mime.startsWith("image/")) return <ImageIcon className="size-4" />;
  if (/\.(csv|xlsx?|tsv)$/.test(name)) return <FileSpreadsheet className="size-4" />;
  return <FileText className="size-4" />;
}

export function SourcesPanel({
  docs,
  selectedIds,
  onToggle,
  onToggleAll,
  onAddFiles,
  onRemove,
}: SourcesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const ready = docs.filter((d) => d.status === "ready");
  const selectedCount = ready.filter((d) => selectedIds.includes(d.id)).length;
  const allChecked = ready.length > 0 && selectedCount === ready.length;
  const someChecked = selectedCount > 0 && !allChecked;

  const pick = (list: FileList | null) => {
    if (list?.length) onAddFiles(Array.from(list));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />

      <div className="p-3">
        <Button
          variant="outline"
          className="h-9 w-full"
          onClick={() => inputRef.current?.click()}
        >
          <Plus />
          Add sources
        </Button>
      </div>

      {docs.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "mx-3 flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50",
            dragging && "border-primary bg-muted/60 text-foreground",
          )}
        >
          <Upload className="size-6" />
          <span className="font-medium text-foreground">Saved sources appear here</span>
          <span>Drop any file, or click to choose. Chat answers will cite them.</span>
        </button>
      ) : (
        <>
          <label className="flex cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm">
            <span className="text-muted-foreground">Select all sources</span>
            <Checkbox
              checked={allChecked}
              indeterminate={someChecked}
              disabled={ready.length === 0}
              onCheckedChange={(c) => onToggleAll(Boolean(c))}
              aria-label="Select all sources"
            />
          </label>

          <ul
            className={cn(
              "min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3",
              dragging && "rounded-xl bg-muted/60 ring-1 ring-primary",
            )}
          >
            {docs.map((doc) => {
              const isReady = doc.status === "ready";
              const checked = selectedIds.includes(doc.id);
              return (
                <li
                  key={doc.id}
                  className="group/doc flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                      doc.status === "failed" && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {doc.status === "failed" ? (
                      <TriangleAlert className="size-4" />
                    ) : isReady ? (
                      <DocIcon doc={doc} />
                    ) : (
                      <Spinner />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm" title={doc.name}>
                      {doc.name}
                    </p>
                    <p
                      className={cn(
                        "truncate text-xs text-muted-foreground",
                        doc.status === "failed" && "text-destructive",
                      )}
                    >
                      {doc.status === "uploading" && "Uploading…"}
                      {doc.status === "indexing" && "Indexing…"}
                      {doc.status === "failed" && (doc.error ?? "Upload failed")}
                      {isReady && formatBytes(doc.size)}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 transition-opacity group-hover/doc:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
                    onClick={() => onRemove(doc.id)}
                    aria-label={`Remove ${doc.name}`}
                  >
                    <Trash2 />
                  </Button>

                  <Checkbox
                    checked={checked && isReady}
                    disabled={!isReady}
                    onCheckedChange={() => onToggle(doc.id)}
                    aria-label={`Use ${doc.name} in chat`}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
