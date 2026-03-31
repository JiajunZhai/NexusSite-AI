"use client";

import { useEffect, useRef } from "react";

export function LogTerminal({ lines }: { lines: { ts: number; text: string }[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "auto" });
  }, [lines.length]);

  return (
    <div className="h-full rounded-xl border border-zinc-200 bg-zinc-950 overflow-hidden">
      <div className="px-3 py-2 text-xs font-medium text-zinc-200 border-b border-zinc-800">
        System Runtime
      </div>
      <div className="h-full max-h-[calc(100vh-160px)] overflow-auto p-3 font-mono text-[10px] leading-5 text-emerald-500">
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-words">
            <span className="text-emerald-700">
              {new Date(l.ts).toLocaleTimeString()}
            </span>{" "}
            {l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

