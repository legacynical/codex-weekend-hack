import type { AssetProcessingResult, ProcessingDiagnostic } from "@/assets/assetProcessing";
import { constructAndAttachActiveProject } from "@/core/activatedPanelConstruction";
import {
  assignPanelToSlot,
  clearPanelAssignment,
  createActiveProject,
  savePanelAssetCandidate,
  type ActiveProjectState,
} from "@/core/activeProjectState";
import { semanticPlaneSlots, type SemanticPlaneSlot } from "@/core/panelContracts";
import type { GridTemplateSize } from "@/templates/templateImage";

export type UploadRequest = Readonly<{
  slot: SemanticPlaneSlot;
  preset: GridTemplateSize;
  fileName: string;
  retryIntent: "firstAttempt" | "replacementSource";
}>;

export type UploadSlotState =
  | Readonly<{
      phase: "empty";
      fileName?: never;
      diagnostics: readonly ProcessingDiagnostic[];
    }>
  | Readonly<{
      phase: "pending" | "replacing";
      request: UploadRequest;
      fileName: string;
      diagnostics: readonly ProcessingDiagnostic[];
    }>
  | Readonly<{
      phase: "accepted";
      fileName: string;
      processedPreset: GridTemplateSize;
      diagnostics: readonly ProcessingDiagnostic[];
    }>
  | Readonly<{
      phase: "rejected";
      fileName: string;
      processedPreset?: GridTemplateSize;
      diagnostics: readonly ProcessingDiagnostic[];
    }>;

export type UploadState = Readonly<{
  resolution: GridTemplateSize;
  slots: Readonly<Record<SemanticPlaneSlot, UploadSlotState>>;
  project: ActiveProjectState;
}>;

export type UploadAction =
  | Readonly<{ type: "resolutionChanged"; resolution: GridTemplateSize }>
  | Readonly<{ type: "uploadStarted"; request: UploadRequest }>
  | Readonly<{ type: "uploadFinished"; request: UploadRequest; result: AssetProcessingResult }>;

export function createUploadState(): UploadState {
  const emptySlot: UploadSlotState = { phase: "empty", diagnostics: [] };

  return {
    resolution: 16,
    slots: {
      front: emptySlot,
      back: emptySlot,
      left: emptySlot,
      right: emptySlot,
      top: emptySlot,
      bottom: emptySlot,
    },
    project: createActiveProject({ id: "upload-project", name: "Upload project" }),
  };
}

export function createUploadRequest(
  state: UploadState,
  slot: SemanticPlaneSlot,
  fileName: string,
): UploadRequest {
  return {
    slot,
    preset: state.resolution,
    fileName,
    retryIntent: state.slots[slot].phase !== "empty" ? "replacementSource" : "firstAttempt",
  };
}

export function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case "resolutionChanged": {
      if (action.resolution === state.resolution) {
        return state;
      }

      const slots = { ...state.slots };

      for (const slot of semanticPlaneSlots) {
        const current = slots[slot];

        if (current.phase === "pending" || current.phase === "replacing") {
          slots[slot] = {
            phase: "rejected",
            fileName: current.fileName,
            diagnostics: [presetChangedDiagnostic(current.fileName, action.resolution)],
          };
        }
      }

      return { ...state, resolution: action.resolution, slots };
    }
    case "uploadStarted": {
      const { request } = action;
      const project = state.project.activeAssignments.some((assignment) => assignment.slot === request.slot)
        ? clearPanelAssignment(state.project, request.slot)
        : state.project;

      return {
        ...state,
        project,
        slots: {
          ...state.slots,
          [request.slot]: {
            phase: request.retryIntent === "replacementSource" ? "replacing" : "pending",
            request,
            fileName: request.fileName,
            diagnostics: [],
          },
        },
      };
    }
    case "uploadFinished": {
      const { request, result } = action;
      const current = state.slots[request.slot];

      if ((current.phase !== "pending" && current.phase !== "replacing") || current.request !== request) {
        return state;
      }

      let project = state.project;

      if (result.status !== "rejected") {
        const withAsset = savePanelAssetCandidate(project, {
          id: `upload-panel-${request.slot}`,
          candidate: result.candidate,
        });
        const withAssignment = assignPanelToSlot(withAsset, {
          id: `active-panel-${request.slot}`,
          panelAssetId: `upload-panel-${request.slot}`,
          slot: request.slot,
        });

        project = withAssignment.readiness.status === "ready"
          ? constructAndAttachActiveProject(withAssignment)
          : withAssignment;
      }

      return {
        ...state,
        project,
        slots: {
          ...state.slots,
          [request.slot]: {
            phase: result.status === "rejected" ? "rejected" : "accepted",
            fileName: request.fileName,
            processedPreset: request.preset,
            diagnostics: result.diagnostics,
          },
        },
      };
    }
  }
}

function presetChangedDiagnostic(fileName: string, resolution: GridTemplateSize): ProcessingDiagnostic {
  return {
    severity: "error",
    code: "decodeFailure",
    message: `Panel grid size changed before ${fileName} finished processing. Select it again for ${resolution} x ${resolution}.`,
    sourceKind: "upload",
    sourceLabel: fileName,
    parserPolicy: "strict-v1",
    repairOwner: "presetChoice",
  };
}
