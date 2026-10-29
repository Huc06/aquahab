import * as THREE from "three";

// Matte material treatment shared by the HQ and city scenes. Imported GLB materials are
// metallic and read as near-black under soft light, so every mesh gets a standard material
// that keeps only its textures.
export function retint(root: THREE.Object3D): THREE.Object3D {
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
