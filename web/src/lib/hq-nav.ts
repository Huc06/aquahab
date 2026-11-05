import * as THREE from "three";
import { OFFICE_HALF } from "./hq-layout";

// Walkable floor for the crew. The office is rasterized into a grid: a cell is blocked when any part of
// the office stands above the floor inside it (desks, chairs, the Vault, plants). Each blocked cell also
// blocks its neighbours, so a crew member keeps one cell of clearance from every object.

export const NAV_SIZE = 64;
const CELL = (OFFICE_HALF * 2) / NAV_SIZE;
// Heights above the floor that count as an obstacle. Below the clearance is floor detail; above the height is out of reach.
const STAND_CLEARANCE = 0.04;
const STAND_HEIGHT = 0.5;
// Blocked patches smaller than this are noise (specks of geometry), not objects.
const MIN_OBJECT_CELLS = 4;

const NEIGHBOURS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface NavGrid {
  free: Uint8Array; // 1 = walkable; index = row * NAV_SIZE + col
  blocked: Uint8Array; // 1 = an object stands here, before the clearance is added
}

export interface Cell {
  col: number;
  row: number;
}

const clamp = (n: number) => Math.min(NAV_SIZE - 1, Math.max(0, n));
const indexOf = (c: Cell) => c.row * NAV_SIZE + c.col;

export function cellOf(x: number, z: number): Cell {
  return { col: clamp(Math.floor((x + OFFICE_HALF) / CELL)), row: clamp(Math.floor((z + OFFICE_HALF) / CELL)) };
}

export function worldOf(c: Cell): { x: number; z: number } {
  return { x: -OFFICE_HALF + (c.col + 0.5) * CELL, z: -OFFICE_HALF + (c.row + 0.5) * CELL };
}

// Rasterize every mesh under `root` (in world space) into the grid. `floorY` is the walking surface.
export function buildNavGrid(root: THREE.Object3D, floorY: number): NavGrid {
  const blocked = new Uint8Array(NAV_SIZE * NAV_SIZE);
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const height = v.y - floorY;
      if (height <= STAND_CLEARANCE || height > STAND_HEIGHT) continue;
      if (Math.abs(v.x) > OFFICE_HALF || Math.abs(v.z) > OFFICE_HALF) continue;
      blocked[indexOf(cellOf(v.x, v.z))] = 1;
    }
  });

  const free = new Uint8Array(blocked.length).fill(1);
  for (let row = 0; row < NAV_SIZE; row++) {
    for (let col = 0; col < NAV_SIZE; col++) {
      if (!blocked[row * NAV_SIZE + col]) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (r >= 0 && c >= 0 && r < NAV_SIZE && c < NAV_SIZE) free[r * NAV_SIZE + c] = 0;
        }
      }
    }
  }
  return { free, blocked };
}

// The grid is built once per loaded office and reused by every crew member and by the object labels.
const navCache = new WeakMap<THREE.Object3D, NavGrid>();
export function navFor(root: THREE.Object3D, floorY: number): NavGrid {
  let grid = navCache.get(root);
  if (!grid) {
    grid = buildNavGrid(root, floorY);
    navCache.set(root, grid);
  }
  return grid;
}

export function isFree(grid: NavGrid, c: Cell): boolean {
  return c.col >= 0 && c.row >= 0 && c.col < NAV_SIZE && c.row < NAV_SIZE && grid.free[indexOf(c)] === 1;
}

// A random walkable cell within `radius` of `home`, or null after a few tries.
export function pickTarget(grid: NavGrid, home: { x: number; z: number }, radius: number, random: () => number = Math.random): Cell | null {
  const center = cellOf(home.x, home.z);
  const reach = Math.ceil(radius / CELL);
  for (let attempt = 0; attempt < 40; attempt++) {
    const c = {
      col: center.col + Math.round((random() * 2 - 1) * reach),
      row: center.row + Math.round((random() * 2 - 1) * reach),
    };
    if (!isFree(grid, c)) continue;
    const w = worldOf(c);
    if (Math.hypot(w.x - home.x, w.z - home.z) <= radius) return c;
  }
  return null;
}

// Breadth-first search over walkable cells. Returns the cells to step through, excluding `from`.
export function findPath(grid: NavGrid, from: Cell, to: Cell): Cell[] | null {
  if (!isFree(grid, from) || !isFree(grid, to)) return null;
  const start = indexOf(from);
  const goal = indexOf(to);
  const previous = new Int32Array(grid.free.length).fill(-1);
  previous[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current === goal) break;
    const col = current % NAV_SIZE;
    const row = Math.floor(current / NAV_SIZE);
    for (const [dc, dr] of NEIGHBOURS) {
      const next = { col: col + dc, row: row + dr };
      if (!isFree(grid, next)) continue;
      const nextIndex = indexOf(next);
      if (previous[nextIndex] !== -1) continue;
      previous[nextIndex] = current;
      queue.push(nextIndex);
    }
  }
  if (previous[goal] === -1) return null;
  const path: Cell[] = [];
  for (let at = goal; at !== start; at = previous[at]) {
    path.push({ col: at % NAV_SIZE, row: Math.floor(at / NAV_SIZE) });
  }
  return path.reverse();
}

export interface ObjectCluster {
  id: number;
  x: number; // centre of the object on the floor
  z: number;
  cells: number;
}

export interface ObjectMap {
  clusters: ObjectCluster[];
  idAt: Int32Array; // cluster id per cell, -1 for floor
}

// Groups touching blocked cells into objects. Ids follow a fixed scan order, so the same model always gives the same ids.
export function objectsOf(grid: NavGrid): ObjectMap {
  const total = NAV_SIZE * NAV_SIZE;
  const idAt = new Int32Array(total).fill(-1);
  const clusters: ObjectCluster[] = [];
  for (let start = 0; start < total; start++) {
    if (!grid.blocked[start] || idAt[start] !== -1) continue;
    const members: number[] = [];
    const stack = [start];
    idAt[start] = -2; // claimed, not yet numbered
    while (stack.length) {
      const current = stack.pop()!;
      members.push(current);
      const col = current % NAV_SIZE;
      const row = Math.floor(current / NAV_SIZE);
      for (const [dc, dr] of NEIGHBOURS) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= NAV_SIZE || r >= NAV_SIZE) continue;
        const next = r * NAV_SIZE + c;
        if (grid.blocked[next] && idAt[next] === -1) {
          idAt[next] = -2;
          stack.push(next);
        }
      }
    }
    if (members.length < MIN_OBJECT_CELLS) {
      for (const m of members) idAt[m] = -1;
      continue;
    }
    const id = clusters.length;
    let sx = 0;
    let sz = 0;
    for (const m of members) {
      idAt[m] = id;
      const w = worldOf({ col: m % NAV_SIZE, row: Math.floor(m / NAV_SIZE) });
      sx += w.x;
      sz += w.z;
    }
    clusters.push({ id, x: sx / members.length, z: sz / members.length, cells: members.length });
  }
  return { clusters, idAt };
}

// The object under a point on the floor, or null when the point is open floor.
export function objectAt(map: ObjectMap, x: number, z: number): ObjectCluster | null {
  const id = map.idAt[indexOf(cellOf(x, z))];
  return id >= 0 ? map.clusters[id] : null;
}
