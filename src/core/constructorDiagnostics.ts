import type {
  PanelReadinessDiagnostic,
  PanelReadinessRepairOwner,
  PanelReadinessResult,
  SemanticPlaneSlot,
} from "@/core/panelContracts";
import type { SixSurfaceTemplatePresetSize } from "@/schemas/template";
import type { ProjectionMarker } from "@/core/projection";
import type { ValidationReport } from "@/validation/voxelValidation";

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

type ConstructorDiagnosticReportInput = Readonly<{
  preset: SixSurfaceTemplatePresetSize;
  validationReport: ValidationReport;
  conflictMarkers?: readonly ProjectionMarker[];
  ambiguityMarkers?: readonly ProjectionMarker[];
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

export function createConstructorDiagnosticReport({
  preset,
  validationReport,
  conflictMarkers = [],
  ambiguityMarkers = [],
  projectRevisionId,
}: ConstructorDiagnosticReportInput): ConstructorDiagnosticReport {
  const findings = [
    ...validationFindings(validationReport),
    ...(conflictMarkers.length > 0
      ? [
          constructorFinding({
            id: "constructor-color-conflicts",
            family: "conflict",
            severity: "error",
            code: "surfaceColorConflict",
            message: `${conflictMarkers.length} projected surface color conflict markers require review.`,
            sourceOwner: "candidateResolver",
            actual: `${conflictMarkers.length}`,
          }),
        ]
      : []),
    ...(ambiguityMarkers.length > 0
      ? [
          constructorFinding({
            id: "constructor-ambiguity-markers",
            family: "ambiguity",
            severity: "warning",
            code: "underSpecifiedCandidate",
            message: `${ambiguityMarkers.length} candidate positions are under-specified by the active panels.`,
            sourceOwner: "candidateResolver",
            actual: `${ambiguityMarkers.length}`,
          }),
        ]
      : []),
  ];
  const status = conflictMarkers.length > 0
    ? "conflicted"
    : ambiguityMarkers.length > 0
      ? "ambiguous"
      : validationReport.status === "valid"
        ? "usable"
        : "failed";

  return {
    status,
    stale: false,
    findings,
    counts: countFindings(findings),
    runContext: {
      source: "constructor",
      preset,
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

function validationFindings(report: ValidationReport): ConstructorDiagnosticFinding[] {
  const findings: ConstructorDiagnosticFinding[] = [];

  if (!report.geometry.connected) {
    findings.push(constructorFinding({
      id: "constructor-disconnected-volume",
      family: "topology",
      severity: "error",
      code: "disconnectedVolume",
      message: "The constructed voxel candidate is disconnected.",
      sourceOwner: "modelConstruction",
    }));
  }

  if (!report.geometry.watertight) {
    findings.push(constructorFinding({
      id: "constructor-enclosed-voids",
      family: "topology",
      severity: "error",
      code: "enclosedVoids",
      message: "The constructed voxel candidate contains enclosed voids.",
      sourceOwner: "modelConstruction",
    }));
  }

  if (report.geometry.unsupportedFloatingVoxels.length > 0) {
    findings.push(constructorFinding({
      id: "constructor-unsupported-floating-voxels",
      family: "topology",
      severity: "error",
      code: "unsupportedFloatingVoxels",
      message: `${report.geometry.unsupportedFloatingVoxels.length} unsupported floating voxels were found.`,
      sourceOwner: "modelConstruction",
      actual: `${report.geometry.unsupportedFloatingVoxels.length}`,
    }));
  }

  if (report.geometry.silhouetteMismatches.length > 0) {
    findings.push(constructorFinding({
      id: "constructor-silhouette-mismatches",
      family: "occupancy",
      severity: "error",
      code: "silhouetteMismatch",
      message: `${report.geometry.silhouetteMismatches.length} source-panel silhouette mismatches were found.`,
      sourceOwner: "modelConstruction",
      actual: `${report.geometry.silhouetteMismatches.length}`,
    }));
  }

  if (!report.color.coherent) {
    findings.push(constructorFinding({
      id: "constructor-color-mismatches",
      family: "appearance",
      severity: "error",
      code: "surfaceColorMismatch",
      message: `${report.color.mismatches.length} source-panel color mismatches were found.`,
      sourceOwner: "candidateResolver",
      actual: `${report.color.mismatches.length}`,
    }));
  }

  return findings;
}

function constructorFinding(
  finding: Omit<ConstructorDiagnosticFinding, "panelAssetIds" | "assignmentIds" | "slots">,
): ConstructorDiagnosticFinding {
  return {
    ...finding,
    panelAssetIds: [],
    assignmentIds: [],
    slots: [],
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
