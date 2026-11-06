"use client";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, PerspectiveCamera, useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { AGENTS } from "@/lib/mock";
import {
  CAMERA,
  CREW_ANIMATION,
  CREW_HEIGHT,
  DESK_SPOTS,
  ENTRANCE_DELAY_S,
  ENTRANCE_DEPTH,
  ENTRANCE_RISE_S,
  ENTRANCE_STAGGER_S,
  FLOOR_Y,
  OBJECT_LABEL_HEIGHT,
  OBJECT_NAMES,
  PAUSE_EXTRA_S,
  PAUSE_MIN_S,
  ROAM_RADIUS,
  WALK_ANIMATION,
  WALK_SPEED,
  type DeskSpot,
} from "@/lib/hq-layout";
import { useBanter } from "@/lib/banter";
import { cellOf, findPath, navFor, objectAt, objectsOf, pickTarget, worldOf, type NavGrid, type ObjectCluster } from "@/lib/hq-nav";
import { useHQ } from "@/lib/store";
import type { Agent, AgentStatus } from "@/lib/types";
import { useActiveRoom } from "@/lib/useApi";
import { retint } from "@/lib/materials";

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

// The office model. Hovering an object shows its caption, from OBJECT_NAMES or "Object N".
function Office() {
  const { scene: source } = useGLTF(OFFICE_URL);
  const scene = useMemo(() => retint(source), [source]);
  const objects = useMemo(() => objectsOf(navFor(source, FLOOR_Y)), [source]);
  const [hovered, setHovered] = useState<ObjectCluster | null>(null);

  return (
    <>
      <primitive
        object={scene}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => setHovered(objectAt(objects, e.point.x, e.point.z))}
        onPointerLeave={() => setHovered(null)}
      />
      {hovered && (
        <Html position={[hovered.x, FLOOR_Y + OBJECT_LABEL_HEIGHT, hovered.z]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-[4px] border border-line bg-surface/90 px-2 py-1 text-xs leading-4 text-fg">
            {OBJECT_NAMES[hovered.id] ?? `Object ${hovered.id + 1}`}
          </div>
        </Html>
      )}
    </>
  );
}

interface CrewMemberProps {
  spot: DeskSpot;
  agent: Agent;
  model: THREE.Object3D;
  animations: THREE.AnimationClip[];
  nav: NavGrid;
  scale: number;
  baseY: number;
  selected: boolean;
  chat: string | null; // the line of small talk, when this member is the speaker
  order: number; // position in the entrance
  onSelect: () => void;
}

interface Roam {
  x: number;
  z: number;
  heading: number; // rotation around Y, radians
  path: { x: number; z: number }[];
  pauseUntil: number; // clock seconds
  moving: boolean;
}

// One crew member. Each member gets its own skinned clone, so each one animates on its own.
// It roams within ROAM_RADIUS of its desk, along a path that avoids every object in the office.
function CrewMember({ spot, agent, model, animations, nav, scale, baseY, selected, chat, order, onSelect }: CrewMemberProps) {
  const rootRef = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Group>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const instance = useMemo(() => cloneSkinned(model), [model]);
  const { actions } = useAnimations(animations, rootRef);
  const playing = useRef<THREE.AnimationAction | null>(null);
  const roam = useRef<Roam>({
    x: spot.x,
    z: spot.z,
    heading: THREE.MathUtils.degToRad(spot.turnDeg),
    path: [],
    pauseUntil: 0,
    moving: false,
  });

  const play = (name: string) => {
    const next = actions[name];
    if (!next || next === playing.current) return;
    next.reset().fadeIn(0.3).play();
    playing.current?.fadeOut(0.3);
    playing.current = next;
  };

  useEffect(() => {
    return () => {
      playing.current?.fadeOut(0.2);
    };
  }, []);

  useFrame((state, delta) => {
    const r = roam.current;
    const now = state.clock.elapsedTime;

    // Entrance: rise from below the floor, one member after another. Roaming starts once risen.
    const progress = THREE.MathUtils.clamp((now - (ENTRANCE_DELAY_S + order * ENTRANCE_STAGGER_S)) / ENTRANCE_RISE_S, 0, 1);
    if (rootRef.current) rootRef.current.visible = progress > 0;
    if (progress < 1) {
      const lift = Math.pow(1 - progress, 3) * ENTRANCE_DEPTH;
      if (rootRef.current) rootRef.current.position.set(spot.x, baseY - lift, spot.z);
      if (labelRef.current) labelRef.current.position.set(spot.x, FLOOR_Y + CREW_HEIGHT + 0.06 - lift, spot.z);
      // Html labels stay in the DOM even when their group is hidden, so the tag fades in by opacity.
      if (tagRef.current) tagRef.current.style.opacity = progress >= 0.5 ? "1" : "0";
      play(CREW_ANIMATION);
      return;
    }
    if (tagRef.current) tagRef.current.style.opacity = "1";

    if (r.path.length === 0 && now >= r.pauseUntil) {
      const target = pickTarget(nav, spot, ROAM_RADIUS);
      const path = target ? findPath(nav, cellOf(r.x, r.z), target) : null;
      if (path && path.length > 0) {
        r.path = path.map(worldOf);
      } else {
        r.pauseUntil = now + 1;
      }
    }

    r.moving = r.path.length > 0;
    if (r.moving) {
      const next = r.path[0];
      const dx = next.x - r.x;
      const dz = next.z - r.z;
      const dist = Math.hypot(dx, dz);
      const step = WALK_SPEED * delta;
      if (dist <= step) {
        r.x = next.x;
        r.z = next.z;
        r.path.shift();
        if (r.path.length === 0) r.pauseUntil = now + PAUSE_MIN_S + Math.random() * PAUSE_EXTRA_S;
      } else {
        r.x += (dx / dist) * step;
        r.z += (dz / dist) * step;
        r.heading = Math.atan2(dx, dz);
      }
    }

    if (rootRef.current) {
      rootRef.current.position.set(r.x, baseY, r.z);
      rootRef.current.rotation.y = r.heading;
    }
    if (labelRef.current) labelRef.current.position.set(r.x, FLOOR_Y + CREW_HEIGHT + 0.06, r.z);
    play(r.moving ? WALK_ANIMATION : CREW_ANIMATION);
  });

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
      <group ref={labelRef} position={[spot.x, FLOOR_Y + CREW_HEIGHT + 0.06, spot.z]}>
        <Html center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div
            ref={tagRef}
            aria-hidden="true"
            className={`w-max max-w-[220px] rounded-[4px] border px-2 py-1 text-xs leading-4 transition-opacity duration-300 ${
              selected ? "border-mem bg-raised" : "border-line bg-surface/90"
            }`}
          >
            <p className="whitespace-nowrap">
              <span className="font-semibold text-agent">{agent.name}</span>
              <span className="ml-2 text-fg-2">
                {STATUS_LABEL[agent.status]}
                {agent.currentTask ? ` · ${agent.currentTask}` : ""}
              </span>
            </p>
            {chat && <p className="mt-1 text-fg">{chat}</p>}
          </div>
        </Html>
      </group>
    </>
  );
}

// Five crew members share one captain file. Height is normalized to CREW_HEIGHT,
// so swapping the model does not change the crew size by hand.
function Crew() {
  const { scene: source, animations } = useGLTF(CAPTAIN_URL);
  const { scene: office } = useGLTF(OFFICE_URL);
  const prepared = useMemo(() => retint(source), [source]);
  const nav = useMemo(() => navFor(office, FLOOR_Y), [office]);
  const selectedAgent = useHQ((s) => s.selectedAgent);
  const selectAgent = useHQ((s) => s.selectAgent);

  const { scale, baseY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(prepared);
    const h = box.max.y - box.min.y;
    const s = h > 0 ? CREW_HEIGHT / h : 1;
    return { scale: s, baseY: FLOOR_Y - box.min.y * s };
  }, [prepared]);

  const agentById = useMemo(() => Object.fromEntries(AGENTS.map((a) => [a.id, a])), []);
  const { room } = useActiveRoom();
  const banter = useBanter(room?.id ?? null);
  // A standup turn that answers another member names them first.
  const line = banter.to ? `@${agentById[banter.to]?.name ?? banter.to} ${banter.text}` : banter.text;

  return (
    <>
      {DESK_SPOTS.map((spot, order) => (
        <CrewMember
          key={spot.id}
          spot={spot}
          agent={agentById[spot.id]}
          model={prepared}
          animations={animations}
          nav={nav}
          scale={scale}
          baseY={baseY}
          selected={selectedAgent === spot.id}
          chat={banter.speaker === spot.id ? line : null}
          order={order}
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
        style={{ background: "transparent" }}
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
