"use client";

import { Files, Package, Rocket, Terminal, Info } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";

export function Navbar({
  onToggleDrawer,
  onToggleLogs,
  onOpenPreview,
  onExport,
  marketingUrl,
}: {
  onToggleDrawer: () => void;
  onToggleLogs: () => void;
  onOpenPreview: () => void;
  onExport: () => void;
  marketingUrl: string;
}) {
  return (
    <motion.header
      layout
      transition={{ type: "spring", damping: 20, stiffness: 120 }}
      className="sticky top-0 z-10 h-14 border-b border-zinc-100 bg-white/80 backdrop-blur"
    >
      <div className="h-full flex items-center">
        <motion.div layout className="w-64 h-full flex items-center px-3 border-r border-zinc-100">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleDrawer}
              title="项目文件"
              className="text-zinc-500 hover:text-zinc-900"
            >
              <Files className="h-4 w-4" />
            </Button>
          </motion.div>
        </motion.div>

        <motion.div layout className="flex-1 h-full flex items-center justify-center px-4">
          <motion.div layout className="w-full max-w-5xl text-center">
            <motion.div
              layout
              transition={{ type: "spring", damping: 18, stiffness: 140 }}
              className="text-xl font-bold tracking-tight text-zinc-900"
            >
              NexusSite
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div layout className="h-full flex items-center justify-end px-3">
          <motion.div
            layout
            transition={{ type: "spring", damping: 18, stiffness: 140 }}
            className="flex items-center gap-1 rounded-full bg-zinc-100 px-1 py-1"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(marketingUrl, "_blank")}
                title="关于 NexusSite"
                className="text-zinc-500 hover:text-zinc-900 hover:bg-white/60"
              >
                <Info className="h-4 w-4" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleLogs}
                title="系统日志"
                className="text-zinc-500 hover:text-zinc-900 hover:bg-white/60"
              >
                <Terminal className="h-4 w-4" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenPreview}
                title="预览"
                className="text-zinc-500 hover:text-zinc-900 hover:bg-white/60"
              >
                <Rocket className="h-4 w-4" />
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onExport}
                title="导出"
                className="text-zinc-500 hover:text-zinc-900 hover:bg-white/60"
              >
                <Package className="h-4 w-4" />
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </motion.header>
  );
}

