import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { GridSize, Voxel, VoxelVolume } from "@/core/voxel";

export type SnapView = "front" | "side" | "top";

export type VoxelSceneInput = Readonly<{
  volume: VoxelVolume;
  initialView?: SnapView;
}>;

const sceneBackground = new Color("#172022");
const cubeMatrix = new Matrix4();
const cubeGeometry = new BoxGeometry(0.86, 0.86, 0.86);

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

    this.scene.background = sceneBackground;
    this.scene.add(new AmbientLight("#ffffff", 2.2));
    const keyLight = new DirectionalLight("#ffffff", 2.6);
    keyLight.position.set(24, 36, 42);
    this.scene.add(keyLight);
    this.scene.add(this.root);

    this.setInput(input);
    this.snapTo(input.initialView ?? "front");
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.animate();
  }

  setInput(input: VoxelSceneInput): void {
    this.sceneSize = input.volume.size;
    this.clearRoot();
    this.root.add(createVoxelMeshes(input.volume));
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
