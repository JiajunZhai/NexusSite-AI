"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronUp, Code2, ClipboardList, LoaderCircle, Palette, SendHorizontal, ShieldCheck, Settings2 } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

import { MessageBubble } from "@/components/MessageBubble";
import { ProgressRing } from "@/components/ProgressRing";

type Step = "PM" | "Designer" | "Coder" | "QA";

export type OrchestratorEvent = {
  ts: number;
  node_name: string;
  kind: string;
  message: string;
  data: Record<string, unknown>;
};

type ChatItem =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "agent"; title: string; icon: React.ReactNode; text: string; meta?: string; progress?: number };

const ICONS: Record<string, React.ReactNode> = {
  PM: <ClipboardList className="h-4 w-4" />,
  Designer: <Palette className="h-4 w-4" />,
  Coder: <Code2 className="h-4 w-4" />,
  QA: <ShieldCheck className="h-4 w-4" />,
  System: <Bot className="h-4 w-4" />,
};

type ModelMap = { pm: string; designer: string; coder: string; qa: string };
type RoleKey = keyof ModelMap;
type ProviderKind = "openrouter" | "opencode_zen";
type ProviderSelection = { kind: ProviderKind; provider: string };

export function ChatContainer({
  orchestratorUrl,
  onEvent,
  rawLines,
}: {
  orchestratorUrl: string;
  onEvent: (evt: OrchestratorEvent) => void;
  rawLines: { ts: number; text: string }[];
}) {
  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const [qaBuilding, setQaBuilding] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [expertOpen, setExpertOpen] = useState(false);
  const [modelMap, setModelMap] = useState<ModelMap>({
    pm: "qwen/qwen3.6-plus-preview:free",
    designer: "qwen/qwen3.6-plus-preview:free",
    coder: "qwen/qwen3.6-plus-preview:free",
    qa: "qwen/qwen3.6-plus-preview:free",
  });
  const [draftMap, setDraftMap] = useState<ModelMap>(modelMap);
  const [savedAt, setSavedAt] = useState<number>(0);
  const [providerSel, setProviderSel] = useState<Record<RoleKey, ProviderSelection>>({
    pm: { kind: "openrouter", provider: "qwen" },
    designer: { kind: "openrouter", provider: "qwen" },
    coder: { kind: "openrouter", provider: "qwen" },
    qa: { kind: "openrouter", provider: "qwen" },
  });
  const [catalog, setCatalog] = useState<{
    openrouter: { providers: string[]; models_by_provider: Record<string, { id: string; label: string }[]> };
    opencode_zen: { providers: string[]; models_by_provider: Record<string, { id: string; label: string; disabled?: boolean }[]> };
    presets: Record<string, ModelMap>;
    recommended: ModelMap;
  } | null>(null);
  const isEmpty = items.length === 0;
  const [thinkingNode, setThinkingNode] = useState<string | null>(null);

  const progressFor = (node: string, kind: string) => {
    if (node === "PM") return 25;
    if (node === "Designer") return 50;
    if (node === "Coder") return 75;
    if (node === "QA") return kind === "build_result" ? 100 : 90;
    return 0;
  };

  const run = async () => {
    const text = prompt.trim();
    if (!text) return;
    setItems((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text }]);
    setRunning(true);
    try {
      await fetch(`${orchestratorUrl}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          model_map: modelMap,
        }),
      });
    } finally {
      setRunning(false);
    }
  };

  // Load model catalog dynamically
  useEffect(() => {
    let cancelled = false;
    fetch(`${orchestratorUrl}/api/models`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.ok) setCatalog(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orchestratorUrl]);

  // Load saved model_map from localStorage (client only)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("nexussite:model_map_v1");
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return;
      const mm = obj as Partial<ModelMap>;
      if (mm.pm && mm.designer && mm.coder && mm.qa) {
        setModelMap({ pm: mm.pm, designer: mm.designer, coder: mm.coder, qa: mm.qa });
      }
    } catch {}
  }, []);

  // When opening expert panel, start from current saved config
  useEffect(() => {
    if (!expertOpen) return;
    setDraftMap(modelMap);
  }, [expertOpen, modelMap]);

  const providerOptions = useMemo(() => {
    const out: { kind: ProviderKind; provider: string; label: string }[] = [];
    const or = catalog?.openrouter;
    if (or?.providers?.length) {
      for (const p of or.providers) out.push({ kind: "openrouter", provider: p, label: `OpenRouter / ${p}` });
    }
    const zen = catalog?.opencode_zen;
    if (zen?.providers?.length) {
      for (const p of zen.providers) out.push({ kind: "opencode_zen", provider: p, label: `OpenCode Zen / ${p}` });
    }
    return out;
  }, [catalog]);

  const modelsFor = (sel: ProviderSelection) => {
    if (sel.kind === "openrouter") return catalog?.openrouter?.models_by_provider?.[sel.provider] || [];
    return catalog?.opencode_zen?.models_by_provider?.[sel.provider] || [];
  };

  const saveDraft = () => {
    setModelMap(draftMap);
    try {
      window.localStorage.setItem("nexussite:model_map_v1", JSON.stringify(draftMap));
    } catch {}
    setSavedAt(Date.now());
    setExpertOpen(false);
  };

  // Subscribe SSE and convert to chat-friendly cards
  useEffect(() => {
    const es = new EventSource(`${orchestratorUrl}/api/logs/sse`);
    es.onmessage = (ev) => {
      let parsed: OrchestratorEvent | null = null;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        const s = String(ev.data);
        const m = s.match(/^\[(PM|Designer|Coder|QA|System)\]\s*(.*)$/);
        if (m) {
          parsed = {
            ts: Date.now(),
            node_name: m[1],
            kind: "status",
            message: m[2] || "",
            data: {},
          };
        } else {
          parsed = {
            ts: Date.now(),
            node_name: "RAW",
            kind: "log",
            message: s,
            data: {},
          };
        }
      }
      onEvent(parsed);

      // Center chat stream: only show structured status + summaries (not every raw log line)
      if (parsed.node_name === "RAW") return;

      const icon = ICONS[parsed.node_name] ?? <Bot className="h-4 w-4" />;
      const title = parsed.node_name;

      if (parsed.kind === "status") {
        setThinkingNode(parsed.node_name);
        if (parsed.node_name === "QA") {
          const msg = (parsed.message || "").toLowerCase();
          if (msg.includes("build") || msg.includes("npm run build") || msg.includes("验收")) {
            setQaBuilding(true);
          }
        }
        setItems((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            title,
            icon,
            text: parsed.message,
            progress: progressFor(title, parsed.kind),
          },
        ]);
        return;
      }

      if (parsed.kind === "prd") {
        const projectName = String((parsed.data as any)?.project_name ?? "");
        const features = (parsed.data as any)?.features as string[] | undefined;
        setItems((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            title: "PM",
            icon,
            text: `已生成 PRD：${projectName || "（未命名）"}`,
            meta: features?.length ? `功能点：${features.slice(0, 3).join(" / ")}${features.length > 3 ? " …" : ""}` : undefined,
            progress: 30,
          },
        ]);
        return;
      }

      if (parsed.kind === "theme_config") {
        const primary = String((parsed.data as any)?.primary_color ?? "");
        const style = String((parsed.data as any)?.component_style ?? "");
        setItems((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            title: "Designer",
            icon,
            text: "已生成 theme_config",
            meta: `primary=${primary || "-"} · style=${style || "-"}`,
            progress: 55,
          },
        ]);
        return;
      }

      if (parsed.kind === "files_written") {
        const files = ((parsed.data as any)?.files as string[]) ?? [];
        setItems((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            title: "Coder",
            icon,
            text: `已写入 ${files.length} 个文件`,
            meta: files.slice(0, 4).join(", ") + (files.length > 4 ? " …" : ""),
            progress: 80,
          },
        ]);
        return;
      }

      if (parsed.kind === "build_result") {
        setQaBuilding(false);
        setThinkingNode(null);
        const exit = (parsed.data as any)?.exit_code;
        const err = (parsed.data as any)?.error;
        setItems((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "agent",
            title: "QA",
            icon,
            text: err ? "构建失败，需要修复" : "构建通过，可以交付",
            meta: `exit_code=${exit}`,
            progress: err ? 92 : 100,
          },
        ]);
        return;
      }
    };
    return () => es.close();
  }, [orchestratorUrl, onEvent]);

  const ThinkingDots = () => (
    <span className="inline-flex items-center gap-1">
      <span className="h-1 w-1 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1 w-1 rounded-full bg-zinc-400 animate-bounce" />
      <span className="h-1 w-1 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.15s]" />
    </span>
  );

  const ExpertPopover = ({ align }: { align: "top" | "bottom" }) => {
    if (!expertOpen) return null;
    return (
      <>
        <div className="fixed inset-0 z-[55]" onClick={() => setExpertOpen(false)} />
        <motion.div
          initial={{ opacity: 0, y: align === "bottom" ? -8 : 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: align === "bottom" ? -8 : 8, scale: 0.98 }}
          transition={{ type: "spring", damping: 22, stiffness: 180 }}
          className={[
            "absolute z-[56] w-[min(760px,92vw)] rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden",
            align === "bottom" ? "left-0 top-full mt-3" : "left-0 bottom-full mb-3",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-11 px-4 border-b border-zinc-100 flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900">专家模型配置</div>
            <button type="button" onClick={() => setExpertOpen(false)} className="text-zinc-500 hover:text-zinc-900">
              ✕
            </button>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftMap(catalog?.presets?.free || draftMap)}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900"
              >
                全免费方案
              </button>
              <button
                type="button"
                onClick={() => setDraftMap(catalog?.presets?.strong || draftMap)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
              >
                全强力方案
              </button>
              <div className="ml-auto text-[11px] text-zinc-500">
                {savedAt ? `已保存 ${new Date(savedAt).toLocaleTimeString()}` : "未保存"}
              </div>
            </div>

            {(
              [
                ["pm", "策划师 (PM)"],
                ["designer", "设计师 (UI)"],
                ["coder", "架构师 (Coder)"],
                ["qa", "质检员 (QA)"],
              ] as const
            ).map(([key, label]) => {
              const k = key as RoleKey;
              const sel = providerSel[k];
              const models = modelsFor(sel);
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-28 text-zinc-600">{label}</span>
                  <select
                    value={`${sel.kind}:${sel.provider}`}
                    onChange={(e) => {
                      const [kind, provider] = e.target.value.split(":");
                      const nextSel = { kind: kind as ProviderKind, provider };
                      setProviderSel((s) => ({ ...s, [k]: nextSel }));
                      const nextModels = modelsFor(nextSel);
                      const first = (nextModels as any[])[0]?.id as string | undefined;
                      if (first) setDraftMap((m) => ({ ...m, [k]: first }));
                    }}
                    className="w-56 rounded-xl border border-zinc-200 bg-white px-3 py-2"
                  >
                    {providerOptions.map((p) => (
                      <option key={`${p.kind}:${p.provider}`} value={`${p.kind}:${p.provider}`}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={draftMap[k]}
                    onChange={(e) => setDraftMap((m) => ({ ...m, [k]: e.target.value }))}
                    className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2"
                  >
                    {models.map((m: any) => (
                      <option key={m.id} value={m.id} disabled={!!m.disabled}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setExpertOpen(false)}
                className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveDraft}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              >
                保存
              </button>
            </div>
          </div>
        </motion.div>
      </>
    );
  };

  return (
    <LayoutGroup>
    <motion.div layout className="relative h-full">
      <AnimatePresence mode="wait">
        {isEmpty ? (
          <motion.div
            key="empty"
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", damping: 20, stiffness: 120 }}
            className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center"
          >
            <div className="-translate-y-[8vh] w-full flex flex-col items-center">
              <motion.div
                layoutId="hero-title"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, type: "spring", damping: 22, stiffness: 120 }}
                className="text-4xl font-bold tracking-tight text-zinc-900 text-center"
              >
                今天有什么可以帮到你？
              </motion.div>
            <div className="mt-2 text-sm text-zinc-500 text-center">
              描述你想要的网站，我们会自动完成规划、设计、编码与构建验收。
            </div>

            <motion.div
              layoutId="immersive-input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="mt-10 w-[90%] max-w-5xl"
            >
              <div className="relative rounded-[32px] border border-zinc-200 bg-white shadow-2xl shadow-zinc-200/70">
                <div className="flex items-center gap-2 border border-transparent py-4 px-6 transition-all w-full bg-white rounded-[32px] focus-within:border-blue-400">
                  <div className="flex items-center gap-1">
                    <motion.button
                      type="button"
                      onClick={() => setExpertOpen(true)}
                      className="h-10 w-10 grid place-items-center rounded-2xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                      title="⚙️ 专家设置"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Settings2 className="h-5 w-5" />
                    </motion.button>
                  </div>
                  <ExpertPopover align="top" />

                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你想要的网站…"
                    className="flex-1 bg-transparent outline-none text-zinc-800 px-2 text-lg h-12"
                  />

                  <motion.button
                    type="button"
                    onClick={run}
                    disabled={running}
                    className="rounded-full bg-blue-600 p-3 text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
                    title="发送"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <SendHorizontal className="h-5 w-5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
          </motion.div>
        ) : (
          <motion.div
            key="active"
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", damping: 20, stiffness: 120 }}
          >
          <div className="pb-28">
            <div className="space-y-5">

        {items.map((it) => {
          if (it.role === "user") {
            return (
              <MessageBubble key={it.id} role="user" title="You">
                {it.text}
              </MessageBubble>
            );
          }
          return (
            <MessageBubble
              key={it.id}
              role="agent"
              title={
                <span className="inline-flex items-center gap-2 w-full">
                  <span className="text-zinc-700">{it.icon}</span>
                  <span className="text-zinc-900">{it.title}</span>
                  {qaBuilding && it.title === "QA" ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                  ) : null}
                  {thinkingNode === it.title ? <ThinkingDots /> : null}
                  <span className="ml-auto">{typeof it.progress === "number" ? <ProgressRing value={it.progress} /> : null}</span>
                </span>
              }
            >
              <div className="space-y-1">
                <motion.div
                  layout
                  transition={{ type: "spring", damping: 20, stiffness: 120 }}
                >
                  {it.text}
                </motion.div>
                {it.meta ? <div className="text-xs text-zinc-500">{it.meta}</div> : null}

                <div className="pt-2">
                  <motion.button
                    type="button"
                    onClick={() => setMatrixOpen((v) => !v)}
                    className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-900"
                    title="展开/收起 System Matrix"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {matrixOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    System Matrix
                    <span className="text-zinc-400">(raw logs)</span>
                  </motion.button>
                  <AnimatePresence initial={false}>
                    {matrixOpen ? (
                      <motion.div
                        key="matrix"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ type: "spring", damping: 22, stiffness: 160 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-950 p-3 font-mono text-[10px] leading-5 text-emerald-500 max-h-56 overflow-auto">
                      {rawLines.slice(-120).map((l, idx) => (
                        <div key={idx} className="whitespace-pre-wrap break-words">
                          <span className="text-emerald-700">{new Date(l.ts).toLocaleTimeString()}</span>{" "}
                          {l.text}
                        </div>
                      ))}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </MessageBubble>
          );
        })}
            </div>
          </div>

          <motion.div
            layoutId="immersive-input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="fixed bottom-0 left-0 right-0 z-10"
          >
            <div className="mx-auto max-w-5xl px-4 pb-6">
              <div className="relative rounded-[32px] border border-zinc-200 bg-white/80 backdrop-blur-xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex items-center gap-2 border border-transparent py-4 px-6 transition-all w-full bg-white/80 rounded-[32px] focus-within:border-blue-400">
                  <div className="flex items-center gap-1">
                    <motion.button
                      type="button"
                      onClick={() => setExpertOpen(true)}
                      className="h-10 w-10 grid place-items-center rounded-2xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                      title="⚙️ 专家设置"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Settings2 className="h-5 w-5" />
                    </motion.button>
                  </div>
                  <ExpertPopover align="bottom" />

                  <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你想要的网站…"
                    className="flex-1 bg-transparent outline-none text-zinc-800 px-2 text-lg h-12"
                  />

                  <motion.button
                    type="button"
                    onClick={run}
                    disabled={running}
                    className="rounded-full bg-blue-600 p-3 text-white shadow-md hover:bg-blue-700 disabled:opacity-60"
                    title="发送"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <SendHorizontal className="h-5 w-5" />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expert settings is now a popover attached to the input bar (kept there to avoid breaking dialogue flow). */}
    </motion.div>
    </LayoutGroup>
  );
}

