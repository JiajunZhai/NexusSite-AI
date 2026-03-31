"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FileViewerModal({
  open,
  onClose,
  orchestratorUrl,
  path,
}: {
  open: boolean;
  onClose: () => void;
  orchestratorUrl: string;
  path: string | null;
}) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const url = useMemo(() => {
    if (!path) return null;
    const u = new URL("/api/files/content", orchestratorUrl);
    u.searchParams.set("path", path);
    return u.toString();
  }, [orchestratorUrl, path]);

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setContent(String(j?.content ?? ""));
      })
      .catch(() => {
        if (cancelled) return;
        setContent("读取失败。");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  if (!open || !path) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ type: "spring", damping: 20, stiffness: 140 }}
        className="absolute left-1/2 top-1/2 w-[min(1000px,92vw)] h-[min(72vh,760px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden"
      >
        <div className="h-12 px-3 border-b border-zinc-100 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500">File</div>
            <div className="text-sm font-medium text-zinc-900 truncate">{path}</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="关闭">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-[calc(100%-3rem)] overflow-auto bg-zinc-950 p-4">
          <pre className="text-[11px] leading-5 text-emerald-400 whitespace-pre">
            {loading ? "Loading..." : content}
          </pre>
        </div>
      </motion.div>
    </div>
  );
}

