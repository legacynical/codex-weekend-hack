import {
  attachConstructorOutput,
  type ActiveProjectState,
  type ConstructorCandidateData,
  type ConstructorOutputStatus,
} from "@/core/activeProjectState";
import { createConstructorDiagnosticReport } from "@/core/constructorDiagnostics";
import {
  semanticPlaneSlots,
  type ActivatedPanelSet,
  type SemanticPlaneSlot,
} from "@/core/panelContracts";
import type { ViewPanel } from "@/core/panels";
import { reconstructProjectedHull, surfaceViews } from "@/core/projection";
import { validateVoxelCandidate } from "@/validation/voxelValidation";

export type ActivatedPanelConstructionResult = Readonly<{
  status: ConstructorOutputStatus;
  candidate: ConstructorCandidateData;
  diagnosticReport: ReturnType<typeof createConstructorDiagnosticReport>;
}>;

export function viewPanelsFromActivatedPanelSet(panelSet: ActivatedPanelSet): readonly ViewPanel[] {
  return semanticPlaneSlots.map((slot) => {
    const panel = panelSet.panels[slot];
    const view = signedViewForSlot(slot);
    const pixels = Array.from({ length: panelSet.preset * panelSet.preset }, () => ({
      occupied: false,
      color: null as string | null,
    }));

    for (const cell of panel.cells) {
      pixels[cell.y * panelSet.preset + cell.x] = {
        occupied: cell.occupied,
        color: cell.color,
      };
    }

    return {
      ...view,
      width: panelSet.preset,
      height: panelSet.preset,
      pixels,
    };
  });
}

export function constructActivatedPanelSet(
  panelSet: ActivatedPanelSet,
  options: Readonly<{ projectRevisionId?: string }> = {},
): ActivatedPanelConstructionResult {
  const panels = viewPanelsFromActivatedPanelSet(panelSet);
  const size = { x: panelSet.preset, y: panelSet.preset, z: panelSet.preset };
  const construction = reconstructProjectedHull(size, panels);
  const validationReport = validateVoxelCandidate(construction.volume, panels);
  const candidate: ConstructorCandidateData = {
    volume: construction.volume,
    panels,
    conflictMarkers: construction.conflictMarkers,
    ambiguityMarkers: construction.ambiguityMarkers,
    validationReport,
  };
  const diagnosticReport = createConstructorDiagnosticReport({
    preset: panelSet.preset,
    validationReport,
    conflictMarkers: candidate.conflictMarkers,
    ambiguityMarkers: candidate.ambiguityMarkers,
    projectRevisionId: options.projectRevisionId,
  });

  return {
    status: constructorOutputStatus(diagnosticReport.status),
    candidate,
    diagnosticReport,
  };
}

export function constructAndAttachActiveProject(project: ActiveProjectState): ActiveProjectState {
  if (project.readiness.status !== "ready") {
    throw new Error("Cannot construct an active project until all six panel assignments are ready.");
  }

  return attachConstructorOutput(
    project,
    constructActivatedPanelSet(project.readiness.activatedPanelSet),
  );
}

function signedViewForSlot(slot: SemanticPlaneSlot) {
  const view = surfaceViews.find((candidate) => candidate.surface === slot);

  if (!view) {
    throw new Error(`Missing signed projection view for ${slot}.`);
  }

  return view;
}

function constructorOutputStatus(
  status: ReturnType<typeof createConstructorDiagnosticReport>["status"],
): ConstructorOutputStatus {
  switch (status) {
    case "conflicted":
      return "conflicted";
    case "ambiguous":
      return "ambiguous";
    case "usable":
      return "succeeded";
    default:
      return "invalid";
  }
}
