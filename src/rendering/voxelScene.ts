import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  GridHelper,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { ViewPanel } from "@/core/panels";
import type { GridSize, VoxelVolume } from "@/core/voxel";

export type SnapView = "front" | "side" | "top";

export type VoxelSceneInput = Readonly<{
  volume: VoxelVolume;
  panels: readonly ViewPanel[];
}>;

const sceneBackground = new Color("#f7f4ec");
const cubeMatrix = new Matrix4();
const cubeGeometry = new BoxGeometry(0.86, 0.86, 0.86);
const panelMaterialOpacity = 0.32;

export class VoxelScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly root = new Group();
  private readonly resizeObserver: ResizeObserver;
  private sceneSize: GridSize;
  private frameId: number | null = null;

  constructor(
    private readonly host: HTMLElement,
    input: VoxelSceneInput,
  ) {
    this.sceneSize = input.volume.size;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(sceneBackground, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.dataset.testid = "voxel-viewer-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Swirl sphere 3D viewer");
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.inset = "0";
    this.renderer.domElement.style.zIndex = "0";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.opacity = "0";
    this.renderer.domElement.style.display = "none";
    this.host.append(this.renderer.domElement);

    this.camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.copy(centerOf());

    this.scene.background = null;
    this.scene.add(new AmbientLight("#ffffff", 2.8));
    const keyLight = new DirectionalLight("#ffffff", 2.8);
    keyLight.position.set(24, 36, 42);
    this.scene.add(keyLight);
    this.scene.add(this.root);

    this.setInput(input);
    this.snapTo("front");
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.animate();
  }

  setInput(input: VoxelSceneInput): void {
    this.sceneSize = input.volume.size;
    this.clearRoot();
    this.root.add(createVoxelMesh(input.volume));
    this.root.add(createSlicePanels(input.volume.size, input.panels));
  }

  snapTo(view: SnapView): void {
    const center = centerOf();
    const distance = Math.max(this.sceneSize.x, this.sceneSize.y, this.sceneSize.z) * 2.7;
    const position = new Vector3();

    if (view === "front") {
      position.set(center.x, center.y - distance, center.z + distance * 0.18);
    } else if (view === "side") {
      position.set(center.x + distance, center.y, center.z + distance * 0.18);
    } else {
      position.set(center.x, center.y, center.z + distance);
    }

    this.controls.target.copy(center);
    this.camera.position.copy(position);
    this.camera.lookAt(center);
    this.controls.update();
    this.render();
  }

  dispose(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }

    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearRoot();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private animate = (): void => {
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
    this.renderer.render(this.scene, this.camera);
  }

  private clearRoot(): void {
    for (const child of this.root.children) {
      disposeObject(child);
    }

    this.root.clear();
  }
}

function createVoxelMesh(volume: VoxelVolume): InstancedMesh {
  const material = new MeshLambertMaterial({ vertexColors: true });
  const mesh = new InstancedMesh(cubeGeometry, material, volume.voxels.length);
  const offset = centerOffset(volume.size);

  volume.voxels.forEach((voxel, index) => {
    cubeMatrix.makeTranslation(voxel.x - offset.x, voxel.y - offset.y, voxel.z - offset.z);
    mesh.setMatrixAt(index, cubeMatrix);
    mesh.setColorAt(index, new Color(voxel.color));
  });

  mesh.instanceMatrix.needsUpdate = true;

  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  return mesh;
}

function createSlicePanels(size: GridSize, panels: readonly ViewPanel[]): Group {
  const group = new Group();
  const offset = centerOffset(size);
  const grid = new GridHelper(size.x, size.x, "#23424a", "#b8b09f");
  grid.position.set(0, 0, -offset.z - 1);
  grid.rotation.x = Math.PI / 2;
  group.add(grid);

  for (const panel of panels) {
    const texture = createPanelTexture(panel);
    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: panelMaterialOpacity,
      side: DoubleSide,
      depthWrite: false,
    });
    const mesh = new Mesh(new PlaneGeometry(panel.width, panel.height), material);

    if (panel.axis === "x") {
      mesh.position.set(-offset.x - 1.1, 0, 0);
      mesh.rotation.y = Math.PI / 2;
    } else if (panel.axis === "y") {
      mesh.position.set(0, -offset.y - 1.1, 0);
      mesh.rotation.x = Math.PI / 2;
    } else {
      mesh.position.set(0, 0, offset.z + 1.1);
    }

    group.add(mesh);
  }

  return group;
}

function createPanelTexture(panel: ViewPanel): CanvasTexture {
  const canvas = document.createElement("canvas");
  const scale = 8;
  canvas.width = panel.width * scale;
  canvas.height = panel.height * scale;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create 2D context for panel texture");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  panel.pixels.forEach((pixel, index) => {
    if (!pixel.occupied) {
      return;
    }

    const x = index % panel.width;
    const y = Math.floor(index / panel.width);
    context.fillStyle = pixel.color ?? "#ffffff";
    context.fillRect(x * scale, y * scale, scale, scale);
  });

  context.strokeStyle = "rgba(35, 66, 74, 0.18)";
  context.lineWidth = 1;

  for (let x = 0; x <= panel.width; x += 1) {
    context.beginPath();
    context.moveTo(x * scale, 0);
    context.lineTo(x * scale, canvas.height);
    context.stroke();
  }

  for (let y = 0; y <= panel.height; y += 1) {
    context.beginPath();
    context.moveTo(0, y * scale);
    context.lineTo(canvas.width, y * scale);
    context.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;

  return texture;
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
    if (child instanceof Mesh || child instanceof InstancedMesh) {
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

        child.material.dispose();
      }
    }
  });
}
