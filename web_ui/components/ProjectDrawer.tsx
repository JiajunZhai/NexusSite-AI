"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectSidebar } from "@/components/ProjectSidebar";

type Step = "PM" | "Designer" | "Coder" | "QA";

export function ProjectDrawer({
  open,
  onClose,
  projectName,
  activeStep,
  doneSteps,
  files,
  onSelectFile,
}: {
  open: boolean;
  onClose: () => void;
  projectName: string;
  activeStep: Step | null;
  doneSteps: Set<Step>;
  files: string[];
  onSelectFile?: (path: string) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute left-0 top-0 h-full w-[min(360px,92vw)] bg-white border-r border-zinc-200 p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-zinc-900">Project Context</div>
          <Button variant="ghost" size="icon" onClick={onClose} title="关闭">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-[calc(100vh-3.5rem-2rem)]">
          <ProjectSidebar
            projectName={projectName}
            activeStep={activeStep}
            doneSteps={doneSteps}
            files={files}
            onSelectFile={onSelectFile}
          />
        </div>
      </motion.div>
    </div>
  );
}

