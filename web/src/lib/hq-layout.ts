// HQ scene layout in office-local units (the office GLB spans about ±0.95 on x and z).
// Source of truth for the desk layout: docs/features/hq-scene.md.
//
// CALIBRATION NOTE: only `one` is measured (leadAnchor from design-export/hq-asset-composition.html:
// x 0.12, z 0.55). The other four positions are estimates in the same space. Calibrate them
// against the composition page's desk readouts before relying on the layout.
import type { AgentId } from "./types";

export const OFFICE_Y = 0; // office origin sits on the floor plane
export const FLOOR_Y = -0.12; // floor min-Y measured in the composition study

export interface DeskSpot {
  id: AgentId;
  x: number;
  z: number;
  turnDeg: number; // facing offset, degrees around Y
}

export const DESK_SPOTS: DeskSpot[] = [
  { id: "one", x: 0.12, z: 0.55, turnDeg: 0 }, // measured
  { id: "researcher", x: -0.55, z: -0.25, turnDeg: -26 }, // estimate
  { id: "builder", x: 0.55, z: -0.45, turnDeg: 18 }, // estimate
  { id: "lofi", x: -0.55, z: 0.35, turnDeg: -8 }, // estimate
  { id: "hippo", x: 0.5, z: 0.55, turnDeg: 34 }, // estimate
];

// Target height of one crew member, in office-local units. Every model is scaled to this height,
// so replacing the GLB does not change the crew size. 0.23 matches the previous captain at scale 0.12.
export const CREW_HEIGHT = 0.23;

// Clip played at every desk. Must match a clip name in captain.glb.
export const CREW_ANIMATION = "Bar_Hang_Idle";

// Camera from the composition study: az 32°, el 28°, fov 30.
export const CAMERA = { azDeg: 32, elDeg: 28, fov: 30, distance: 4.2, target: [0, 0.05, 0] as [number, number, number] };
