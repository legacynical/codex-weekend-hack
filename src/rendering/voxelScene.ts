import {
  AmbientLight,
  ArrowHelper,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  Vector2,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { SurfaceId, ViewPanel } from "@/core/panels";
import type { GridSize, Voxel, VoxelVolume } from "@/core/voxel";

export type SurfaceView = SurfaceId;

export type VoxelSceneInput = Readonly<{
  volume: VoxelVolume;
  panels: readonly ViewPanel[];
  initialView?: SurfaceView;
  projectedVolume?: VoxelVolume;
  showPanels?: boolean;
  showVoxels?: boolean;
  showOutlines?: boolean;
  showProjected?: boolean;
  visiblePanels?: Partial<Record<SurfaceId, boolean>>;
  onSurfaceChange?: (surface: SurfaceView) => void;
}>;

const sceneBackground = new Color("#172022");
const cubeMatrix = new Matrix4();
const cubeGeometry = new BoxGeometry(1, 1, 1);

export class VoxelScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly gizmoScene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly gizmoCamera = new OrthographicCamera(-1.8, 1.8, 1.8, -1.8, 0.1, 10);
  private readonly gizmoRoot = new Group();
  private readonly raycaster = new Raycaster();
  private readonly controls: OrbitControls;
  private readonly root = new Group();
  private readonly voxelRoot = new Group();
  private readonly projectedRoot = new Group();
  private readonly outlineRoot = new Group();
  private readonly panelRoot = new Group();
  private readonly resizeObserver: ResizeObserver;
  private sceneSize: GridSize;
  private activeGizmoDrag:
    | {
        axis: Vector3;
        pointerId: number;
        previousX: number;
        previousY: number;
      }
    | null = null;
  private animation:
    | {
        startedAt: number;
        duration: number;
        fromPosition: Vector3;
        toPosition: Vector3;
        fromUp: Vector3;
        toUp: Vector3;
        target: Vector3;
      }
    | null = null;
  private frameId: number | null = null;
  private disposed = false;
  private onSurfaceChange?: (surface: SurfaceView) => void;

  constructor(
    private readonly host: HTMLElement,
    input: VoxelSceneInput,
  ) {
    this.sceneSize = input.volume.size;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setClearColor(sceneBackground, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.dataset.testid = "voxel-viewer-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Swirl sphere 3D viewer");
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.addEventListener("pointerdown", this.handleGizmoPointerDown, true);
    this.renderer.domElement.addEventListener("pointermove", this.handleGizmoPointerMove, true);
    this.renderer.domElement.addEventListener("pointerup", this.handleGizmoPointerUp, true);
    this.renderer.domElement.addEventListener("pointercancel", this.handleGizmoPointerUp, true);
    this.host.append(this.renderer.domElement);

    this.camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.copy(centerOf());
    this.controls.addEventListener("change", () => {
      const currentCount = Number(this.renderer.domElement.dataset.orbitEvents ?? "0");
      this.renderer.domElement.dataset.orbitEvents = String(currentCount + 1);
    });

    this.scene.background = sceneBackground;
    this.scene.add(new AmbientLight("#ffffff", 2.2));
    const keyLight = new DirectionalLight("#ffffff", 2.6);
    keyLight.position.set(24, 36, 42);
    this.scene.add(keyLight);
    this.root.add(this.voxelRoot, this.projectedRoot, this.outlineRoot, this.panelRoot);
    this.scene.add(this.root);
    this.setupGizmo();

    this.setInput(input);
    this.setView(input.initialView ?? "front", { animate: false });
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.animate();
  }

  setInput(input: VoxelSceneInput): void {
    this.sceneSize = input.volume.size;
    this.onSurfaceChange = input.onSurfaceChange;
    this.clearGroup(this.voxelRoot);
    this.clearGroup(this.projectedRoot);
    this.clearGroup(this.outlineRoot);
    this.clearGroup(this.panelRoot);
    this.voxelRoot.add(createVoxelMeshes(input.volume));
    if (input.projectedVolume) {
      this.projectedRoot.add(createVoxelMeshes(input.projectedVolume));
    }
    this.outlineRoot.add(createVoxelOutlines(input.volume));
    this.panelRoot.add(createPanelMeshes(this.sceneSize, input.panels));
    this.setDisplayOptions({
      showOutlines: input.showOutlines ?? false,
      showPanels: input.showPanels ?? true,
      showVoxels: input.showVoxels ?? true,
      showProjected: input.showProjected ?? false,
      visiblePanels: input.visiblePanels,
    });
  }

  setProjectedVolume(volume: VoxelVolume): void {
    this.clearGroup(this.projectedRoot);
    this.projectedRoot.add(createVoxelMeshes(volume));
    this.render();
  }

  setDisplayOptions({
    showOutlines,
    showPanels,
    showProjected,
    showVoxels,
    visiblePanels,
  }: {
    showOutlines: boolean;
    showPanels: boolean;
    showProjected?: boolean;
    showVoxels: boolean;
    visiblePanels?: Partial<Record<SurfaceId, boolean>>;
  }): void {
    this.setPanelVisibility(showPanels, visiblePanels);
    this.projectedRoot.visible = showVoxels && (showProjected ?? false);
    this.voxelRoot.visible = showVoxels && !(showProjected ?? false);
    this.outlineRoot.visible = showVoxels && showOutlines;
    this.render();
  }

  setVisibility({
    showPanels,
    showVoxels,
  }: {
    showPanels: boolean;
    showVoxels: boolean;
  }): void {
    this.setDisplayOptions({ showOutlines: false, showPanels, showVoxels });
  }

  setView(view: SurfaceView, { animate = true }: { animate?: boolean } = {}): void {
    const center = centerOf();
    const next = cameraPoseForSurface(view, this.sceneSize);
    if (animate) {
      this.animation = {
        startedAt: performance.now(),
        duration: 280,
        fromPosition: this.camera.position.clone(),
        toPosition: next.position,
        fromUp: this.camera.up.clone(),
        toUp: next.up,
        target: center,
      };
      return;
    }

    this.controls.target.copy(center);
    this.camera.position.copy(next.position);
    this.camera.up.copy(next.up);
    this.camera.lookAt(center);
    this.controls.update();
    this.render();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearGroup(this.voxelRoot);
    this.clearGroup(this.projectedRoot);
    this.clearGroup(this.outlineRoot);
    this.clearGroup(this.panelRoot);
    this.clearGroup(this.gizmoRoot);
    this.renderer.domElement.removeEventListener("pointerdown", this.handleGizmoPointerDown, true);
    this.renderer.domElement.removeEventListener("pointermove", this.handleGizmoPointerMove, true);
    this.renderer.domElement.removeEventListener("pointerup", this.handleGizmoPointerUp, true);
    this.renderer.domElement.removeEventListener("pointercancel", this.handleGizmoPointerUp, true);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private animate = (): void => {
    if (this.disposed) {
      return;
    }

    this.updateCameraAnimation();
    this.controls.update();
    this.render();
    this.frameId = requestAnimationFrame(this.animate);
  };

  private resize(): void {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private render(): void {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);

    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.render(this.scene, this.camera);
    this.renderGizmo(width, height);
  }

  private clearGroup(group: Group): void {
    for (const child of group.children) {
      disposeObject(child);
    }

    group.clear();
  }

  private setupGizmo(): void {
    this.gizmoCamera.position.set(0, 0, 5);
    this.gizmoCamera.lookAt(0, 0, 0);
    this.gizmoRoot.add(createGizmoArc("x", "#ef4444"));
    this.gizmoRoot.add(createGizmoArc("y", "#22c55e"));
    this.gizmoRoot.add(createGizmoArc("z", "#3b82f6"));
    this.gizmoRoot.add(createGizmoBall("right", new Vector3(1.28, 0, 0), "#ef4444"));
    this.gizmoRoot.add(createGizmoBall("left", new Vector3(-1.28, 0, 0), "#ef4444"));
    this.gizmoRoot.add(createGizmoBall("back", new Vector3(0, 1.28, 0), "#22c55e"));
    this.gizmoRoot.add(createGizmoBall("front", new Vector3(0, -1.28, 0), "#22c55e"));
    this.gizmoRoot.add(createGizmoBall("top", new Vector3(0, 0, 1.28), "#3b82f6"));
    this.gizmoRoot.add(createGizmoBall("bottom", new Vector3(0, 0, -1.28), "#3b82f6"));
    this.gizmoRoot.add(createGizmoArrow("x", new Vector3(1, 0, 0), "#ef4444"));
    this.gizmoRoot.add(createGizmoArrow("y", new Vector3(0, 1, 0), "#22c55e"));
    this.gizmoRoot.add(createGizmoArrow("z", new Vector3(0, 0, 1), "#3b82f6"));
    this.gizmoScene.add(this.gizmoRoot);
  }

  private renderGizmo(width: number, height: number): void {
    const { size: gizmoSize, x, y } = gizmoViewport(width, height);

    this.gizmoRoot.quaternion.copy(this.camera.quaternion).invert();
    this.renderer.clearDepth();
    this.renderer.setScissorTest(true);
    this.renderer.setViewport(x, y, gizmoSize, gizmoSize);
    this.renderer.setScissor(x, y, gizmoSize, gizmoSize);
    this.renderer.render(this.gizmoScene, this.gizmoCamera);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);
  }

  private handleGizmoPointerDown = (event: PointerEvent): void => {
    if (!this.isInGizmoViewport(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.animation = null;
    const ballSurface = this.gizmoSurfaceFromPointer(event);

    if (ballSurface) {
      this.setView(ballSurface);
      this.onSurfaceChange?.(ballSurface);
      this.renderer.domElement.dataset.activeSurface = ballSurface;
      return;
    }

    this.controls.enabled = false;
    this.activeGizmoDrag = {
      axis: gizmoAxisFromPointer(event, this.renderer.domElement),
      pointerId: event.pointerId,
      previousX: event.clientX,
      previousY: event.clientY,
    };
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private handleGizmoPointerMove = (event: PointerEvent): void => {
    if (!this.activeGizmoDrag || event.pointerId !== this.activeGizmoDrag.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const delta = event.clientX - this.activeGizmoDrag.previousX + event.clientY - this.activeGizmoDrag.previousY;
    this.activeGizmoDrag.previousX = event.clientX;
    this.activeGizmoDrag.previousY = event.clientY;
    this.rotateCameraAround(this.activeGizmoDrag.axis, delta * 0.012);
    const currentCount = Number(this.renderer.domElement.dataset.gizmoDrags ?? "0");
    this.renderer.domElement.dataset.gizmoDrags = String(currentCount + 1);
  };

  private handleGizmoPointerUp = (event: PointerEvent): void => {
    if (!this.activeGizmoDrag || event.pointerId !== this.activeGizmoDrag.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.renderer.domElement.releasePointerCapture(event.pointerId);
    this.activeGizmoDrag = null;
    this.controls.enabled = true;
  };

  private rotateCameraAround(axis: Vector3, angle: number): void {
    const target = this.controls.target;
    const offset = this.camera.position.clone().sub(target).applyAxisAngle(axis, angle);
    this.camera.position.copy(target).add(offset);
    this.camera.up.applyAxisAngle(axis, angle).normalize();
    this.camera.lookAt(target);
    this.controls.update();
    this.render();
  }

  private isInGizmoViewport(event: PointerEvent): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const { size, x, y } = gizmoViewport(rect.width, rect.height);
    const localX = event.clientX - rect.left;
    const localY = rect.bottom - event.clientY;

    return localX >= x && localX <= x + size && localY >= y && localY <= y + size;
  }

  private gizmoSurfaceFromPointer(event: PointerEvent): SurfaceView | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const { size, x, y } = gizmoViewport(rect.width, rect.height);
    const localX = event.clientX - rect.left - x;
    const localY = rect.bottom - event.clientY - y;
    const pointer = new Vector2((localX / size) * 2 - 1, (localY / size) * 2 - 1);

    this.raycaster.setFromCamera(pointer, this.gizmoCamera);
    const intersections = this.raycaster.intersectObjects(this.gizmoRoot.children, true);
    const ball = intersections.find((intersection) => intersection.object.userData.surface)?.object;

    return (ball?.userData.surface as SurfaceView | undefined) ?? fallbackGizmoSurface(localX / size, localY / size);
  }

  private setPanelVisibility(showPanels: boolean, visiblePanels?: Partial<Record<SurfaceId, boolean>>): void {
    this.panelRoot.visible = showPanels;

    this.panelRoot.traverse((object) => {
      const surface = object.userData.surface as SurfaceId | undefined;

      if (surface) {
        object.visible = visiblePanels?.[surface] ?? true;
      }
    });
  }

  private updateCameraAnimation(): void {
    if (!this.animation) {
      return;
    }

    const elapsed = performance.now() - this.animation.startedAt;
    const progress = Math.min(elapsed / this.animation.duration, 1);
    const eased = 1 - (1 - progress) ** 3;

    this.camera.position.lerpVectors(this.animation.fromPosition, this.animation.toPosition, eased);
    this.camera.up.lerpVectors(this.animation.fromUp, this.animation.toUp, eased).normalize();
    this.camera.lookAt(this.animation.target);
    this.controls.target.copy(this.animation.target);

    if (progress >= 1) {
      this.animation = null;
      this.camera.position.copy(this.camera.position);
    }
  }
}

function createVoxelMeshes(volume: VoxelVolume): Group {
  const group = new Group();
  const voxelsByColor = new Map<string, Voxel[]>();

  for (const voxel of volume.voxels) {
    const voxels = voxelsByColor.get(voxel.color) ?? [];
    voxels.push(voxel);
    voxelsByColor.set(voxel.color, voxels);
  }

  for (const [color, voxels] of voxelsByColor) {
    group.add(createVoxelMesh(volume.size, voxels, color));
  }

  return group;
}

function createVoxelMesh(size: GridSize, voxels: readonly Voxel[], color: string): InstancedMesh {
  const material = new MeshBasicMaterial({ color });
  const mesh = new InstancedMesh(cubeGeometry, material, voxels.length);
  const offset = centerOffset(size);

  voxels.forEach((voxel, index) => {
    cubeMatrix.makeTranslation(voxel.x - offset.x, voxel.y - offset.y, voxel.z - offset.z);
    mesh.setMatrixAt(index, cubeMatrix);
  });

  mesh.instanceMatrix.needsUpdate = true;

  return mesh;
}

function createVoxelOutlines(volume: VoxelVolume): LineSegments {
  const positions: number[] = [];
  const offset = centerOffset(volume.size);

  for (const voxel of volume.voxels) {
    appendCubeEdges(positions, voxel.x - offset.x, voxel.y - offset.y, voxel.z - offset.z);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({
    color: "#101719",
    transparent: true,
    opacity: 0.55,
  });

  return new LineSegments(geometry, material);
}

function appendCubeEdges(positions: number[], centerX: number, centerY: number, centerZ: number): void {
  const minX = centerX - 0.5;
  const maxX = centerX + 0.5;
  const minY = centerY - 0.5;
  const maxY = centerY + 0.5;
  const minZ = centerZ - 0.5;
  const maxZ = centerZ + 0.5;
  const edges = [
    [minX, minY, minZ, maxX, minY, minZ],
    [maxX, minY, minZ, maxX, maxY, minZ],
    [maxX, maxY, minZ, minX, maxY, minZ],
    [minX, maxY, minZ, minX, minY, minZ],
    [minX, minY, maxZ, maxX, minY, maxZ],
    [maxX, minY, maxZ, maxX, maxY, maxZ],
    [maxX, maxY, maxZ, minX, maxY, maxZ],
    [minX, maxY, maxZ, minX, minY, maxZ],
    [minX, minY, minZ, minX, minY, maxZ],
    [maxX, minY, minZ, maxX, minY, maxZ],
    [maxX, maxY, minZ, maxX, maxY, maxZ],
    [minX, maxY, minZ, minX, maxY, maxZ],
  ];

  edges.forEach((edge) => positions.push(...edge));
}

function createPanelMeshes(size: GridSize, panels: readonly ViewPanel[]): Group {
  const group = new Group();

  panels.forEach((panel) => {
    group.add(createPanelMesh(size, panel));
  });

  return group;
}

function createPanelMesh(size: GridSize, panel: ViewPanel): Mesh {
  const texture = createPanelTexture(panel);
  const geometry = new PlaneGeometry(panel.width, panel.height);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  const half = centerOffset(size);
  const margin = 0.62;

  mesh.name = `projected-panel-${panel.id}`;
  mesh.userData.surface = panel.surface;
  mesh.userData.texture = texture;

  if (panel.surface === "left") {
    applyPanelBasis(mesh, new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(-1, 0, 0));
    mesh.position.set(-(half.x + margin), 0, 0);
  } else if (panel.surface === "right" || (!panel.surface && panel.axis === "x")) {
    applyPanelBasis(mesh, new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(1, 0, 0));
    mesh.position.set(half.x + margin, 0, 0);
  } else if (panel.surface === "front" || (!panel.surface && panel.axis === "y")) {
    applyPanelBasis(mesh, new Vector3(1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, -1, 0));
    mesh.position.set(0, -(half.y + margin), 0);
  } else if (panel.surface === "back") {
    applyPanelBasis(mesh, new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 1, 0));
    mesh.position.set(0, half.y + margin, 0);
  } else if (panel.surface === "bottom") {
    applyPanelBasis(mesh, new Vector3(1, 0, 0), new Vector3(0, -1, 0), new Vector3(0, 0, -1));
    mesh.position.set(0, 0, -(half.z + margin));
  } else {
    applyPanelBasis(mesh, new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1));
    mesh.position.set(0, 0, half.z + margin);
  }

  return mesh;
}

function applyPanelBasis(mesh: Mesh, xAxis: Vector3, yAxis: Vector3, zAxis: Vector3): void {
  const matrix = new Matrix4().makeBasis(xAxis, yAxis, zAxis);
  mesh.quaternion.setFromRotationMatrix(matrix);
}

function createPanelTexture(panel: ViewPanel): CanvasTexture {
  const canvas = document.createElement("canvas");
  const scale = 8;
  canvas.width = panel.width * scale;
  canvas.height = panel.height * scale;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(`Could not create texture canvas for ${panel.id}`);
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);

  panel.pixels.forEach((pixel, index) => {
    const x = index % panel.width;
    const y = Math.floor(index / panel.width);
    context.fillStyle = pixel.occupied ? (pixel.color ?? "#ffffff") : "rgba(255,255,255,0.08)";
    context.fillRect(x * scale, (panel.height - y - 1) * scale, scale, scale);
  });

  context.strokeStyle = "rgba(255,255,255,0.55)";
  context.lineWidth = Math.max(1, scale / 4);
  context.strokeRect(0, 0, canvas.width, canvas.height);

  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.needsUpdate = true;

  return texture;
}

function createGizmoArrow(label: "x" | "y" | "z", direction: Vector3, color: string): Group {
  const group = new Group();
  group.add(new ArrowHelper(direction, new Vector3(0, 0, 0), 1.12, color, 0.22, 0.14));

  const labelSprite = createGizmoLabel(label, color);
  labelSprite.position.copy(direction.clone().multiplyScalar(1.42));
  group.add(labelSprite);

  return group;
}

function createGizmoBall(surface: SurfaceView, position: Vector3, color: string): Mesh {
  const material = new MeshBasicMaterial({ color });
  const ball = new Mesh(new SphereGeometry(0.14, 18, 14), material);

  ball.position.copy(position);
  ball.userData.surface = surface;

  return ball;
}

function createGizmoArc(axis: "x" | "y" | "z", color: string): LineSegments {
  const positions: number[] = [];
  const radius = 1.02;
  const segments = 52;

  for (let index = 0; index < segments; index += 1) {
    const current = (Math.PI * 2 * index) / segments;
    const next = (Math.PI * 2 * (index + 1)) / segments;
    const start = pointOnGizmoArc(axis, radius, current);
    const end = pointOnGizmoArc(axis, radius, next);
    positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.78,
  });

  return new LineSegments(geometry, material);
}

function pointOnGizmoArc(axis: "x" | "y" | "z", radius: number, angle: number): Vector3 {
  const cos = Math.cos(angle) * radius;
  const sin = Math.sin(angle) * radius;

  if (axis === "x") {
    return new Vector3(0, cos, sin);
  }

  if (axis === "y") {
    return new Vector3(cos, 0, sin);
  }

  return new Vector3(cos, sin, 0);
}

function createGizmoLabel(label: string, color: string): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(`Could not create gizmo label ${label}`);
  }

  context.fillStyle = color;
  context.font = "700 42px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 32, 32);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new SpriteMaterial({ map: texture, transparent: true });
  const sprite = new Sprite(material);
  sprite.scale.set(0.42, 0.42, 0.42);
  sprite.userData.texture = texture;

  return sprite;
}

function centerOf(): Vector3 {
  return new Vector3(0, 0, 0);
}

function centerOffset(size: GridSize): GridSize {
  return {
    x: (size.x - 1) / 2,
    y: (size.y - 1) / 2,
    z: (size.z - 1) / 2,
  };
}

function cameraPoseForSurface(surface: SurfaceView, size: GridSize): { position: Vector3; up: Vector3 } {
  const center = centerOf();
  const distance = Math.max(size.x, size.y, size.z) * 2.7;

  switch (surface) {
    case "front":
      return { position: new Vector3(center.x, center.y - distance, center.z), up: new Vector3(0, 0, 1) };
    case "back":
      return { position: new Vector3(center.x, center.y + distance, center.z), up: new Vector3(0, 0, 1) };
    case "left":
      return { position: new Vector3(center.x - distance, center.y, center.z), up: new Vector3(0, 0, 1) };
    case "right":
      return { position: new Vector3(center.x + distance, center.y, center.z), up: new Vector3(0, 0, 1) };
    case "bottom":
      return { position: new Vector3(center.x, center.y, center.z - distance), up: new Vector3(0, -1, 0) };
    case "top":
      return { position: new Vector3(center.x, center.y, center.z + distance), up: new Vector3(0, 1, 0) };
  }
}

function gizmoViewport(width: number, height: number): { size: number; x: number; y: number } {
  const size = Math.min(96, Math.max(72, Math.floor(Math.min(width, height) * 0.24)));
  const margin = 12;

  return {
    size,
    x: width - size - margin,
    y: height - size - margin,
  };
}

function gizmoAxisFromPointer(event: PointerEvent, canvas: HTMLCanvasElement): Vector3 {
  const rect = canvas.getBoundingClientRect();
  const { size, x, y } = gizmoViewport(rect.width, rect.height);
  const localX = event.clientX - rect.left - x;
  const localY = rect.bottom - event.clientY - y;
  const normalizedX = localX / size;
  const normalizedY = localY / size;

  if (normalizedY > 0.66) {
    return new Vector3(1, 0, 0);
  }

  if (normalizedX < 0.38) {
    return new Vector3(0, 1, 0);
  }

  return new Vector3(0, 0, 1);
}

function fallbackGizmoSurface(normalizedX: number, normalizedY: number): SurfaceView | null {
  if (normalizedX > 0.78 && normalizedY > 0.36 && normalizedY < 0.64) {
    return "right";
  }

  if (normalizedX < 0.22 && normalizedY > 0.36 && normalizedY < 0.64) {
    return "left";
  }

  if (normalizedY > 0.78 && normalizedX > 0.36 && normalizedX < 0.64) {
    return "top";
  }

  if (normalizedY < 0.22 && normalizedX > 0.36 && normalizedX < 0.64) {
    return "bottom";
  }

  return null;
}

function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    if (child instanceof Mesh || child instanceof InstancedMesh || child instanceof LineSegments || child instanceof Sprite) {
      if (child.geometry !== cubeGeometry) {
        child.geometry.dispose();
      }

      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        const maybeMap = "map" in child.material ? child.material.map : null;

        if (maybeMap) {
          maybeMap.dispose();
        }

        if (child.userData.texture) {
          child.userData.texture.dispose();
        }

        child.material.dispose();
      }
    }
  });
}
