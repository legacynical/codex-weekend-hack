import type {
  PanelReadinessDiagnostic,
  PanelReadinessRepairOwner,
  PanelReadinessResult,
  SemanticPlaneSlot,
} from "@/core/panelContracts";
import type { SixSurfaceTemplatePresetSize } from "@/schemas/template";

export type ConstructorDiagnosticStatus =
  | "ready"
  | "blocked"
  | "usable"
  | "conflicted"
  | "ambiguous"
  | "failed"
  | "stale";

export type ConstructorDiagnosticSeverity = "info" | "warning" | "error";

export type ConstructorDiagnosticFindingFamily =
  | "readiness"
  | "occupancy"
  | "topology"
  | "conflict"
  | "ambiguity"
  | "resolver-limitation"
  | "appearance";

export type ConstructorDiagnosticSourceOwner =
  | PanelReadinessRepairOwner
  | "modelConstruction"
  | "candidateResolver"
  | "voxelViewer"
  | "projectSaveLoad";

export type ConstructorDiagnosticFinding = Readonly<{
  id: string;
  family: ConstructorDiagnosticFindingFamily;
  severity: ConstructorDiagnosticSeverity;
  code: string;
  message: string;
  sourceOwner: ConstructorDiagnosticSourceOwner;
  panelAssetIds: readonly string[];
  assignmentIds: readonly string[];
  slots: readonly SemanticPlaneSlot[];
  expected?: string;
  actual?: string;
}>;

export type ConstructorDiagnosticCounts = Readonly<{
  errors: number;
  warnings: number;
  conflicts: number;
  ambiguityMarkers: number;
  affectedPanels: number;
  affectedAssignments: number;
}>;

export type ConstructorDiagnosticRunContext = Readonly<{
  source: "panel-readiness" | "constructor" | "resolver" | "import";
  preset?: SixSurfaceTemplatePresetSize;
  schemaVersion: "constructor-diagnostics-v1";
  projectRevisionId?: string;
}>;

export type ConstructorDiagnosticReport = Readonly<{
  status: ConstructorDiagnosticStatus;
  stale: boolean;
  findings: readonly ConstructorDiagnosticFinding[];
  counts: ConstructorDiagnosticCounts;
  runContext: ConstructorDiagnosticRunContext;
}>;

type PanelReadinessReportInput = Readonly<{
  readiness: PanelReadinessResult;
  projectRevisionId?: string;
}>;

export function createPanelReadinessDiagnosticReport({
  readiness,
  projectRevisionId,
}: PanelReadinessReportInput): ConstructorDiagnosticReport {
  const findings = readiness.diagnostics.map(panelReadinessFinding);

  return {
    status: readiness.status,
    stale: false,
    findings,
    counts: countFindings(findings),
    runContext: {
      source: "panel-readiness",
      preset: readiness.status === "ready" ? readiness.activatedPanelSet.preset : firstAcceptedPreset(readiness),
      schemaVersion: "constructor-diagnostics-v1",
      projectRevisionId,
    },
  };
}

export function markConstructorDiagnosticReportStale(
  report: ConstructorDiagnosticReport,
): ConstructorDiagnosticReport {
  if (report.stale && report.status === "stale") {
    return report;
  }

  return {
    ...report,
    status: "stale",
    stale: true,
  };
}

function panelReadinessFinding(
  diagnostic: PanelReadinessDiagnostic,
  index: number,
): ConstructorDiagnosticFinding {
  return {
    id: `readiness-${diagnostic.code}-${index + 1}`,
    family: "readiness",
    severity: diagnostic.severity,
    code: diagnostic.code,
    message: diagnostic.message,
    sourceOwner: diagnostic.repairOwner,
    panelAssetIds: diagnostic.panelAssetId ? [diagnostic.panelAssetId] : [],
    assignmentIds: diagnostic.assignmentId ? [diagnostic.assignmentId] : [],
    slots: isReportSlot(diagnostic.slot) ? [diagnostic.slot] : [],
    expected: diagnostic.expected,
    actual: diagnostic.actual,
  };
}

function countFindings(
  findings: readonly ConstructorDiagnosticFinding[],
): ConstructorDiagnosticCounts {
  return {
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
    conflicts: findings.filter((finding) => finding.family === "conflict").length,
    ambiguityMarkers: findings.filter((finding) => finding.family === "ambiguity").length,
    affectedPanels: new Set(findings.flatMap((finding) => finding.panelAssetIds)).size,
    affectedAssignments: new Set(findings.flatMap((finding) => finding.assignmentIds)).size,
  };
}

function firstAcceptedPreset(readiness: PanelReadinessResult): SixSurfaceTemplatePresetSize | undefined {
  return Object.values(readiness.acceptedPanels)[0]?.preset;
}

function isReportSlot(slot: string | undefined): slot is SemanticPlaneSlot {
  return (
    slot === "front" ||
    slot === "back" ||
    slot === "left" ||
    slot === "right" ||
    slot === "top" ||
    slot === "bottom"
  );
}
