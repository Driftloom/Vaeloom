/**
 * Memory — interactive knowledge graph (vanilla three).
 * Six entity types clustered by affinity; hover/tap highlights
 * relationships and reports them to the DOM overlay.
 */

import * as THREE from 'three';
import { createRenderer, runLoop, pickAt, type SceneHandle } from './engine';
import { mulberry32, scenePalette } from '../scene-utils';

const TYPE_LIST = ['skill', 'project', 'org', 'person', 'document', 'event'] as const;
export type GraphType = (typeof TYPE_LIST)[number];

export const NODE_LABELS: Record<string, string[]> = {
  skill: ['React', 'TypeScript', 'Node.js', 'SQL', 'Python', 'System Design', 'Docker', 'GraphQL'],
  project: [
    'Campus Placement Portal',
    'ML Attendance Predictor',
    'E-commerce API',
    'Portfolio Site',
    'Chat App',
    'Internship Dashboard',
  ],
  org: ['Infosys', 'Zomato', 'Smart India Hackathon', 'IIT Delhi', 'Google DSC'],
  person: ['Prof. Sharma', 'Teammate · Priya', 'Mentor · Rahul', 'Recruiter · Ananya'],
  document: [
    'SIH 2025 Certificate',
    'Coursera ML Cert.',
    'Offer Letter',
    'Transcript',
    'Resume v12',
  ],
  event: ['Frontend Engineer @ Zeta', 'Hackathon Finals', 'Internship Start', 'Placement Season'],
};

/** Cluster offsets per type — hubs sit at the first index of each. */
export const CLUSTER_OFFSETS = [0, 8, 14, 20, 24, 29];
/** Curated hub nodes mapped to rows in copy.MEMORY.interactions. */
export const CURATED = { 0: 0, 8: 1, 14: 2 } as Record<number, number>;

type NodeDef = { pos: THREE.Vector3; type: GraphType; label: string };

function buildGraph(): { nodes: NodeDef[]; edges: Array<[number, number]> } {
  const rand = mulberry32(20260825);
  const nodes: NodeDef[] = [];
  const centers = [
    new THREE.Vector3(1.9, 0.6, 0),
    new THREE.Vector3(-1.7, 1.1, 0.8),
    new THREE.Vector3(-0.4, -1.9, -0.6),
    new THREE.Vector3(2.2, -1.5, -1.2),
    new THREE.Vector3(-2.6, -0.4, 1.4),
    new THREE.Vector3(0.4, 0.2, -2.4),
  ];
  const perCluster = [8, 6, 6, 4, 5, 5];
  TYPE_LIST.forEach((type, ci) => {
    const center = centers[ci]!;
    const labels = NODE_LABELS[type] ?? [];
    for (let i = 0; i < perCluster[ci]!; i++) {
      const pos = center
        .clone()
        .add(new THREE.Vector3((rand() - 0.5) * 2.4, (rand() - 0.5) * 2.0, (rand() - 0.5) * 2.2));
      nodes.push({ pos, type, label: labels[i % labels.length] ?? type });
    }
  });
  const edges: Array<[number, number]> = [];
  let offset = 0;
  const hubs: number[] = [];
  TYPE_LIST.forEach((_, ci) => {
    hubs.push(offset);
    for (let i = 0; i < perCluster[ci]! - 1; i++) {
      edges.push([offset + i, offset + i + 1]);
      if (rand() > 0.55) edges.push([offset + i, offset + Math.floor(rand() * perCluster[ci]!)]);
    }
    offset += perCluster[ci]!;
  });
  for (let h = 0; h < hubs.length; h++) {
    edges.push([hubs[h]!, hubs[(h + 1) % hubs.length]!]);
  }
  return { nodes, edges };
}

type Cfg = {
  container: HTMLElement;
  theme: 'dark' | 'light';
  onSelectionChange?: (
    sel: { index: number; info: { label: string; type: string; connections: number } } | null,
  ) => void;
};

export function mountKnowledgeGraph({
  container,
  theme,
  onSelectionChange,
}: Cfg): SceneHandle & { setSelectedIndex: (i: number) => void } {
  const palette = scenePalette(theme);
  const { renderer, scene, camera } = createRenderer(container);
  camera.position.set(0, 1.4, 8.6);

  const { nodes, edges } = buildGraph();
  const neighborSets = new Map<number, Set<number>>();
  edges.forEach(([a, b]) => {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as Array<[number, number]>) {
      if (!neighborSets.has(x)) neighborSets.set(x, new Set());
      neighborSets.get(x)?.add(y);
    }
  });

  /* Nodes — one InstancedMesh ------------------------------------------- */
  const nodeGeo = new THREE.SphereGeometry(0.14, 14, 14);
  const nodeMat = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(nodeGeo, nodeMat, nodes.length);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  nodes.forEach((n, i) => {
    dummy.position.copy(n.pos);
    dummy.scale.setScalar(n.type === 'project' || n.type === 'org' ? 1.35 : 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.set(palette.nodes[n.type] ?? palette.core));
  });
  scene.add(mesh);

  /* Edges — one LineSegments batch -------------------------------------- */
  const edgePos = new Float32Array(edges.length * 6);
  const edgeCol = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], i) => {
    const pa = nodes[a]!.pos;
    const pb = nodes[b]!.pos;
    edgePos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], i * 6);
  });
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
  edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));
  const lines = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }),
  );
  lines.frustumCulled = false;
  scene.add(lines);

  function paintEdges(active: number): void {
    const cDim = new THREE.Color(palette.edge);
    const cHot = new THREE.Color(palette.edgeHot);
    const cLink = new THREE.Color(palette.link);
    edges.forEach(([a, b], i) => {
      const hot = active >= 0 && (a === active || b === active);
      const col = hot ? (a === active ? cHot : cLink) : cDim;
      edgeCol.set([col.r, col.g, col.b], i * 6);
      edgeCol.set([col.r, col.g, col.b], i * 6 + 3);
    });
    (edgeGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
  paintEdges(-1);

  let selected = -1;

  function emitSelection(index: number): void {
    selected = index;
    paintEdges(index);
    if (!onSelectionChange) return;
    if (index >= 0 && index < nodes.length) {
      const n = nodes[index]!;
      onSelectionChange({
        index,
        info: { label: n.label, type: n.type, connections: neighborSets.get(index)?.size ?? 0 },
      });
    } else {
      onSelectionChange(null);
    }
  }

  const onMove = (e: PointerEvent): void => {
    const id = pickAt(e, container, camera, [mesh]);
    if (id !== -1 && id !== selected && id !== -2) emitSelection(id);
  };
  const onLeave = (): void => emitSelection(-1);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerleave', onLeave);

  const handle = runLoop(
    container,
    renderer,
    scene,
    camera,
    {
      tick: (_dt, t) => {
        mesh.rotation.y = t * 0.05;
        mesh.rotation.x = 0.18;
        lines.rotation.copy(mesh.rotation);
        camera.lookAt(0, 0, 0);
      },
    },
    1.75,
  );

  return {
    setRunning: handle.setRunning,
    dispose(): void {
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', onLeave);
      handle.dispose();
    },
    setSelectedIndex(i: number): void {
      emitSelection(i);
    },
  };
}

export function createKnowledgeGraph(theme: 'dark' | 'light'): {
  group: THREE.Group;
  update: (t: number) => void;
  setSelected: (i: number) => void;
  dispose: () => void;
} {
  const palette = scenePalette(theme);
  const group = new THREE.Group();
  const { nodes, edges } = buildGraph();
  const nodeGeo = new THREE.SphereGeometry(0.14, 14, 14);
  const nodeMat = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(nodeGeo, nodeMat, nodes.length);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  nodes.forEach((n, i) => {
    dummy.position.copy(n.pos);
    dummy.scale.setScalar(n.type === 'project' || n.type === 'org' ? 1.35 : 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.set(palette.nodes[n.type] ?? palette.core));
  });
  group.add(mesh);
  const edgePos = new Float32Array(edges.length * 6);
  const edgeCol = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], i) => {
    const pa = nodes[a]!.pos;
    const pb = nodes[b]!.pos;
    edgePos.set([pa.x, pa.y, pa.z, pb.x, pb.y, pb.z], i * 6);
  });
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
  edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));
  const lines = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }),
  );
  lines.frustumCulled = false;
  group.add(lines);
  function paintEdges(active: number): void {
    const cDim = new THREE.Color(palette.edge);
    const cHot = new THREE.Color(palette.edgeHot);
    const cLink = new THREE.Color(palette.link);
    edges.forEach(([a, b], i) => {
      const hot = active >= 0 && (a === active || b === active);
      const col = hot ? (a === active ? cHot : cLink) : cDim;
      edgeCol.set([col.r, col.g, col.b], i * 6);
      edgeCol.set([col.r, col.g, col.b], i * 6 + 3);
    });
    (edgeGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }
  paintEdges(-1);
  function update(t: number): void {
    mesh.rotation.y = t * 0.05;
    mesh.rotation.x = 0.18;
    lines.rotation.copy(mesh.rotation);
  }
  function setSelected(i: number): void {
    paintEdges(i);
  }
  function dispose(): void {
    nodeGeo.dispose();
    nodeMat.dispose();
    edgeGeo.dispose();
    (lines.material as THREE.Material).dispose();
  }
  return { group, update, setSelected, dispose };
}
