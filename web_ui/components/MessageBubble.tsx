"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export function MessageBubble({
  role,
  title,
  children,
}: {
  role: "user" | "agent";
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 100 }}
      className={cn("w-full flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[92%] md:max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-zinc-900 text-white border border-zinc-900 shadow-sm"
            : "bg-transparent text-zinc-900 border border-transparent"
        )}
      >
        {title ? <div className="text-xs font-medium text-zinc-600 mb-1">{title}</div> : null}
        <div className={cn("text-sm leading-6", !isUser && "rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm")}>
          {children}
        </div>
      </div>
    </motion.div>
  );
}

