"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { retint } from "@/lib/materials";

const CITY_URL = "/models/city.glb";
useGLTF.preload(CITY_URL);

// Aqua City preview (Phase 2 concept, shown early for review). Free orbit, zoom limited.
function City() {
  const { scene: source } = useGLTF(CITY_URL);
  const scene = useMemo(() => retint(source), [source]);
  return <primitive object={scene} />;
}

export function CityScene() {
  const target = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.NoToneMapping }} style={{ background: "transparent" }}>
        <PerspectiveCamera makeDefault position={[0, 1.9, 2.8]} fov={35} />
        <OrbitControls target={target} enablePan={false} enableDamping minDistance={1.5} maxDistance={8} maxPolarAngle={Math.PI / 2.05} />
        <ambientLight color="#dfeef7" intensity={1.1} />
        <hemisphereLight args={["#dfeef7", "#0c1d33", 0.5]} />
        <directionalLight color="#e8f7ff" intensity={0.9} position={[-0.55, 1, 0.65]} />
        <City />
      </Canvas>
    </div>
  );
}
