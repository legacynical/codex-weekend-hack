import { describe, expect, it } from "vitest";

import type { AcceptedAssetProcessingResult, RejectedAssetProcessingResult } from "@/assets/assetProcessing";
import { semanticPlaneSlots, type SemanticPlaneSlot } from "@/core/panelContracts";
import {
  createUploadRequest,
  createUploadState,
  uploadReducer,
  type UploadRequest,
  type UploadState,
} from "@/core/uploadState";

describe("upload state", () => {
  it("starts with six empty slots and the upload project", () => {
    const state = createUploadState();

    expect(state.resolution).toBe(16);
    expect(Object.keys(state.slots)).toEqual(semanticPlaneSlots);
    expect(Object.values(state.slots)).toEqual(semanticPlaneSlots.map(() => ({ phase: "empty", diagnostics: [] })));
    expect(state.project).toMatchObject({ id: "upload-project", name: "Upload project", savedPanelAssets: [], activeAssignments: [] });
  });

  it.each(["accepted", "acceptedWithWarnings"] as const)("saves and assigns a current %s completion", (status) => {
    const initial = createUploadState();
    const request = createUploadRequest(initial, "front", "front.png");
    const pending = uploadReducer(initial, { type: "uploadStarted", request });
    const result = { ...accepted(request), status };
    const completed = uploadReducer(pending, { type: "uploadFinished", request, result });

    expect(request).toEqual({ slot: "front", fileName: "front.png", preset: 16, retryIntent: "firstAttempt" });
    expect(pending.slots.front).toEqual({ phase: "pending", fileName: "front.png", request, diagnostics: [] });
    expect(pending.project).toBe(initial.project);
    expect(completed.slots.front).toEqual({ phase: "accepted", fileName: "front.png", processedPreset: 16, diagnostics: result.diagnostics });
    expect(completed.project.savedPanelAssets).toEqual([{ ...result.candidate, id: "upload-panel-front" }]);
    expect(completed.project.activeAssignments).toEqual([{ id: "active-panel-front", panelAssetId: "upload-panel-front", slot: "front" }]);
    expect(completed.slots.back).toBe(initial.slots.back);
    expect(pending.slots.front.phase).toBe("pending");
  });

  it("keeps rejection diagnostics and uses replacement semantics when retrying", () => {
    const initial = createUploadState();
    const request = createUploadRequest(initial, "front", "invalid.png");
    const pending = uploadReducer(initial, { type: "uploadStarted", request });
    const rejected = uploadReducer(pending, { type: "uploadFinished", request, result: rejection });
    const retry = createUploadRequest(rejected, "front", "retry.png");
    const retrying = uploadReducer(rejected, { type: "uploadStarted", request: retry });
    const nextRetry = createUploadRequest(retrying, "front", "newer.png");

    expect(rejected.slots.front).toEqual({ phase: "rejected", fileName: "invalid.png", processedPreset: 16, diagnostics: rejection.diagnostics });
    expect(rejected.project).toBe(initial.project);
    expect(retry.retryIntent).toBe("replacementSource");
    expect(retrying.slots.front).toEqual({ phase: "replacing", fileName: "retry.png", request: retry, diagnostics: [] });
    expect(nextRetry.retryIntent).toBe("replacementSource");
  });

  it.each(["success", "rejection"] as const)("ignores superseded %s even for identical request metadata", (outcome) => {
    const initial = createUploadState();
    const oldRequest = createUploadRequest(initial, "front", "front.png");
    const currentRequest = createUploadRequest(initial, "front", "front.png");
    const firstPending = uploadReducer(initial, { type: "uploadStarted", request: oldRequest });
    const currentPending = uploadReducer(firstPending, { type: "uploadStarted", request: currentRequest });

    expect(currentRequest).toEqual(oldRequest);
    expect(currentRequest).not.toBe(oldRequest);
    expect(uploadReducer(currentPending, {
      type: "uploadFinished",
      request: oldRequest,
      result: outcome === "success" ? accepted(oldRequest) : rejection,
    })).toBe(currentPending);

    const completed = uploadReducer(currentPending, { type: "uploadFinished", request: currentRequest, result: accepted(currentRequest) });

    expect(completed.project.savedPanelAssets).toHaveLength(1);
    expect(completed.slots.front.phase).toBe("accepted");
  });

  it.each(["success", "rejection"] as const)("ignores duplicate completion after a terminal %s", (outcome) => {
    const initial = createUploadState();
    const request = createUploadRequest(initial, "front", "front.png");
    const pending = uploadReducer(initial, { type: "uploadStarted", request });
    const completed = uploadReducer(pending, {
      type: "uploadFinished",
      request,
      result: outcome === "success" ? accepted(request) : rejection,
    });

    expect(uploadReducer(completed, { type: "uploadFinished", request, result: accepted(request) })).toBe(completed);
    expect(uploadReducer(completed, { type: "uploadFinished", request, result: rejection })).toBe(completed);
  });

  it.each([["front", "back"], ["back", "front"]] as const)("retains both concurrent slots when %s finishes before %s", (firstSlot, secondSlot) => {
    const initial = createUploadState();
    const first = createUploadRequest(initial, firstSlot, `${firstSlot}.png`);
    const second = createUploadRequest(initial, secondSlot, `${secondSlot}.png`);
    const firstPending = uploadReducer(initial, { type: "uploadStarted", request: first });
    const bothPending = uploadReducer(firstPending, { type: "uploadStarted", request: second });
    const firstCompleted = uploadReducer(bothPending, { type: "uploadFinished", request: first, result: accepted(first) });
    const completed = uploadReducer(firstCompleted, { type: "uploadFinished", request: second, result: accepted(second) });

    expect(completed.slots[firstSlot]).toBe(firstCompleted.slots[firstSlot]);
    expect(completed.slots[secondSlot].phase).toBe("accepted");
    expect(completed.project.savedPanelAssets.map((asset) => asset.id)).toEqual([`upload-panel-${firstSlot}`, `upload-panel-${secondSlot}`]);
    expect(completed.project.activeAssignments.map((assignment) => assignment.slot)).toEqual([firstSlot, secondSlot]);
    expect(uploadReducer(completed, { type: "uploadFinished", request: first, result: rejection })).toBe(completed);
  });

  it("does not cancel processing when selecting the same resolution", () => {
    const initial = createUploadState();
    const request = createUploadRequest(initial, "front", "front.png");
    const pending = uploadReducer(initial, { type: "uploadStarted", request });

    expect(uploadReducer(pending, { type: "resolutionChanged", resolution: 16 })).toBe(pending);
    expect(uploadReducer(pending, { type: "uploadFinished", request, result: accepted(request) }).slots.front.phase).toBe("accepted");
  });

  it("cancels processing on preset change while retaining accepted and rejected slots and the project", () => {
    const acceptedState = acceptSlot(createUploadState(), "front");
    const rejectedRequest = createUploadRequest(acceptedState, "left", "invalid.png");
    const rejectedPending = uploadReducer(acceptedState, { type: "uploadStarted", request: rejectedRequest });
    const rejectedState = uploadReducer(rejectedPending, { type: "uploadFinished", request: rejectedRequest, result: rejection });
    const pendingRequest = createUploadRequest(rejectedState, "back", "pending.png");
    const pending = uploadReducer(rejectedState, { type: "uploadStarted", request: pendingRequest });
    const replacingRequest = createUploadRequest(pending, "top", "older.png");
    const firstTop = uploadReducer(pending, { type: "uploadStarted", request: replacingRequest });
    const latestRequest = createUploadRequest(firstTop, "top", "replacing.png");
    const processing = uploadReducer(firstTop, { type: "uploadStarted", request: latestRequest });
    const changed = uploadReducer(processing, { type: "resolutionChanged", resolution: 32 });

    expect(changed.resolution).toBe(32);
    expect(changed.project).toBe(processing.project);
    expect(changed.slots.front).toBe(processing.slots.front);
    expect(changed.slots.left).toBe(processing.slots.left);
    expect(changed.slots.front).toMatchObject({ phase: "accepted", processedPreset: 16 });

    for (const request of [pendingRequest, latestRequest]) {
      expect(changed.slots[request.slot]).toEqual({
        phase: "rejected",
        fileName: request.fileName,
        diagnostics: [{
          severity: "error",
          code: "decodeFailure",
          message: `Panel grid size changed before ${request.fileName} finished processing. Select it again for 32 x 32.`,
          sourceKind: "upload",
          sourceLabel: request.fileName,
          parserPolicy: "strict-v1",
          repairOwner: "presetChoice",
        }],
      });
      expect(uploadReducer(changed, { type: "uploadFinished", request, result: accepted(request) })).toBe(changed);
      expect(uploadReducer(changed, { type: "uploadFinished", request, result: rejection })).toBe(changed);
    }

    expect(createUploadRequest(changed, "back", "new-preset.png")).toMatchObject({ preset: 32, retryIntent: "replacementSource" });
  });

  it("constructs after the sixth compatible completion and retains output through a preset change", () => {
    const initial = createUploadState();
    const requests = semanticPlaneSlots.map((slot) => createUploadRequest(initial, slot, `${slot}.png`));
    let state = requests.reduce((current, request) => uploadReducer(current, { type: "uploadStarted", request }), initial);

    for (const [index, request] of [...requests].reverse().entries()) {
      state = uploadReducer(state, { type: "uploadFinished", request, result: accepted(request) });
      expect(state.project.activeAssignments).toHaveLength(index + 1);
      if (index < 5) expect(state.project.constructorOutput).toBeNull();
    }

    expect(state.project.readiness.status).toBe("ready");
    expect(state.project.constructorOutput).toMatchObject({ stale: false, activatedPanelSet: { preset: 16 } });
    expect(state.project.constructorOutput?.candidate.panels).toHaveLength(6);
    const changed = uploadReducer(state, { type: "resolutionChanged", resolution: 32 });
    expect(changed.project).toBe(state.project);
    for (const slot of semanticPlaneSlots) expect(changed.slots[slot]).toBe(state.slots[slot]);
  });

  it("invalidates output immediately on replacement and retains saved assets after rejection", () => {
    const ready = semanticPlaneSlots.reduce(acceptSlot, createUploadState());
    const originalAsset = ready.project.savedPanelAssets.find((asset) => asset.id === "upload-panel-front");
    const request = createUploadRequest(ready, "front", "replacement.png");
    const replacing = uploadReducer(ready, { type: "uploadStarted", request });
    const rejected = uploadReducer(replacing, { type: "uploadFinished", request, result: rejection });

    expect(replacing.slots.front.phase).toBe("replacing");
    expect(replacing.project.activeAssignments).toHaveLength(5);
    expect(replacing.project.activeAssignments.some((assignment) => assignment.slot === "front")).toBe(false);
    expect(replacing.project.constructorOutput?.stale).toBe(true);
    expect(replacing.project.constructorOutput?.candidate).toBe(ready.project.constructorOutput?.candidate);
    expect(replacing.project.savedPanelAssets).toBe(ready.project.savedPanelAssets);
    expect(rejected.project).toBe(replacing.project);
    expect(rejected.project.savedPanelAssets.find((asset) => asset.id === "upload-panel-front")).toBe(originalAsset);
    expect(ready.project.constructorOutput?.stale).toBe(false);

    const repaired = acceptSlot(rejected, "front");
    expect(repaired.project.savedPanelAssets).toHaveLength(6);
    expect(repaired.project.activeAssignments).toHaveLength(6);
    expect(repaired.project.constructorOutput?.stale).toBe(false);
  });
});

const rejection: RejectedAssetProcessingResult = {
  status: "rejected",
  diagnostics: [{
    severity: "error",
    code: "decodeFailure",
    message: "The selected source could not be decoded.",
    sourceKind: "upload",
    parserPolicy: "strict-v1",
    repairOwner: "sourceSelection",
  }],
};

function accepted(request: UploadRequest): AcceptedAssetProcessingResult {
  const { preset, fileName, slot } = request;

  return {
    status: "accepted",
    diagnostics: [],
    candidate: {
      preset,
      sourceDimensions: { width: 1024, height: 1024 },
      cellSize: { width: 1024 / preset, height: 1024 / preset },
      parserPolicy: "strict-v1",
      sourceKind: "upload",
      sourceLabel: fileName,
      origin: { uploadSlotHint: slot, sourceName: fileName },
      cells: Array.from({ length: preset * preset }, (_, index) => ({
        x: index % preset,
        y: Math.floor(index / preset),
        classification: "occupied",
        occupied: true,
        color: "#123456",
      })),
      occupiedCellCount: preset * preset,
    },
  };
}

function acceptSlot(state: UploadState, slot: SemanticPlaneSlot): UploadState {
  const request = createUploadRequest(state, slot, `${slot}.png`);
  const pending = uploadReducer(state, { type: "uploadStarted", request });

  return uploadReducer(pending, { type: "uploadFinished", request, result: accepted(request) });
}
