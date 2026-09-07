import { BufferGeometry, LineBasicMaterial } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VoxelVolume } from "@/core/voxel";
import { getPanelOrientation, getVoxelOutlineSegmentCount, VoxelScene } from "@/rendering/voxelScene";

const sceneMocks = vi.hoisted(() => ({
  controls: [] as unknown[],
  renderers: [] as unknown[],
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();

  class MockCanvas {
    dataset: Record<string, string> = {};
    style: Record<string, string> = {};
    listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    remove = vi.fn();

    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      const listeners = this.listeners.get(type) ?? new Set();
      listeners.add(listener);
      this.listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
      this.listeners.get(type)?.delete(listener);
    }

    setAttribute(): void {}
    setPointerCapture(): void {}
    releasePointerCapture(): void {}
    hasPointerCapture(): boolean {
      return false;
    }

    getBoundingClientRect(): DOMRect {
      return { bottom: 420, height: 420, left: 0, right: 640, top: 0, width: 640, x: 0, y: 0, toJSON: () => ({}) };
    }
  }

  class MockWebGLRenderer {
    readonly domElement = new MockCanvas();
    readonly parameters: unknown;
    clearDepth = vi.fn();
    dispose = vi.fn();
    render = vi.fn();
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setScissor = vi.fn();
    setScissorTest = vi.fn();
    setSize = vi.fn();
    setViewport = vi.fn();

    constructor(parameters: unknown) {
      this.parameters = parameters;
      sceneMocks.renderers.push(this);
    }
  }

  return { ...actual, WebGLRenderer: MockWebGLRenderer };
});

vi.mock("three/examples/jsm/controls/OrbitControls.js", () => {
  class MockOrbitControls {
    dampingFactor = 0;
    enableDamping = false;
    enabled = true;
    listeners = new Map<string, Set<() => void>>();
    updateResults: boolean[] = [];
    target = {
      x: 0,
      y: 0,
      z: 0,
      copy: (source: { x: number; y: number; z: number }) => {
        this.target.x = source.x;
        this.target.y = source.y;
        this.target.z = source.z;
        return this.target;
      },
    };
    dispose = vi.fn();
    update = vi.fn(() => this.updateResults.shift() ?? false);

    constructor() {
      sceneMocks.controls.push(this);
    }

    addEventListener(type: string, listener: () => void): void {
      const listeners = this.listeners.get(type) ?? new Set();
      listeners.add(listener);
      this.listeners.set(type, listeners);
    }

    removeEventListener(type: string, listener: () => void): void {
      this.listeners.get(type)?.delete(listener);
    }
  }

  return { OrbitControls: MockOrbitControls };
});

type MockRenderer = {
  domElement: {
    dataset: Record<string, string>;
    listeners: Map<string, Set<EventListenerOrEventListenerObject>>;
    remove: ReturnType<typeof vi.fn>;
  };
  parameters: unknown;
  dispose: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
};

type MockControls = {
  dispose: ReturnType<typeof vi.fn>;
  listeners: Map<string, Set<() => void>>;
  updateResults: boolean[];
};

const singleVoxelVolume: VoxelVolume = {
  size: { x: 1, y: 1, z: 1 },
  voxels: [{ color: "#ffffff", x: 0, y: 0, z: 0 }],
};

let runtime: ReturnType<typeof installBrowserRuntime>;

beforeEach(() => {
  sceneMocks.controls.length = 0;
  sceneMocks.renderers.length = 0;
  runtime = installBrowserRuntime();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("getPanelOrientation", () => {
  it("keeps the projected panel basis aligned with panel coordinates", () => {
    expect(getPanelOrientation({ axis: "x", surface: "left" })).toEqual({
      xAxis: [0, 1, 0],
      yAxis: [0, 0, -1],
      zAxis: [-1, 0, 0],
      flipV: true,
    });
    expect(getPanelOrientation({ axis: "x", surface: "right" })).toEqual({
      xAxis: [0, 1, 0],
      yAxis: [0, 0, 1],
      zAxis: [1, 0, 0],
      flipV: false,
    });
    expect(getPanelOrientation({ axis: "y", surface: "front" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, 0, 1],
      zAxis: [0, -1, 0],
      flipV: false,
    });
    expect(getPanelOrientation({ axis: "y", surface: "back" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, 0, -1],
      zAxis: [0, 1, 0],
      flipV: true,
    });
    expect(getPanelOrientation({ axis: "z", surface: "top" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      zAxis: [0, 0, 1],
      flipV: false,
    });
    expect(getPanelOrientation({ axis: "z", surface: "bottom" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, -1, 0],
      zAxis: [0, 0, -1],
      flipV: true,
    });
  });

  it("keeps unsigned axis panels on the existing right/front/top orientations", () => {
    expect(getPanelOrientation({ axis: "x" })).toEqual({
      xAxis: [0, 1, 0],
      yAxis: [0, 0, 1],
      zAxis: [1, 0, 0],
      flipV: false,
    });
    expect(getPanelOrientation({ axis: "y" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, 0, 1],
      zAxis: [0, -1, 0],
      flipV: false,
    });
    expect(getPanelOrientation({ axis: "z" })).toEqual({
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      zAxis: [0, 0, 1],
      flipV: false,
    });
  });
});

describe("voxel outline resources", () => {
  it("deduplicates only the four edges shared by adjacent cubes", () => {
    expect(getVoxelOutlineSegmentCount(singleVoxelVolume)).toBe(12);
    expect(
      getVoxelOutlineSegmentCount({
        size: { x: 2, y: 1, z: 1 },
        voxels: [
          { color: "#ffffff", x: 0, y: 0, z: 0 },
          { color: "#ffffff", x: 1, y: 0, z: 0 },
        ],
      }),
    ).toBe(20);
  });

  it("allocates outlines only while enabled and disposes them when hidden", () => {
    const geometryDispose = vi.spyOn(BufferGeometry.prototype, "dispose");
    const materialDispose = vi.spyOn(LineBasicMaterial.prototype, "dispose");
    const scene = new VoxelScene(runtime.host, { panels: [], volume: singleVoxelVolume });
    const renderer = sceneMocks.renderers[0] as MockRenderer;

    expect(renderer.domElement.dataset.outlineSegmentCount).toBe("0");
    scene.setDisplayOptions({ showOutlines: true, showPanels: false, showVoxels: true });
    expect(renderer.domElement.dataset.outlineSegmentCount).toBe("12");

    const geometryDisposalsBeforeHide = geometryDispose.mock.calls.length;
    const materialDisposalsBeforeHide = materialDispose.mock.calls.length;
    scene.setDisplayOptions({ showOutlines: false, showPanels: false, showVoxels: true });

    expect(renderer.domElement.dataset.outlineSegmentCount).toBe("0");
    expect(geometryDispose.mock.calls.length).toBe(geometryDisposalsBeforeHide + 1);
    expect(materialDispose.mock.calls.length).toBe(materialDisposalsBeforeHide + 1);
    scene.dispose();
  });
});

describe("VoxelScene lifecycle", () => {
  it("rolls back every acquired resource when late construction fails", () => {
    runtime.throwOnObserve = true;

    expect(() => new VoxelScene(runtime.host, { panels: [], volume: singleVoxelVolume })).toThrow("observe failed");

    const renderer = sceneMocks.renderers[0] as MockRenderer;
    const controls = sceneMocks.controls[0] as MockControls;
    expect(runtime.host.append).toHaveBeenCalledTimes(1);
    expect(runtime.observers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.domElement.remove).toHaveBeenCalledTimes(1);
    expect(controls.dispose).toHaveBeenCalledTimes(1);
    expect(totalListenerCount(runtime.window.listeners)).toBe(0);
    expect(totalListenerCount(renderer.domElement.listeners)).toBe(0);
    expect(runtime.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("settles when idle, continues only for damping, and disposes idempotently", () => {
    const scene = new VoxelScene(runtime.host, { panels: [], volume: singleVoxelVolume });
    const renderer = sceneMocks.renderers[0] as MockRenderer;
    const controls = sceneMocks.controls[0] as MockControls;

    expect(renderer.parameters).toEqual({ alpha: false, antialias: true });
    expect(runtime.frames.size).toBe(1);
    runtime.flushFrame();
    expect(renderer.domElement.dataset.renderCount).toBe("1");
    expect(runtime.frames.size).toBe(0);

    runtime.observers[0]?.callback([], runtime.observers[0] as unknown as ResizeObserver);
    expect(runtime.frames.size).toBe(1);
    runtime.flushFrame();
    expect(renderer.domElement.dataset.renderCount).toBe("2");
    expect(runtime.frames.size).toBe(0);

    controls.updateResults.push(true, true, false);
    scene.setDisplayOptions({ showOutlines: false, showPanels: false, showVoxels: true });
    runtime.flushFrame();
    expect(runtime.frames.size).toBe(1);
    runtime.flushFrame();
    expect(runtime.frames.size).toBe(1);
    runtime.flushFrame();
    expect(runtime.frames.size).toBe(0);

    scene.dispose();
    scene.dispose();
    expect(runtime.observers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.domElement.remove).toHaveBeenCalledTimes(1);
    expect(controls.dispose).toHaveBeenCalledTimes(1);
    expect(totalListenerCount(runtime.window.listeners)).toBe(0);
    expect(totalListenerCount(renderer.domElement.listeners)).toBe(0);
  });

  it("continues releasing later resources when one cleanup throws", () => {
    const scene = new VoxelScene(runtime.host, { panels: [], volume: singleVoxelVolume });
    const renderer = sceneMocks.renderers[0] as MockRenderer;
    const controls = sceneMocks.controls[0] as MockControls;
    controls.dispose.mockImplementation(() => {
      throw new Error("controls cleanup failed");
    });

    expect(() => scene.dispose()).not.toThrow();
    expect(controls.dispose).toHaveBeenCalledTimes(1);
    expect(runtime.observers[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.domElement.remove).toHaveBeenCalledTimes(1);
    expect(totalListenerCount(runtime.window.listeners)).toBe(0);
    expect(totalListenerCount(renderer.domElement.listeners)).toBe(0);
  });
});

function installBrowserRuntime() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;
  const windowListeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const fakeWindow = {
    devicePixelRatio: 2,
    listeners: windowListeners,
    matchMedia: () => ({ matches: true }),
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const listeners = windowListeners.get(type) ?? new Set();
      listeners.add(listener);
      windowListeners.set(type, listeners);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      windowListeners.get(type)?.delete(listener);
    },
  };
  const observers: Array<{
    callback: ResizeObserverCallback;
    disconnect: ReturnType<typeof vi.fn>;
    observe: ReturnType<typeof vi.fn>;
  }> = [];
  const state = { throwOnObserve: false };
  class MockResizeObserver {
    callback: ResizeObserverCallback;
    disconnect = vi.fn();
    observe = vi.fn(() => {
      if (state.throwOnObserve) {
        throw new Error("observe failed");
      }
    });

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      observers.push(this);
    }
  }
  const host = {
    append: vi.fn(),
    clientHeight: 420,
    clientWidth: 640,
  } as unknown as HTMLElement & { append: ReturnType<typeof vi.fn> };
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrameId;
    nextFrameId += 1;
    frames.set(id, callback);
    return id;
  });
  const cancelAnimationFrame = vi.fn((id: number) => frames.delete(id));

  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", {
    createElement: () => ({
      getContext: () => ({
        arc: vi.fn(),
        beginPath: vi.fn(),
        clearRect: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        roundRect: vi.fn(),
        stroke: vi.fn(),
        strokeRect: vi.fn(),
      }),
      height: 0,
      width: 0,
    }),
  });
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

  return {
    cancelAnimationFrame,
    flushFrame() {
      const next = frames.entries().next().value as [number, FrameRequestCallback] | undefined;
      if (!next) {
        throw new Error("Expected a pending animation frame");
      }
      frames.delete(next[0]);
      next[1](performance.now());
    },
    frames,
    host,
    observers,
    requestAnimationFrame,
    set throwOnObserve(value: boolean) {
      state.throwOnObserve = value;
    },
    window: fakeWindow,
  };
}

function totalListenerCount(listeners: Map<string, Set<unknown>>): number {
  return [...listeners.values()].reduce((total, entries) => total + entries.size, 0);
}
