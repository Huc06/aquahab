"use client";

import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, PerspectiveCamera, useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { AGENTS } from "@/lib/mock";
import { CAMERA, CREW_ANIMATION, CREW_HEIGHT, DESK_SPOTS, FLOOR_Y, type DeskSpot } from "@/lib/hq-layout";
import { useHQ } from "@/lib/store";
import type { Agent, AgentStatus } from "@/lib/types";

const OFFICE_URL = "/models/office.glb";
const CAPTAIN_URL = "/models/captain.glb";

useGLTF.preload(OFFICE_URL);
useGLTF.preload(CAPTAIN_URL);

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Idle",
  assigned: "Assigned",
  working: "Working",
  review: "Ready for review",
  blocked: "Blocked",
  offline: "Offline",
};

// Same material treatment as the composition study: matte standard material,
// keeping only the textures. Imported GLB materials are metallic and read as near-black.
function retint(root: THREE.Object3D): THREE.Object3D {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const source = mesh.material as THREE.MeshStandardMaterial;
    const material = new THREE.MeshStandardMaterial({
      map: source.map ?? null,
      normalMap: source.normalMap ?? null,
      metalness: 0,
      roughness: 0.88,
      side: THREE.DoubleSide,
    });
    if (source.normalMap) material.normalScale.set(0.6, 0.6);
    mesh.material = material;
    mesh.frustumCulled = false;
  });
  return root;
}

function Office() {
  const { scene: source } = useGLTF(OFFICE_URL);
  const scene = useMemo(() => retint(source), [source]);
  return <primitive object={scene} />;
}

interface CrewMemberProps {
  spot: DeskSpot;
  agent: Agent;
  model: THREE.Object3D;
  animations: THREE.AnimationClip[];
  scale: number;
  baseY: number;
  selected: boolean;
  onSelect: () => void;
}

// One crew member. Each member gets its own skinned clone, so each one animates on its own.
function CrewMember({ spot, agent, model, animations, scale, baseY, selected, onSelect }: CrewMemberProps) {
  const rootRef = useRef<THREE.Group>(null);
  const instance = useMemo(() => cloneSkinned(model), [model]);
  const { actions } = useAnimations(animations, rootRef);

  useEffect(() => {
    const action = actions[CREW_ANIMATION];
    if (!action) return;
    action.reset().fadeIn(0.3).play();
    return () => {
      action.fadeOut(0.2);
    };
  }, [actions]);

  return (
    <>
      <group
        ref={rootRef}
        position={[spot.x, baseY, spot.z]}
        rotation={[0, THREE.MathUtils.degToRad(spot.turnDeg), 0]}
        scale={scale}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <primitive object={instance} />
      </group>
      <Html
        position={[spot.x, FLOOR_Y + CREW_HEIGHT + 0.06, spot.z]}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          aria-hidden="true"
          className={`whitespace-nowrap rounded-[4px] border px-2 py-1 text-xs leading-4 ${
            selected ? "border-mem bg-raised" : "border-line bg-surface/90"
          }`}
        >
          <span className="font-semibold text-agent">{agent.name}</span>
          <span className="ml-2 text-fg-2">
            {STATUS_LABEL[agent.status]}
            {agent.currentTask ? ` · ${agent.currentTask}` : ""}
          </span>
        </div>
      </Html>
    </>
  );
}

// Five crew members share one captain file. Height is normalized to CREW_HEIGHT,
// so swapping the model does not change the crew size by hand.
function Crew() {
  const { scene: source, animations } = useGLTF(CAPTAIN_URL);
  const prepared = useMemo(() => retint(source), [source]);
  const selectedAgent = useHQ((s) => s.selectedAgent);
  const selectAgent = useHQ((s) => s.selectAgent);

  const { scale, baseY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(prepared);
    const h = box.max.y - box.min.y;
    const s = h > 0 ? CREW_HEIGHT / h : 1;
    return { scale: s, baseY: FLOOR_Y - box.min.y * s };
  }, [prepared]);

  const agentById = useMemo(() => Object.fromEntries(AGENTS.map((a) => [a.id, a])), []);

  return (
    <>
      {DESK_SPOTS.map((spot) => (
        <CrewMember
          key={spot.id}
          spot={spot}
          agent={agentById[spot.id]}
          model={prepared}
          animations={animations}
          scale={scale}
          baseY={baseY}
          selected={selectedAgent === spot.id}
          onSelect={() => selectAgent(spot.id)}
        />
      ))}
    </>
  );
}

// 60 particles max (DESIGN.md §7.5). Low opacity, no shadows.
function Particles({ count = 60 }: { count?: number }) {
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3);
    // Seeded generator: stable positions across renders, no Math.random during render.
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      a[i * 3] = (rand() * 2 - 1) * 1.8;
      a[i * 3 + 1] = rand() * 1.2 - 0.1;
      a[i * 3 + 2] = (rand() * 2 - 1) * 1.8;
    }
    return a;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#5ee7f0" size={0.012} transparent opacity={0.24} depthWrite={false} />
    </points>
  );
}

function cameraPosition(): [number, number, number] {
  const [tx, ty, tz] = CAMERA.target;
  const az = THREE.MathUtils.degToRad(CAMERA.azDeg);
  const el = THREE.MathUtils.degToRad(CAMERA.elDeg);
  return [
    tx + CAMERA.distance * Math.cos(el) * Math.sin(az),
    ty + CAMERA.distance * Math.sin(el),
    tz + CAMERA.distance * Math.cos(el) * Math.cos(az),
  ];
}

export function HQScene() {
  const clearSelection = useHQ((s) => s.selectAgent);
  const controlsTarget = useMemo(() => new THREE.Vector3(...CAMERA.target), []);
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
        style={{ background: "#050b17" }}
        onPointerMissed={() => clearSelection(null)}
      >
        <PerspectiveCamera makeDefault position={cameraPosition()} fov={CAMERA.fov} />
        {/* Free rotation for inspecting the scene. Zoom and tilt are limited. */}
        <OrbitControls
          target={controlsTarget}
          enablePan={false}
          enableDamping
          minDistance={2}
          maxDistance={8}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2.05}
        />
        {/* Brighter lighting so the office reads on every side when rotating. */}
        <ambientLight color="#dfeef7" intensity={1.1} />
        <hemisphereLight args={["#dfeef7", "#0c1d33", 0.5]} />
        <directionalLight color="#e8f7ff" intensity={0.9} position={[-0.55, 1, 0.65]} />
        <directionalLight color="#8fb6d4" intensity={0.4} position={[0.8, 0.4, -0.6]} />
        <Office />
        <Crew />
        <Particles />
      </Canvas>
    </div>
  );
}
