"use client";

import { useEffect, useMemo, useState } from "react";

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export default function Page() {
  const [durationSec] = useState(5 * 60);
  const [remainingSec, setRemainingSec] = useState(durationSec);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setRemainingSec((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (remainingSec <= 0) setRunning(false);
  }, [remainingSec]);

  const mmss = useMemo(() => {
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    return `${pad2(m)}:${pad2(s)}`;
  }, [remainingSec]);

  return (
    <div className="min-h-screen bg-zinc-900 text-emerald-400 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-zinc-950/40 p-8">
        <div className="text-xs tracking-widest text-emerald-300/80">COUNTDOWN</div>
        <div className="mt-3 font-mono text-6xl leading-none">{mmss}</div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRunning((v) => !v)}
            className="flex-1 rounded-xl bg-emerald-400/10 hover:bg-emerald-400/15 border border-emerald-400/30 px-4 py-3 text-emerald-200"
          >
            {running ? "暂停" : "开始"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setRemainingSec(durationSec);
            }}
            className="rounded-xl bg-transparent hover:bg-white/5 border border-emerald-400/20 px-4 py-3 text-emerald-300/90"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  );
}
