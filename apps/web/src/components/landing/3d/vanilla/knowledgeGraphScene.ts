/**
 * Memory — interactive knowledge graph (vanilla three).
 * Six entity types clustered by affinity; relationships are highlighted by an
 * id handed down from the section's curated buttons (the shared-stage
 * `createKnowledgeGraph` path, which is what the landing page actually runs).
 */

import * as THREE from 'three';
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

export function createKnowledgeGraph(theme: 'dark' | 'light'): {
  group: THREE.Group;
  update: (t: number) => void;
  /**
   * Highlight the node with this id and dim the rest.
   *
   * Accepts either the curated numeric id the Memory section passes (see
   * `CURATED` — the graph index of each hub node) or a node label, so callers
   * that only know what a node is called can still select it. An id that
   * matches nothing clears the highlight rather than leaving a stale one.
   */
  setSelected: (id: string | number) => void;
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
  // Base appearance is cached so repainting on selection is a pure read of
  // these arrays — otherwise every deselect would have to re-derive colours
  // from the palette, and a palette tweak could quietly change the resting
  // state instead of the highlighted one.
  const baseColors = nodes.map((n) => new THREE.Color(palette.nodes[n.type] ?? palette.core));
  const baseScales = nodes.map((n) => (n.type === 'project' || n.type === 'org' ? 1.35 : 1));
  const writeNode = (i: number, scale: number): void => {
    dummy.position.copy(nodes[i]!.pos);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };
  group.add(mesh);

  const adjacency = new Map<number, number[]>();
  edges.forEach(([a, b]) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push(b);
    adjacency.get(b)!.push(a);
  });

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
  const REST_OPACITY = 0.85;
  const edgeMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: REST_OPACITY,
  });
  const lines = new THREE.LineSegments(edgeGeo, edgeMat);
  lines.frustumCulled = false;
  group.add(lines);

  // Colour roles, resolved once. `edge` doubles as the dim target for nodes:
  // it is the one palette entry that sits on the same side of every node hue
  // as the panel behind them in both themes, so lerping toward it reads as
  // "receding" rather than as a different kind of node.
  const cDim = new THREE.Color(palette.edge);
  const cHot = new THREE.Color(palette.edgeHot);
  const cLink = new THREE.Color(palette.link);
  const scratch = new THREE.Color();

  function paintEdges(active: number): void {
    edges.forEach(([a, b], i) => {
      const hot = active >= 0 && (a === active || b === active);
      const col = hot ? (a === active ? cHot : cLink) : cDim;
      edgeCol.set([col.r, col.g, col.b], i * 6);
      edgeCol.set([col.r, col.g, col.b], i * 6 + 3);
    });
    (edgeGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  /**
   * Emphasis is carried by colour, scale and link opacity rather than by
   * `linewidth`: WebGL clamps line width to 1px on every mainstream
   * implementation, so asking LineBasicMaterial for 3px silently does nothing
   * and the highlight would look identical to the resting state.
   */
  function paintNodes(active: number): void {
    const near = active >= 0 ? new Set(adjacency.get(active) ?? []) : null;
    nodes.forEach((_, i) => {
      let col = baseColors[i]!;
      let scale = baseScales[i]!;
      if (active >= 0) {
        if (i === active) {
          col = cHot;
          scale *= 1.5;
        } else if (near!.has(i)) {
          scale *= 1.12;
        } else {
          col = scratch.copy(baseColors[i]!).lerp(cDim, 0.6);
        }
      }
      writeNode(i, scale);
      mesh.setColorAt(i, color.copy(col));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function resolveId(id: string | number): number {
    const raw = String(id).trim();
    if (raw !== '') {
      const asIndex = Number(raw);
      if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < nodes.length) return asIndex;
    }
    const want = raw.toLowerCase();
    return nodes.findIndex((n) => n.label.toLowerCase() === want);
  }

  // Resting state is painted through the same path as a highlighted one, so
  // "nothing selected" can never diverge from "selected, then deselected".
  paintEdges(-1);
  paintNodes(-1);

  function update(t: number): void {
    // Damped oscillation instead of a continuous yaw.
    //
    // A full revolution (`t * 0.05`, 125s per turn) swung the cloud's
    // horizontal fill between 36% and 73% and, at the widest phase, pushed the
    // outer nodes past the frame on narrow viewports. Oscillating through
    // ±0.55 rad keeps the graph in the middle of its range: enough parallax to
    // read as depth, never enough to empty the box or clip it.
    mesh.rotation.y = Math.sin(t * 0.18) * 0.55;
    mesh.rotation.x = 0.18;
    lines.rotation.copy(mesh.rotation);
  }
  function setSelected(id: string | number): void {
    const active = resolveId(id);
    paintEdges(active);
    paintNodes(active);
    edgeMat.opacity = active >= 0 ? 1 : REST_OPACITY;
  }
  function dispose(): void {
    nodeGeo.dispose();
    nodeMat.dispose();
    edgeGeo.dispose();
    edgeMat.dispose();
  }
  return { group, update, setSelected, dispose };
}
