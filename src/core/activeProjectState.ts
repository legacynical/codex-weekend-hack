import {
  deriveActivatedPanelSet,
  semanticPlaneSlots,
  type ActivatedPanelSet,
  type PanelAsset,
  type PanelAssignment,
  type PanelReadinessResult,
  type SemanticPlaneSlot,
} from "@/core/panelContracts";
import {
  markConstructorDiagnosticReportStale,
  type ConstructorDiagnosticReport,
} from "@/core/constructorDiagnostics";
import type { PanelAssetCandidate } from "@/assets/assetProcessing";

export type ConstructorOutputStatus = "succeeded" | "invalid" | "conflicted" | "ambiguous";

export type ConstructorOutputAttachment = Readonly<{
  status: ConstructorOutputStatus;
  stale: boolean;
  activatedPanelSet: ActivatedPanelSet;
  diagnosticReport: ConstructorDiagnosticReport;
}>;

export type ActiveProjectLifecycleStatus =
  | "empty"
  | "assets-present"
  | "assignments-incomplete"
  | "constructor-ready"
  | "constructor-stale"
  | "constructor-attached";

export type ActiveProjectState = Readonly<{
  id: string;
  name: string;
  dirty: boolean;
  savedPanelAssets: readonly PanelAsset[];
  activeAssignments: readonly PanelAssignment[];
  readiness: PanelReadinessResult;
  constructorOutput: ConstructorOutputAttachment | null;
}>;

export type ActiveProjectSummary = Readonly<{
  status: ActiveProjectLifecycleStatus;
  savedAssetCount: number;
  assignmentCoverage: Record<SemanticPlaneSlot, boolean>;
  readinessStatus: PanelReadinessResult["status"];
  constructorStatus: ConstructorOutputAttachment["status"] | "not-run";
  staleConstructorOutput: boolean;
  diagnosticCount: number;
}>;

type CreateActiveProjectInput = Readonly<{
  id: string;
  name?: string;
}>;

type AssignPanelInput = Readonly<{
  id: string;
  panelAssetId: string;
  slot: SemanticPlaneSlot;
}>;

type SavePanelAssetCandidateInput = Readonly<{
  id: string;
  candidate: PanelAssetCandidate;
}>;

type AttachConstructorOutputInput = Readonly<{
  status: ConstructorOutputStatus;
  diagnosticReport: ConstructorDiagnosticReport;
}>;

export function createActiveProject(input: CreateActiveProjectInput): ActiveProjectState {
  return withDerivedReadiness({
    id: input.id,
    name: input.name ?? "Untitled project",
    dirty: false,
    savedPanelAssets: [],
    activeAssignments: [],
    constructorOutput: null,
  });
}

export function addSavedPanelAsset(project: ActiveProjectState, panelAsset: PanelAsset): ActiveProjectState {
  const savedPanelAssets = [
    ...project.savedPanelAssets.filter((existing) => existing.id !== panelAsset.id),
    panelAsset,
  ];

  return withDerivedReadiness({
    ...project,
    dirty: true,
    savedPanelAssets,
    constructorOutput: markConstructorOutputStale(project.constructorOutput),
  });
}

export function savePanelAssetCandidate(
  project: ActiveProjectState,
  input: SavePanelAssetCandidateInput,
): ActiveProjectState {
  return addSavedPanelAsset(project, createProjectPanelAsset(input));
}

export function removeSavedPanelAsset(project: ActiveProjectState, panelAssetId: string): ActiveProjectState {
  const savedPanelAssets = project.savedPanelAssets.filter((panelAsset) => panelAsset.id !== panelAssetId);
  const activeAssignments = project.activeAssignments.filter((assignment) => assignment.panelAssetId !== panelAssetId);

  return withDerivedReadiness({
    ...project,
    dirty: true,
    savedPanelAssets,
    activeAssignments,
    constructorOutput: markConstructorOutputStale(project.constructorOutput),
  });
}

export function assignPanelToSlot(project: ActiveProjectState, input: AssignPanelInput): ActiveProjectState {
  const activeAssignments = [
    ...project.activeAssignments.filter((assignment) => assignment.slot !== input.slot),
    {
      id: input.id,
      panelAssetId: input.panelAssetId,
      slot: input.slot,
    },
  ];

  return withDerivedReadiness({
    ...project,
    dirty: true,
    activeAssignments,
    constructorOutput: markConstructorOutputStale(project.constructorOutput),
  });
}

export function clearPanelAssignment(project: ActiveProjectState, slot: SemanticPlaneSlot): ActiveProjectState {
  const activeAssignments = project.activeAssignments.filter((assignment) => assignment.slot !== slot);

  return withDerivedReadiness({
    ...project,
    dirty: true,
    activeAssignments,
    constructorOutput: markConstructorOutputStale(project.constructorOutput),
  });
}

export function createProjectPanelAsset(input: SavePanelAssetCandidateInput): PanelAsset {
  const id = input.id.trim();

  if (!id) {
    throw new Error("Saved panel asset id is required.");
  }

  return {
    ...input.candidate,
    id,
  };
}

export function attachConstructorOutput(
  project: ActiveProjectState,
  input: AttachConstructorOutputInput,
): ActiveProjectState {
  if (project.readiness.status !== "ready") {
    throw new Error("Cannot attach constructor output until active panel assignments are constructor-ready.");
  }

  return {
    ...project,
    dirty: true,
    constructorOutput: {
      status: input.status,
      stale: false,
      activatedPanelSet: project.readiness.activatedPanelSet,
      diagnosticReport: input.diagnosticReport,
    },
  };
}

export function summarizeActiveProject(project: ActiveProjectState): ActiveProjectSummary {
  const assignmentCoverage = Object.fromEntries(
    semanticPlaneSlots.map((slot) => [slot, project.activeAssignments.some((assignment) => assignment.slot === slot)]),
  ) as Record<SemanticPlaneSlot, boolean>;
  const staleConstructorOutput = Boolean(project.constructorOutput?.stale);

  return {
    status: getLifecycleStatus(project),
    savedAssetCount: project.savedPanelAssets.length,
    assignmentCoverage,
    readinessStatus: project.readiness.status,
    constructorStatus: project.constructorOutput?.status ?? "not-run",
    staleConstructorOutput,
    diagnosticCount: project.readiness.diagnostics.length + (project.constructorOutput?.diagnosticReport.findings.length ?? 0),
  };
}

function withDerivedReadiness(
  project: Omit<ActiveProjectState, "readiness">,
): ActiveProjectState {
  return {
    ...project,
    readiness: deriveActivatedPanelSet({
      panelAssets: project.savedPanelAssets,
      assignments: project.activeAssignments,
    }),
  };
}

function markConstructorOutputStale(
  constructorOutput: ConstructorOutputAttachment | null,
): ConstructorOutputAttachment | null {
  if (!constructorOutput) {
    return null;
  }

  return {
    ...constructorOutput,
    stale: true,
    diagnosticReport: markConstructorDiagnosticReportStale(constructorOutput.diagnosticReport),
  };
}

function getLifecycleStatus(project: ActiveProjectState): ActiveProjectLifecycleStatus {
  if (project.constructorOutput && !project.constructorOutput.stale) {
    return "constructor-attached";
  }

  if (project.constructorOutput?.stale) {
    return "constructor-stale";
  }

  if (project.readiness.status === "ready") {
    return "constructor-ready";
  }

  if (project.activeAssignments.length > 0) {
    return "assignments-incomplete";
  }

  if (project.savedPanelAssets.length > 0) {
    return "assets-present";
  }

  return "empty";
}
