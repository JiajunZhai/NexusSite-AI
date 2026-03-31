"use client";

import { CheckCircle2, Circle, Code2, FileText, Palette, ShieldCheck, Target } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type Step = "PM" | "Designer" | "Coder" | "QA";

const STEPS: { key: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "PM", label: "规划 PRD", icon: Target },
  { key: "Designer", label: "生成主题", icon: Palette },
  { key: "Coder", label: "写入代码", icon: Code2 },
  { key: "QA", label: "构建验收", icon: ShieldCheck },
];

export function ProjectSidebar({
  projectName,
  activeStep,
  doneSteps,
  files,
  variant = "panel",
  onSelectFile,
}: {
  projectName: string;
  activeStep: Step | null;
  doneSteps: Set<Step>;
  files: string[];
  variant?: "panel" | "sidebar";
  onSelectFile?: (path: string) => void;
}) {
  return (
    <motion.div
      layout
      transition={{ type: "spring", damping: 20, stiffness: 120 }}
      className={cn(
        "h-full",
        variant === "panel" && "rounded-xl border border-zinc-200 bg-white p-4",
        variant === "sidebar" && "border-r border-zinc-100 bg-zinc-50/50 p-4"
      )}
    >
      <div className="text-xs text-zinc-500">Project Context</div>
      <div className="mt-1 text-sm font-semibold text-zinc-900 truncate">{projectName}</div>

      <div className="mt-4 space-y-2">
        <div className="text-xs font-medium text-zinc-600">Pipeline</div>
        <ul className="space-y-2">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const done = doneSteps.has(s.key);
            const active = activeStep === s.key;
            return (
              <li key={s.key} className={cn("flex items-center gap-2 rounded-lg px-2 py-2", active && "bg-zinc-50")}>
                <div className="flex items-center gap-2 min-w-0">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className={cn("h-4 w-4", active ? "text-zinc-900" : "text-zinc-300")} />
                  )}
                  <Icon className={cn("h-4 w-4", active ? "text-zinc-900" : "text-zinc-500")} />
                  <span className={cn("text-xs truncate", active ? "text-zinc-900 font-medium" : "text-zinc-600")}>
                    {s.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4">
        <div className="text-xs font-medium text-zinc-600">Files</div>
        <motion.div
          layout
          transition={{ type: "spring", damping: 20, stiffness: 120 }}
          className={cn(
            "mt-2 max-h-[60vh] overflow-auto text-[11px] font-mono text-zinc-700",
            variant === "panel" && "rounded-lg border border-zinc-200 bg-zinc-50 p-2",
            variant === "sidebar" && "rounded-md border border-zinc-200 bg-white/60 p-2"
          )}
        >
          {files.length ? (
            files.slice(0, 200).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onSelectFile?.(f)}
                className="group flex w-full items-center gap-2 truncate text-left text-zinc-700 hover:text-zinc-900"
                title={f}
              >
                <FileText className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-600 shrink-0" />
                <span className="truncate">{f}</span>
              </button>
            ))
          ) : (
            <div className="text-zinc-400">暂无文件</div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

