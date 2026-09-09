import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

const evidenceFrameSrc = readFileSync(resolve(currentDir, "EvidenceFrame.tsx"), "utf8");
const statusTokenSrc = readFileSync(resolve(currentDir, "StatusToken.tsx"), "utf8");
const proofChipSrc = readFileSync(resolve(currentDir, "ProofChip.tsx"), "utf8");
const hudFrameSrc = readFileSync(resolve(currentDir, "HUDFrame.tsx"), "utf8");
const incidentFlowSrc = readFileSync(resolve(currentDir, "IncidentFlow.tsx"), "utf8");
const diagramPrimitivesSrc = readFileSync(resolve(currentDir, "DiagramPrimitives.tsx"), "utf8");
const assessmentReportSrc = readFileSync(resolve(currentDir, "AssessmentReportSample.tsx"), "utf8");
const protectionDeckSrc = readFileSync(resolve(currentDir, "../visual/ProtectionCommandDeck.tsx"), "utf8");
const ecosystemDiagramSrc = readFileSync(resolve(currentDir, "../visual/ProActiveEcosystemDiagram.tsx"), "utf8");

describe("DE Visual System v2 Primitives Integrity", () => {
  it("enforces truthfulness classifications in EvidenceFrame", () => {
    expect(evidenceFrameSrc).toMatch(/export type EvidenceClassification/);
    expect(evidenceFrameSrc).toMatch(/LIVE/);
    expect(evidenceFrameSrc).toMatch(/SANITIZED_REAL/);
    expect(evidenceFrameSrc).toMatch(/EXAMPLE/);
    expect(evidenceFrameSrc).toMatch(/ILLUSTRATIVE/);
  });

  it("keeps health-state semantics separate from brand/action color", () => {
    expect(statusTokenSrc).toMatch(/active:/);
    expect(statusTokenSrc).toMatch(/emerald-400/);
    expect(statusTokenSrc).toMatch(/#D3126A/);
  });

  it("provides factual metrics and Lucide icon support in ProofChip", () => {
    expect(proofChipSrc).toMatch(/export const ProofChip/);
    expect(proofChipSrc).toMatch(/metric\?:/);
    expect(proofChipSrc).toMatch(/variant\?: "dark" \| "paper"/);
  });

  it("scopes HUDFrame to precision framing with DE magenta corner marks", () => {
    expect(hudFrameSrc).toMatch(/Precision framing for evidence, diagrams, and operational UI only/);
    expect(hudFrameSrc).toMatch(/technicalId\?:/);
    expect(hudFrameSrc).toMatch(/border-\[#D3126A\]/);
  });

  it("marks IncidentFlow explicitly as an EXAMPLE and disclaims live telemetry or SLA claims", () => {
    expect(incidentFlowSrc).toMatch(/classification="EXAMPLE"/);
    expect(incidentFlowSrc).toMatch(/Example incident response flow/);
    expect(incidentFlowSrc).toMatch(/not live telemetry/);
    expect(incidentFlowSrc).toMatch(/not .*measured SLA|measured SLA/);
    expect(incidentFlowSrc).not.toMatch(/Neutralized in \d+m/i);
  });

  it("exports DiagramPrimitives including SecurityBoundary, DiagramNode, and ControlGate", () => {
    expect(diagramPrimitivesSrc).toMatch(/export const SecurityBoundary/);
    expect(diagramPrimitivesSrc).toMatch(/export const DiagramNode/);
    expect(diagramPrimitivesSrc).toMatch(/export const ControlGate/);
  });

  it("keeps AssessmentReportSample explicitly ILLUSTRATIVE until approved real evidence exists", () => {
    expect(assessmentReportSrc).toMatch(/classification="ILLUSTRATIVE"/);
    expect(assessmentReportSrc).toMatch(/Illustrative Cyber Risk Assessment excerpt/);
    expect(assessmentReportSrc).toMatch(/not a real client report/);
    expect(assessmentReportSrc).not.toMatch(/classification="SANITIZED_REAL"/);
    expect(assessmentReportSrc).not.toMatch(/35-user medical practice/i);
    expect(assessmentReportSrc).not.toMatch(/Delivered: Day 7/i);
  });

  it("implements the eight cybersecurity blocks in ProtectionCommandDeck with explicit ILLUSTRATIVE classification", () => {
    expect(protectionDeckSrc).toMatch(/classification="ILLUSTRATIVE"/);
    // docs/DE-SERVICE-MODEL-2026.md: eight blocks, Risk & Exposure retained as
    // the continuous visibility and intelligence layer, not dropped for an old
    // six-count. Data & Recovery and Governance & Compliance are capability
    // lanes, not blocks, and must not reappear here.
    for (const id of ["identity", "endpoint", "email", "browser", "network", "detection", "human", "exposure"]) {
      expect(protectionDeckSrc).toMatch(new RegExp(`id: "${id}"`));
    }
    expect(protectionDeckSrc.match(/^\s{4}id: "/gm)).toHaveLength(8);
    expect(protectionDeckSrc).toMatch(/continuous: true/);
    expect(protectionDeckSrc).not.toMatch(/id: "recovery"/);
    expect(protectionDeckSrc).not.toMatch(/id: "compliance"/);
    expect(protectionDeckSrc).not.toMatch(/Six-domain/);
  });

  it("implements 4-stage lifecycle in ProActiveEcosystemDiagram without claiming live telemetry", () => {
    expect(ecosystemDiagramSrc).toMatch(/classification="ILLUSTRATIVE"/);
    expect(ecosystemDiagramSrc).toMatch(/ProActive Ecosystem/);
    expect(ecosystemDiagramSrc).not.toMatch(/classification="LIVE"/);
  });
});
