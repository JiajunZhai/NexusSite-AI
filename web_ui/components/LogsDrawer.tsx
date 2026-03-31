"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";

import { LogTerminal } from "@/components/LogTerminal";
import { Button } from "@/components/ui/button";

export function LogsDrawer({
  open,
  onClose,
  lines,
}: {
  open: boolean;
  onClose: () => void;
  lines: { ts: number; text: string }[];
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <motion.div
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="absolute right-0 top-0 h-full w-[280px] bg-white border-l border-zinc-200 p-3"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-zinc-900">System Logs</div>
          <Button variant="ghost" size="icon" onClick={onClose} title="关闭">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <LogTerminal lines={lines} />
      </motion.div>
    </div>
  );
}

