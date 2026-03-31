"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatContainer, type OrchestratorEvent } from "@/components/ChatContainer";
import { LogsDrawer } from "@/components/LogsDrawer";
import { ProjectDrawer } from "@/components/ProjectDrawer";
import { FileViewerModal } from "@/components/FileViewerModal";

const ORCH = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:8000";
const PREVIEW = process.env.NEXT_PUBLIC_SANDBOX_PREVIEW_URL || "http://localhost:3003";
const MARKETING = process.env.NEXT_PUBLIC_MARKETING_URL || "http://localhost:3003";

type Step = "PM" | "Designer" | "Coder" | "QA";

export default function Page() {
  const [projectName, setProjectName] = useState("NexusSite-AI Studio");
  const [activeStep, setActiveStep] = useState<Step | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<Step>>(new Set());
  const [files, setFiles] = useState<string[]>([]);
  const [rawLogs, setRawLogs] = useState<{ ts: number; text: string }[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [viewPath, setViewPath] = useState<string | null>(null);

  const exportUrl = useMemo(() => `${ORCH}/api/export`, []);
  const filesUrl = useMemo(() => `${ORCH}/api/files`, []);

  const onEvent = (evt: OrchestratorEvent) => {
    const line =
      evt.node_name === "RAW"
        ? evt.message
        : `[${evt.node_name}] ${evt.kind}: ${evt.message}`;
    setRawLogs((prev) => [...prev, { ts: evt.ts || Date.now(), text: line }].slice(-800));

    if (evt.node_name === "PM" || evt.node_name === "Designer" || evt.node_name === "Coder" || evt.node_name === "QA") {
      setActiveStep(evt.node_name as Step);
    }
    if (evt.kind === "prd") {
      const name = (evt.data as any)?.project_name;
      if (name) setProjectName(String(name));
      setDoneSteps((prev) => new Set(prev).add("PM"));
    }
    if (evt.kind === "theme_config") {
      setDoneSteps((prev) => new Set(prev).add("Designer"));
    }
    if (evt.kind === "files_written") {
      const f = ((evt.data as any)?.files as string[]) || [];
      if (f.length) setFiles(f);
      setDoneSteps((prev) => new Set(prev).add("Coder"));
    }
    if (evt.kind === "build_result") {
      setDoneSteps((prev) => new Set(prev).add("QA"));
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(filesUrl, { cache: "no-store" });
        const j = await res.json();
        if (!cancelled && j && j.ok && Array.isArray(j.files)) setFiles(j.files);
      } catch {
        // ignore; fallback to agent-provided files
      }
    }
    load();
    const t = window.setInterval(load, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [filesUrl]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-white">
      <ProjectDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        projectName={projectName}
        activeStep={activeStep}
        doneSteps={doneSteps}
        files={files}
        onSelectFile={(p) => setViewPath(p)}
      />

      <LogsDrawer open={logsOpen} onClose={() => setLogsOpen(false)} lines={rawLogs} />
      <FileViewerModal
        open={!!viewPath}
        onClose={() => setViewPath(null)}
        orchestratorUrl={ORCH}
        path={viewPath}
      />

      <ChatContainer
        orchestratorUrl={ORCH}
        onEvent={onEvent}
        rawLines={rawLogs}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        onToggleLogs={() => setLogsOpen(true)}
        marketingUrl={MARKETING}
        previewUrl={PREVIEW}
      />
    </div>
  );
}
