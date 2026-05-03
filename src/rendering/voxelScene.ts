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
  Scene,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { ViewPanel } from "@/core/panels";
import type { GridSize, Voxel, VoxelVolume } from "@/core/voxel";

export type SnapView = "front" | "side" | "top";

export type VoxelSceneInput = Readonly<{
  volume: VoxelVolume;
  panels: readonly ViewPanel[];
  initialView?: SnapView;
  showPanels?: boolean;
  showVoxels?: boolean;
  showOutlines?: boolean;
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
  private readonly controls: OrbitControls;
  private readonly root = new Group();
  private readonly voxelRoot = new Group();
  private readonly outlineRoot = new Group();
  private readonly panelRoot = new Group();
  private readonly resizeObserver: ResizeObserver;
  private sceneSize: GridSize;
  private frameId: number | null = null;
  private disposed = false;

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
    this.controls.addEventListener("start", () => {
      this.restoreFreeOrbitUp();
    });

    this.scene.background = sceneBackground;
    this.scene.add(new AmbientLight("#ffffff", 2.2));
    const keyLight = new DirectionalLight("#ffffff", 2.6);
    keyLight.position.set(24, 36, 42);
    this.scene.add(keyLight);
    this.root.add(this.voxelRoot, this.outlineRoot, this.panelRoot);
    this.scene.add(this.root);
    this.setupGizmo();

    this.setInput(input);
    this.snapTo(input.initialView ?? "front");
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.animate();
  }

  setInput(input: VoxelSceneInput): void {
    this.sceneSize = input.volume.size;
    this.clearGroup(this.voxelRoot);
    this.clearGroup(this.outlineRoot);
    this.clearGroup(this.panelRoot);
    this.voxelRoot.add(createVoxelMeshes(input.volume));
    this.outlineRoot.add(createVoxelOutlines(input.volume));
    this.panelRoot.add(createPanelMeshes(this.sceneSize, input.panels));
    this.setDisplayOptions({
      showOutlines: input.showOutlines ?? false,
      showPanels: input.showPanels ?? true,
      showVoxels: input.showVoxels ?? true,
    });
  }

  setDisplayOptions({
    showOutlines,
    showPanels,
    showVoxels,
  }: {
    showOutlines: boolean;
    showPanels: boolean;
    showVoxels: boolean;
  }): void {
    this.panelRoot.visible = showPanels;
    this.voxelRoot.visible = showVoxels;
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

  snapTo(view: SnapView): void {
    const center = centerOf();
    const distance = Math.max(this.sceneSize.x, this.sceneSize.y, this.sceneSize.z) * 2.7;
    const position = new Vector3();

    if (view === "front") {
      this.camera.up.set(0, 0, 1);
      position.set(center.x, center.y - distance, center.z);
    } else if (view === "side") {
      this.camera.up.set(0, 0, 1);
      position.set(center.x + distance, center.y, center.z);
    } else {
      this.camera.up.set(0, 1, 0);
      position.set(center.x, center.y, center.z + distance);
    }

    this.controls.target.copy(center);
    this.camera.position.copy(position);
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
    this.clearGroup(this.outlineRoot);
    this.clearGroup(this.panelRoot);
    this.clearGroup(this.gizmoRoot);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private animate = (): void => {
    if (this.disposed) {
      return;
    }

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

  private restoreFreeOrbitUp(): void {
    if (this.camera.up.y === 1) {
      return;
    }

    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.render();
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
    this.gizmoRoot.add(createGizmoArrow("x", new Vector3(1, 0, 0), "#ef4444"));
    this.gizmoRoot.add(createGizmoArrow("y", new Vector3(0, 1, 0), "#22c55e"));
    this.gizmoRoot.add(createGizmoArrow("z", new Vector3(0, 0, 1), "#3b82f6"));
    this.gizmoScene.add(this.gizmoRoot);
  }

  private renderGizmo(width: number, height: number): void {
    const gizmoSize = Math.min(96, Math.max(72, Math.floor(Math.min(width, height) * 0.24)));
    const margin = 12;

    this.gizmoRoot.quaternion.copy(this.camera.quaternion).invert();
    this.renderer.clearDepth();
    this.renderer.setScissorTest(true);
    this.renderer.setViewport(margin, margin, gizmoSize, gizmoSize);
    this.renderer.setScissor(margin, margin, gizmoSize, gizmoSize);
    this.renderer.render(this.gizmoScene, this.gizmoCamera);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, width, height);
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
    opacity: 0.68,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  const half = centerOffset(size);
  const margin = 1.35;

  mesh.name = `projected-panel-${panel.id}`;
  mesh.userData.texture = texture;

  if (panel.axis === "x") {
    applyPanelBasis(mesh, new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(1, 0, 0));
    mesh.position.set(half.x + margin, 0, 0);
  } else if (panel.axis === "y") {
    applyPanelBasis(mesh, new Vector3(1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, -1, 0));
    mesh.position.set(0, -(half.y + margin), 0);
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
