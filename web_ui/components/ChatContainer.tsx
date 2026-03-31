"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Code2, ClipboardList, LoaderCircle, Palette, SendHorizontal, ShieldCheck, Settings2, Check, X, FileText, AlertCircle, CheckCircle2, Circle, RefreshCw, Terminal, Download, ChevronDown, ChevronUp, Eye, BookOpen, FolderOpen, ArrowRight } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrchestratorEvent = {
  ts: number;
  node_name: string;
  kind: string;
  message: string;
  data: Record<string, unknown>;
};

type ChatItem = {
  id: string;
  role: "user" | "agent" | "system";
  node?: string;
  text: string;
  meta?: string;
  progress?: number;
  retryCount?: number;
  ts?: number;
};

type StepKey = "pm" | "designer" | "coder" | "qa";
type ModelMap = { pm: string; designer: string; coder: string; qa: string };
type RoleKey = keyof ModelMap;

type FlatModel = {
  id: string;
  label: string;
  provider: string;
  kind: "openrouter" | "opencode_zen";
  is_free?: boolean;
};

type CatalogType = {
  openrouter: { providers: string[]; models_by_provider: Record<string, { id: string; label: string }[]> };
  opencode_zen: { providers: string[]; models_by_provider: Record<string, { id: string; label: string; disabled?: boolean }[]> };
  flat_models: FlatModel[];
  presets: Record<string, ModelMap>;
  recommended: ModelMap;
};

type PRDData = {
  project_name: string;
  tagline?: string;
  target_audience?: string;
  pages?: Array<{ path: string; title: string; purpose: string; sections: string[] }>;
  core_features?: Array<{ name: string; description: string; priority: string }>;
  optional_features?: Array<{ name: string; description: string; priority: string }>;
  user_flow?: string[];
  design_direction?: { style: string; color_palette: string; typography: string; inspiration: string };
  tech_stack_suggestion?: { frontend: string; backend: string; hosting: string; analytics: string };
  seo_keywords?: string[];
  competitors?: Array<{ name: string; strength: string; weakness: string }>;
  success_metrics?: string[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_ICONS: Record<string, React.ReactNode> = {
  PM: <ClipboardList className="h-[15px] w-[15px]" />,
  Designer: <Palette className="h-[15px] w-[15px]" />,
  Coder: <Code2 className="h-[15px] w-[15px]" />,
  QA: <ShieldCheck className="h-[15px] w-[15px]" />,
  System: <Bot className="h-[15px] w-[15px]" />,
};

const STEPS: { key: StepKey; label: string }[] = [
  { key: "pm", label: "需求分析" },
  { key: "designer", label: "设计规范" },
  { key: "coder", label: "代码生成" },
  { key: "qa", label: "质量验收" },
];

const AGENT_ROLES: { role: RoleKey; label: string }[] = [
  { role: "pm", label: "🕵️ 策划师" },
  { role: "designer", label: "🎨 设计师" },
  { role: "coder", label: "💻 工程师" },
  { role: "qa", label: "🔍 质检员" },
];

const NODE_TO_STEP: Record<string, StepKey> = {
  PM: "pm", Designer: "designer", Coder: "coder", QA: "qa",
};

const FRIENDLY_MESSAGES: Record<string, string> = {
  "开始分析需求": "正在分析需求并规划站点架构...",
  "开始执行工作流": "工作流已启动，AI 团队开始协作...",
  "需求分析完成，等待确认": "需求分析完成，请查看下方 PRD 摘要",
  "用户已确认需求，继续执行": "需求已确认，继续执行...",
  "运行异常": "遇到技术问题，正在自动修复...",
  "工作流完成": "全部完成！网站已就绪",
};

function friendlyMessage(raw: string): string {
  for (const [key, val] of Object.entries(FRIENDLY_MESSAGES)) {
    if (raw.includes(key)) return val;
  }
  return raw.replace(/run_id=[\w-]+\s*/g, "").trim();
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const AgentSelect = memo(({ role, label, value, models, onChange }: {
  role: RoleKey; label: string; value: string; models: FlatModel[]; onChange: (role: RoleKey, val: string) => void;
}) => {
  const grouped = useMemo(() => {
    const groups: Record<string, { free: FlatModel[]; paid: FlatModel[] }> = {};
    for (const m of models) {
      const gk = m.kind === "openrouter" ? `OpenRouter / ${m.provider}` : "OpenCode Zen";
      if (!groups[gk]) groups[gk] = { free: [], paid: [] };
      if (m.is_free) groups[gk].free.push(m); else groups[gk].paid.push(m);
    }
    return groups;
  }, [models]);
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 ml-1">{label}</label>
      <select value={value} onChange={(e) => onChange(role, e.target.value)} className="w-full bg-zinc-100 border-none rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer" style={{ height: "38px" }}>
        {Object.entries(grouped).map(([gk, { free, paid }]) => (
          <optgroup key={gk} label={gk}>
            {free.map((m) => (<option key={m.id} value={m.id}>🆓 {m.label}</option>))}
            {paid.map((m) => (<option key={m.id} value={m.id}>💰 {m.label}</option>))}
          </optgroup>
        ))}
      </select>
    </div>
  );
});
AgentSelect.displayName = "AgentSelect";

const ExpertPopover = memo(({ isOpen, onClose, tempConfig, onConfigChange, catalog, onSave }: {
  isOpen: boolean; onClose: () => void; tempConfig: ModelMap; onConfigChange: (role: RoleKey, val: string) => void; catalog: CatalogType | null; onSave: () => void;
}) => {
  if (!isOpen) return null;
  const models = catalog?.flat_models || [];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-[400px] rounded-xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div className="flex items-center gap-2"><Settings2 className="w-4 h-4 text-zinc-500" /><h3 className="text-sm font-semibold text-zinc-700">专家模型配置</h3></div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 rounded-full transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-3 flex gap-2 border-b border-zinc-100">
          <button onClick={() => { const p = catalog?.presets?.free; if (p) (Object.keys(p) as RoleKey[]).forEach((k) => onConfigChange(k, p[k])); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 hover:bg-zinc-50 transition-all">🆓 免费方案</button>
          <button onClick={() => { const p = catalog?.presets?.strong; if (p) (Object.keys(p) as RoleKey[]).forEach((k) => onConfigChange(k, p[k])); }} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-white hover:opacity-90 transition-all">⚡ 强力方案</button>
        </div>
        <div className="p-4 space-y-3 max-h-[360px] overflow-y-auto">
          {AGENT_ROLES.map(({ role, label }) => (<AgentSelect key={role} role={role} label={label} value={tempConfig[role]} models={models} onChange={onConfigChange} />))}
        </div>
        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">取消</button>
          <button onClick={onSave} className="flex-[1.5] py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"><Check className="w-4 h-4" /> 保存配置</button>
        </div>
      </div>
    </div>
  );
});
ExpertPopover.displayName = "ExpertPopover";

const PRDPreviewModal = memo(({ prd, onClose }: { prd: PRDData | null; onClose: () => void }) => {
  if (!prd) return null;
  let md = `# ${prd.project_name}\n\n`;
  if (prd.tagline) md += `> ${prd.tagline}\n\n`;
  if (prd.target_audience) md += `**目标用户**：${prd.target_audience}\n\n`;
  if (prd.pages && prd.pages.length > 0) {
    md += `## 📄 页面规划\n\n`;
    for (const p of prd.pages) { md += `### ${p.path} ${p.title}\n${p.purpose}\n\n`; for (const s of p.sections) md += `- ${s}\n`; md += `\n`; }
  }
  if (prd.core_features && prd.core_features.length > 0) { md += `## 🔴 核心功能 (P0)\n\n`; for (const f of prd.core_features) md += `- **${f.name}**：${f.description}\n`; md += `\n`; }
  if (prd.optional_features && prd.optional_features.length > 0) { md += `## 🟡 可选功能 (P1)\n\n`; for (const f of prd.optional_features) md += `- **${f.name}**：${f.description}\n`; md += `\n`; }
  if (prd.user_flow && prd.user_flow.length > 0) { md += `## 🔄 用户流程\n\n`; prd.user_flow.forEach((f, i) => { md += `${i + 1}. ${f}\n`; }); md += `\n`; }
  if (prd.design_direction) { const d = prd.design_direction; md += `## 🎨 设计方向\n\n`; if (d.style) md += `- **风格**：${d.style}\n`; if (d.color_palette) md += `- **配色**：${d.color_palette}\n`; if (d.typography) md += `- **字体**：${d.typography}\n`; if (d.inspiration) md += `- **参考**：${d.inspiration}\n`; md += `\n`; }
  if (prd.tech_stack_suggestion) { const t = prd.tech_stack_suggestion; md += `## 🛠️ 技术栈建议\n\n`; if (t.frontend) md += `- **前端**：${t.frontend}\n`; if (t.backend) md += `- **后端**：${t.backend}\n`; if (t.hosting) md += `- **部署**：${t.hosting}\n`; if (t.analytics) md += `- **分析**：${t.analytics}\n`; md += `\n`; }
  if (prd.seo_keywords && prd.seo_keywords.length > 0) { md += `## 🔍 SEO 关键词\n\n`; for (const k of prd.seo_keywords) md += `- ${k}\n`; md += `\n`; }
  if (prd.competitors && prd.competitors.length > 0) { md += `## 🏆 竞品分析\n\n`; for (const c of prd.competitors) md += `- **${c.name}**：优势 ${c.strength} / 劣势 ${c.weakness}\n`; md += `\n`; }
  if (prd.success_metrics && prd.success_metrics.length > 0) { md += `## 📊 成功指标\n\n`; for (const m of prd.success_metrics) md += `- ${m}\n`; }
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="bg-white w-full max-w-[700px] rounded-xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-zinc-500" /><h3 className="text-sm font-semibold text-zinc-700">PRD 完整预览</h3></div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-200 rounded-full transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 prose prose-sm max-w-none prose-zinc"><ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown></div>
        <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/50 shrink-0"><button onClick={onClose} className="w-full py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-sm font-medium transition-colors">关闭预览</button></div>
      </motion.div>
    </div>
  );
});
PRDPreviewModal.displayName = "PRDPreviewModal";

// ─── Preview Placeholders ────────────────────────────────────────────────────

const SitemapTree = ({ pages }: { pages?: Array<{ path: string; title: string }> }) => (
  <div className="p-6">
    <div className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">站点地图</div>
    <div className="space-y-2">
      {(pages || [{ path: "/", title: "首页" }]).map((p, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }} className="flex items-center gap-3 text-sm">
          <div className="h-px w-6 bg-zinc-300" />
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono">{p.path}</span>
          <span className="text-zinc-600 text-xs">{p.title}</span>
        </motion.div>
      ))}
    </div>
  </div>
);

const FileTreeAnimation = ({ files }: { files?: string[] }) => (
  <div className="p-6">
    <div className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">生成文件</div>
    <div className="space-y-1 font-mono text-[10px]">
      {(files || []).map((f, i) => (
        <motion.div key={f} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-2 text-zinc-500">
          <Code2 className="h-3 w-3 text-blue-500" />{f}
        </motion.div>
      ))}
    </div>
  </div>
);

const DesignPalette = ({ color, style }: { color?: string; style?: string }) => (
  <div className="p-6">
    <div className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">设计系统</div>
    <div className="space-y-3">
      {color && (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg shadow-sm" style={{ backgroundColor: color }} />
          <div>
            <div className="text-xs text-zinc-500">主色</div>
            <div className="text-xs font-mono text-zinc-700">{color}</div>
          </div>
        </div>
      )}
      {style && <div className="text-xs text-zinc-500">风格：{style}</div>}
    </div>
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export function ChatContainer({
  orchestratorUrl,
  onEvent,
  rawLines,
  onToggleDrawer,
  onToggleLogs,
  marketingUrl,
  previewUrl,
}: {
  orchestratorUrl: string;
  onEvent: (evt: OrchestratorEvent) => void;
  rawLines: { ts: number; text: string }[];
  onToggleDrawer?: () => void;
  onToggleLogs?: () => void;
  marketingUrl?: string;
  previewUrl?: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [running, setRunning] = useState(false);
  const isEmpty = items.length === 0;

  const [activeStep, setActiveStep] = useState<StepKey | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(new Set());
  const [errorSteps, setErrorSteps] = useState<Set<StepKey>>(new Set());

  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [prdData, setPrdData] = useState<PRDData | null>(null);
  const [prdPreviewOpen, setPrdPreviewOpen] = useState(false);

  const [expertOpen, setExpertOpen] = useState(false);
  const [modelMap, setModelMap] = useState<ModelMap>({
    pm: "qwen/qwen3.6-plus-preview:free",
    designer: "qwen/qwen3.6-plus-preview:free",
    coder: "qwen/qwen3.6-plus-preview:free",
    qa: "qwen/qwen3.6-plus-preview:free",
  });
  const [tempConfig, setTempConfig] = useState<ModelMap>(modelMap);
  const [catalog, setCatalog] = useState<CatalogType | null>(null);

  const [matrixOpen, setMatrixOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [lastFiles, setLastFiles] = useState<string[]>([]);
  const [lastDesign, setLastDesign] = useState<{ color?: string; style?: string }>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${orchestratorUrl}/api/models`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j?.ok) setCatalog(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [orchestratorUrl]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("nexussite:model_map_v1");
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj?.pm && obj?.designer && obj?.coder && obj?.qa) setModelMap({ pm: obj.pm, designer: obj.designer, coder: obj.coder, qa: obj.qa });
    } catch {}
  }, []);

  useEffect(() => { if (expertOpen) setTempConfig(modelMap); }, [expertOpen, modelMap]);

  useEffect(() => {
    if (!userScrolledUp && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [items, userScrolledUp]);

  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    setUserScrolledUp(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
  }, []);

  const handleConfigChange = useCallback((role: RoleKey, val: string) => { setTempConfig((prev) => ({ ...prev, [role]: val })); }, []);
  const saveDraft = useCallback(() => {
    setModelMap(tempConfig);
    try { window.localStorage.setItem("nexussite:model_map_v1", JSON.stringify(tempConfig)); } catch {}
    setExpertOpen(false);
  }, [tempConfig]);

  const run = async () => {
    const text = prompt.trim();
    if (!text) return;
    setItems((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text, ts: Date.now() }]);
    setRunning(true);
    setPendingRunId(null);
    setPrdData(null);
    setPrdPreviewOpen(false);
    setActiveStep(null);
    setCompletedSteps(new Set());
    setErrorSteps(new Set());
    setIframeReady(false);
    setLastFiles([]);
    setLastDesign({});
    try {
      await fetch(`${orchestratorUrl}/api/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text, model_map: modelMap, mode: "plan" }) });
    } finally { setRunning(false); }
  };

  const continueWorkflow = async () => {
    if (!pendingRunId || confirming) return;
    setConfirming(true);
    setPendingRunId(null);
    setPrdData(null);
    setItems((prev) => [...prev, { id: crypto.randomUUID(), role: "system", text: "需求已确认，开始执行工作流...", ts: Date.now() }]);
    try {
      await fetch(`${orchestratorUrl}/api/continue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run_id: pendingRunId, model_map: modelMap }) });
    } catch {
      setItems((prev) => [...prev, { id: crypto.randomUUID(), role: "system", text: "连接失败，请重试", ts: Date.now() }]);
    } finally { setConfirming(false); }
  };

  const cancelWorkflow = () => {
    setPendingRunId(null);
    setPrdData(null);
    setItems((prev) => [...prev, { id: crypto.randomUUID(), role: "system", text: "已取消", ts: Date.now() }]);
  };

  const handleExport = useCallback(() => {
    window.open(`${orchestratorUrl}/api/export`, "_blank");
  }, [orchestratorUrl]);

  // SSE handler
  useEffect(() => {
    const es = new EventSource(`${orchestratorUrl}/api/logs/sse`);
    es.onmessage = (ev) => {
      let parsed: OrchestratorEvent | null = null;
      try { parsed = JSON.parse(ev.data); } catch {
        const s = String(ev.data);
        const m = s.match(/^\[(PM|Designer|Coder|QA|System)\]\s*(.*)$/);
        if (m) parsed = { ts: Date.now(), node_name: m[1], kind: "status", message: m[2] || "", data: {} };
        else parsed = { ts: Date.now(), node_name: "RAW", kind: "log", message: s, data: {} };
      }
      if (!parsed) return;
      onEvent(parsed);
      if (parsed.node_name === "RAW") return;

      const title = parsed.node_name;
      const stepKey = NODE_TO_STEP[title];

      if (parsed.kind === "status") {
        if (stepKey) setActiveStep(stepKey);
        const friendly = friendlyMessage(parsed.message);
        setItems((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "agent" && last.node === title) {
            return [...prev.slice(0, -1), { ...last, text: friendly, ts: parsed.ts }];
          }
          return [...prev, { id: crypto.randomUUID(), role: "agent", node: title, text: friendly, ts: parsed.ts }];
        });
        return;
      }

      if (parsed.kind === "prd") {
        const projectName = String((parsed.data as any)?.project_name ?? "");
        setCompletedSteps((prev) => new Set(prev).add("pm"));
        setItems((prev) => [...prev, { id: crypto.randomUUID(), role: "agent", node: "PM", text: `PRD 已生成：${projectName || "（未命名）"}`, progress: 100, ts: parsed.ts }]);
        return;
      }

      if (parsed.kind === "plan_ready") {
        const prd = (parsed.data as any)?.prd;
        if (prd) setPrdData(prd);
        setPendingRunId((parsed.data as any)?.run_id || null);
        setRunning(false);
        return;
      }

      if (parsed.kind === "theme_config") {
        setCompletedSteps((prev) => new Set(prev).add("designer"));
        const primary = String((parsed.data as any)?.primary_color ?? "");
        const style = String((parsed.data as any)?.component_style ?? "");
        setLastDesign({ color: primary, style });
        setItems((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.node === "Designer") return [...prev.slice(0, -1), { ...last, text: "视觉规范已生成", meta: `primary=${primary || "-"} · style=${style || "-"}`, ts: parsed.ts }];
          return [...prev, { id: crypto.randomUUID(), role: "agent", node: "Designer", text: "视觉规范已生成", meta: `primary=${primary || "-"} · style=${style || "-"}`, ts: parsed.ts }];
        });
        return;
      }

      if (parsed.kind === "files_written") {
        setCompletedSteps((prev) => new Set(prev).add("coder"));
        const files = ((parsed.data as any)?.files as string[]) ?? [];
        setLastFiles(files);
        setItems((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.node === "Coder") return [...prev.slice(0, -1), { ...last, text: `已写入 ${files.length} 个文件`, meta: files.slice(0, 4).join(", ") + (files.length > 4 ? " …" : ""), ts: parsed.ts }];
          return [...prev, { id: crypto.randomUUID(), role: "agent", node: "Coder", text: `已写入 ${files.length} 个文件`, meta: files.slice(0, 4).join(", ") + (files.length > 4 ? " …" : ""), ts: parsed.ts }];
        });
        return;
      }

      if (parsed.kind === "build_result") {
        const exitCode = (parsed.data as any)?.exit_code;
        const errorMsg = (parsed.data as any)?.error;
        const isError = exitCode !== 0 || errorMsg;

        if (!isError) {
          setCompletedSteps((prev) => new Set(prev).add("qa"));
          setErrorSteps((prev) => { const n = new Set(prev); n.delete("qa"); return n; });
          setIframeReady(true);
          setItems((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.node === "QA") {
              return [...prev.slice(0, -1), { ...last, text: "构建验收通过，网站已就绪！", retryCount: undefined, progress: 100, ts: parsed.ts }];
            }
            return [...prev, { id: crypto.randomUUID(), role: "agent", node: "QA", text: "构建验收通过，网站已就绪！", progress: 100, ts: parsed.ts }];
          });
        } else {
          setErrorSteps((prev) => new Set(prev).add("qa"));
          setIframeReady(false);
          setItems((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.node === "QA") {
              const retryCount = (last.retryCount || 0) + 1;
              return [...prev.slice(0, -1), { ...last, text: `构建失败，正在第 ${retryCount} 次自愈修复...`, retryCount, progress: undefined, ts: parsed.ts }];
            }
            return [...prev, { id: crypto.randomUUID(), role: "agent", node: "QA", text: "构建失败，正在尝试自愈修复...", retryCount: 1, ts: parsed.ts }];
          });
        }
        return;
      }
    };
    return () => es.close();
  }, [orchestratorUrl, onEvent]);

  const renderPreview = () => {
    if (iframeReady) return null;
    if (activeStep === "pm") return <SitemapTree pages={prdData?.pages?.map(p => ({ path: p.path, title: p.title }))} />;
    if (activeStep === "designer") return <DesignPalette color={lastDesign.color} style={lastDesign.style} />;
    if (activeStep === "coder" && lastFiles.length > 0) return <FileTreeAnimation files={lastFiles} />;
    if (prdData && !pendingRunId) return <SitemapTree pages={prdData.pages?.map(p => ({ path: p.path, title: p.title }))} />;
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center"><LoaderCircle className="h-6 w-6 animate-spin text-zinc-300 mx-auto mb-2" /><div className="text-xs text-zinc-400">等待沙盒就绪...</div></div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <LayoutGroup>
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-white">

      {/* ═══════════════════════════════════════════════════════════
          §1  Unified Header — h-13, 1px zinc-200/50 border
          ═══════════════════════════════════════════════════════════ */}
      <header className="h-[52px] shrink-0 border-b border-zinc-200/50 flex items-center px-4 bg-white">
        {/* Left */}
        <div className="flex items-center gap-2" style={{ minWidth: 180 }}>
          <span className="text-[13px] font-semibold text-zinc-900 tracking-tight">NexusSite</span>
          {onToggleDrawer && (
            <button onClick={onToggleDrawer} className="h-8 w-8 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors" title="项目文件">
              <FolderOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Center — Stepper */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center">
            {STEPS.map((step, i) => {
              const isCompleted = completedSteps.has(step.key);
              const isError = errorSteps.has(step.key);
              const isActive = activeStep === step.key;
              const isLast = i === STEPS.length - 1;
              let labelColor = "text-zinc-400";
              let dotClass = "border-zinc-200 text-zinc-300";
              let StepIcon = Circle;
              if (isError) { labelColor = "text-red-500"; dotClass = "border-red-400 text-red-500"; StepIcon = AlertCircle; }
              else if (isCompleted) { labelColor = "text-zinc-900"; dotClass = "border-zinc-900 text-zinc-600"; StepIcon = Check; }
              else if (isActive) { labelColor = "text-blue-600"; dotClass = "border-blue-500 text-blue-500"; StepIcon = RefreshCw; }
              return (
                <div key={step.key} className="flex items-center">
                  <div className={`flex items-center gap-1.5 ${labelColor}`}>
                    <div className={`relative h-5 w-5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-500 ${dotClass}`}>
                      <StepIcon className="h-2.5 w-2.5" />
                      {isActive && <span className="absolute inset-0 rounded-full border border-blue-400 animate-ping opacity-20" />}
                    </div>
                    <span className="text-[11px] font-medium hidden sm:inline">{step.label}</span>
                  </div>
                  {!isLast && <div className={`w-8 h-[1px] mx-1.5 transition-colors duration-500 ${isCompleted ? "bg-zinc-400" : "bg-zinc-200"}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Tool group */}
        <div className="flex items-center gap-0.5" style={{ minWidth: 180, justifyContent: "flex-end" }}>
          <button onClick={handleExport} className="h-8 w-8 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors" title="导出">
            <Download className="h-5 w-5" strokeWidth={1.5} />
          </button>
          {onToggleLogs && (
            <button onClick={onToggleLogs} className="h-8 w-8 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors" title="日志">
              <BookOpen className="h-5 w-5" strokeWidth={1.5} />
            </button>
          )}
          {previewUrl && (
            <button onClick={() => window.open(previewUrl, "_blank")} className="h-8 w-8 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors" title="预览">
              <Eye className="h-5 w-5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          §2  Split View — flex-1, overflow-hidden
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-row overflow-hidden">

        {/* ─── Left: Timeline Sidebar ─── */}
        <div className={`flex flex-col ${!isEmpty ? "w-[400px] border-r border-zinc-200/50" : "w-full"}`}>
          <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-0">

              {/* Empty State — Center Gravity */}
              {isEmpty ? (
                <div className="flex flex-col items-center justify-center px-4 py-8" style={{ minHeight: "calc(100vh - 52px - 80px)" }}>
                  <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
                    <div className="text-4xl font-bold tracking-tight text-zinc-900 text-center">今天有什么可以帮到你？</div>
                    <div className="mt-2 text-sm text-zinc-500 text-center">描述你想要的网站，我们会自动完成规划、设计、编码与构建验收。</div>
                    <div className="w-full mt-8">
                      <div className="flex items-end gap-2 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); run(); } }}
                          placeholder="描述你想要的网站…"
                          rows={1}
                          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-zinc-400 max-h-32 overflow-y-auto"
                        />
                        <motion.button type="button" onClick={run} disabled={running || !prompt.trim()} className="h-9 w-9 grid place-items-center rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-40 shrink-0" title="发送" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          {running ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <SendHorizontal className="h-4 w-4" />
                          )}
                        </motion.button>
                      </div>
                    </div>
                    <div className="w-full mt-4 flex flex-wrap justify-center gap-2">
                      {[
                        "✨ 生成一个极简风格的 AI SaaS 落地页",
                        "🎨 为我的咖啡店设计一个带预约功能的官网",
                        "💻 创建一个类似 Stripe 的支付 API 文档页",
                      ].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => { setPrompt(s); }}
                          className="bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 rounded-xl px-4 py-2 text-sm text-zinc-600 cursor-pointer transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* ─── Timeline Items ─── */
                <div className="space-y-0">
                  {items.map((it, idx) => {
                    if (it.role === "user") {
                      return (
                        <div key={it.id} className="flex justify-end py-3 px-4">
                          <div className="max-w-[88%] rounded-xl bg-zinc-900 text-zinc-50 px-4 py-3 text-sm leading-relaxed">{it.text}</div>
                        </div>
                      );
                    }
                    if (it.role === "system") {
                      return (
                        <div key={it.id} className="py-1.5 px-4 text-xs text-zinc-400">{it.text}</div>
                      );
                    }
                    // Agent timeline node
                    const icon = NODE_ICONS[it.node || "System"] ?? <Bot className="h-[15px] w-[15px]" />;
                    const isLast = idx === items.filter(i => i.role === "agent").length - 1;
                    return (
                      <div key={it.id} className="flex items-start gap-3 py-2 px-4">
                        {/* Timeline column */}
                        <div className="flex flex-col items-center" style={{ width: 20 }}>
                          <div className="mt-[2px] h-5 w-5 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 shrink-0">
                            {icon}
                          </div>
                          {!isLast && <div className="w-[1px] flex-1 bg-zinc-200 mt-1" />}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-[1px]">
                          <div className="text-sm font-medium text-zinc-900 leading-relaxed">{it.text}</div>
                          {it.meta && <div className="text-[11px] text-zinc-500 mt-0.5">{it.meta}</div>}
                          {typeof it.retryCount === "number" && it.retryCount > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                              <RefreshCw className="h-3 w-3 animate-spin" />第 {it.retryCount} 次自愈修复中...
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PRD Confirmation Card */}
              {pendingRunId && prdData && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 mx-4 p-3 rounded-xl bg-blue-50/80 border border-blue-200/60">
                  <div className="text-xs font-medium text-blue-900 mb-1.5">需求分析完成，请确认</div>
                  <div className="text-[11px] text-blue-700"><strong>{prdData.project_name}</strong>{prdData.tagline ? ` · ${prdData.tagline}` : ""}</div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <motion.button type="button" onClick={continueWorkflow} disabled={confirming} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-medium" whileHover={{ scale: confirming ? 1 : 1.02 }} whileTap={{ scale: confirming ? 1 : 0.98 }}>
                      {confirming ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      {confirming ? "处理中..." : "确认并生成"}
                    </motion.button>
                    <motion.button type="button" onClick={() => setPrdPreviewOpen(true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <FileText className="h-3 w-3" />查看 PRD
                    </motion.button>
                    <motion.button type="button" onClick={cancelWorkflow} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-xs font-medium" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <X className="h-3 w-3" />取消
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
          <div ref={chatEndRef} />

          {/* Terminal — bottom of sidebar */}
          {!isEmpty && (
            <div className="shrink-0 border-t border-zinc-200/50">
              <button type="button" onClick={() => setMatrixOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2 text-xs text-zinc-500 hover:text-zinc-700 transition-colors">
                <Terminal className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="font-mono tracking-wide">Terminal</span>
                {matrixOpen ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>
              <AnimatePresence initial={false}>
                {matrixOpen && (
                  <motion.div key="terminal" initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ type: "spring", damping: 22, stiffness: 160 }} className="overflow-hidden">
                    <div className="px-4 pb-2 font-mono text-[10px] leading-4 text-zinc-500 max-h-32 overflow-auto bg-zinc-50/60">
                      {rawLines.slice(-60).map((l, idx) => (<div key={idx} className="whitespace-pre-wrap break-words"><span className="text-zinc-400">{new Date(l.ts).toLocaleTimeString()}</span> {l.text}</div>))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Input Bar — only when not empty */}
          {!isEmpty && (
          <div className="border-t border-zinc-200/50 bg-zinc-50 p-2.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <motion.button type="button" onClick={() => setExpertOpen(true)} className="h-8 w-8 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 shrink-0" title="专家设置" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Settings2 className="h-4 w-4" strokeWidth={1.5} />
              </motion.button>
              <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }} placeholder="继续对话…" className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-zinc-400 focus:bg-white transition-colors" />
              <motion.button type="button" onClick={run} disabled={running} className="rounded-lg bg-zinc-900 p-1.5 text-white hover:bg-zinc-800 disabled:opacity-40 shrink-0" title="发送" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <SendHorizontal className="h-3.5 w-3.5" />
              </motion.button>
            </div>
          </div>
          )}
        </div>

        {/* ─── Right: Canvas ─── */}
        {!isEmpty && (
          <div className="hidden lg:flex flex-col flex-1 bg-zinc-50/50">
            <div className="p-6 flex-1 flex">
              <div className="w-full bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-200/50 overflow-hidden flex flex-col">
                {/* Browser Chrome */}
                <div className="h-10 border-b border-zinc-200/50 flex items-center px-4 shrink-0 bg-white">
                  <div className="flex items-center gap-2 mr-4">
                    <div className="h-[10px] w-[10px] rounded-full bg-red-400/80" />
                    <div className="h-[10px] w-[10px] rounded-full bg-amber-400/80" />
                    <div className="h-[10px] w-[10px] rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">localhost:3003</span>
                </div>
                {/* Viewport */}
                <div className="flex-1 relative">
                  {iframeReady ? (
                    <iframe src={previewUrl || "http://localhost:3003"} className="w-full h-full border-0" title="Preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
                  ) : (
                    renderPreview()
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ExpertPopover isOpen={expertOpen} onClose={() => setExpertOpen(false)} tempConfig={tempConfig} onConfigChange={handleConfigChange} catalog={catalog} onSave={saveDraft} />
      <PRDPreviewModal prd={prdPreviewOpen ? prdData : null} onClose={() => setPrdPreviewOpen(false)} />
    </div>
    </LayoutGroup>
  );
}
