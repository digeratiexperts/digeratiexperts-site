import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Layers,
  ArrowDown,
  ArrowRight,
  ClipboardList,
  CheckCircle2,
  Cpu,
  RefreshCw,
  GitBranch,
} from "lucide-react";
import { EvidenceFrame } from "../evidence/EvidenceFrame";
import { DiagramNode, SecurityBoundary } from "../evidence/DiagramPrimitives";

export const ProActiveEcosystemDiagram: React.FC = () => {
  const [activeStage, setActiveStage] = useState<number>(0);

  const stages = [
    {
      id: "assess",
      num: "01",
      title: "Discovery & Environmental Assessment",
      detail:
        "Comprehensive audit of active M365 tenants, workstation patch state, firewall rules, and backup immutability.",
      output: "Objective Risk Score & Gap Analysis",
    },
    {
      id: "model",
      num: "02",
      title: "Fit-Based Operating Model",
      detail:
        "Matching your specific environment to IT, Office, Business, or Enterprise — right-sizing controls without bloated overhead.",
      output: "Documented Service Scope & SLAs",
    },
    {
      id: "remediate",
      num: "03",
      title: "Hardening & Integration",
      detail:
        "Deploying EDR sensors, conditional access policies, DNS filtering, and air-gapped backup replication.",
      output: "Hardened Baseline & Runbooks",
    },
    {
      id: "manage",
      num: "04",
      title: "Continuous 24/7 Management",
      detail:
        "Human SOC monitoring, regular restore drills, patch automation, and quarterly strategic reviews (vCIO).",
      output: "Verified Posture & Active Defense",
    },
  ];

  return (
    <EvidenceFrame
      classification="ILLUSTRATIVE"
      title="The ProActive Ecosystem Operating Architecture"
      subtitle="How Digerati Experts transitions organizations from chaotic reactive ticketing to a predictable, fortified operating model."
      status="active"
      statusLabel="OPERATING ARCHITECTURE"
      sourceNote="Digerati Experts Service Delivery Playbook"
      variant="dark"
      className="w-full"
    >
      {/* 4-Stage Sequential Flow Diagram */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-4">
        {stages.map((stage, idx) => {
          const isSelected = activeStage === idx;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(idx)}
              className={`text-left rounded-xl border p-4 transition-all ${
                isSelected
                  ? "border-[#D3126A] bg-[#151217] shadow-[0_0_20px_-4px_rgba(211,18,106,0.3)]"
                  : "border-white/10 bg-black/40 hover:border-white/20"
              }`}
              data-testid={`ecosystem-stage-${stage.id}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-[#F04C97]">{stage.num}</span>
                {isSelected && <span className="h-2 w-2 rounded-full bg-[#D3126A] animate-pulse" />}
              </div>
              <p className="font-heading text-sm font-bold text-white mb-1">{stage.title}</p>
              <p className="font-mono text-[10px] text-white/50">{stage.output}</p>
            </button>
          );
        })}
      </div>

      {/* Stage Detail Deep Dive */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stages[activeStage].id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-white/10 bg-black/50 p-5 font-sans"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-3">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#F04C97]">
              STAGE {stages[activeStage].num} // {stages[activeStage].title}
            </span>
            <span className="font-mono text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verified Milestone
            </span>
          </div>
          <p className="text-sm text-white/80 leading-relaxed mb-4">
            {stages[activeStage].detail}
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#151217] px-3.5 py-2 font-mono text-xs text-white/90">
            <span className="text-white/65">Concrete Deliverable:</span>
            <strong className="text-white">{stages[activeStage].output}</strong>
          </div>
        </motion.div>
      </AnimatePresence>
    </EvidenceFrame>
  );
};
