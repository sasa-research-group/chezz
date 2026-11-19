// The white king, version A: Meshy's rigged figure with the Idle clip, colours and clay relief baked
// from the stage's Cycles material (tools/art/diorama/bake_king.py), lit live. Felt: sheen in a lighter
// tint of the base colour, a fresnel rim for the fuzz halo, and a few shell layers. Crown: matte gold
// with a warm glow, picked out by height in the bind pose.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export const KING_URL = "diorama/king.glb";
const CROWN = 0.82;  // bind-pose height fraction where the crown starts
const KING_TURN = import.meta.env.DEV && /kingrot=(-?\d+)/.test(location.search) ? +RegExp.$1 * Math.PI / 180 : 0;
const KING_W = import.meta.env.DEV && /kingw=([\d.]+)/.test(location.search) ? +RegExp.$1 : 1;
const SHELLS = 10, SHELL_LEN = 0.012;  // fuzz depth as a fraction of his height

type Tweak = { shell?: number; of?: number };
/** Adds the crown mask, the fresnel halo and (for shells) the push along the normal and fibre cut-out. */
function feltShader(m: THREE.MeshPhysicalMaterial, lo: number, hi: number, { shell = 0, of = 1 }: Tweak) {
  m.onBeforeCompile = s => {
    s.uniforms.lo = { value: lo }; s.uniforms.hi = { value: hi }; s.uniforms.shell = { value: shell / of };
    s.uniforms.push = { value: shell * SHELL_LEN * (hi - lo) };
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float lo; uniform float hi; uniform float push; varying float vH;")
      .replace("#include <skinning_vertex>", "#include <skinning_vertex>\nvH = (position.y - lo) / (hi - lo);\ntransformed += normalize(objectNormal) * push * step(vH, " + CROWN.toFixed(2) + ");");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float shell; varying float vH;\nfloat fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }")
      .replace("#include <map_fragment>", `#include <map_fragment>
float crown = smoothstep(${(CROWN - 0.01).toFixed(3)}, ${(CROWN + 0.01).toFixed(3)}, vH);
if (shell > 0.0) {
  if (crown > 0.5) discard;
  float f = fh(floor(vMapUv * 900.0));
  if (f < shell * 0.85 + 0.1) discard;
  diffuseColor.rgb *= 0.85 + 0.3 * shell;
}
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.05, 0.9, 0.62), crown);`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, crown);")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
totalEmissiveRadiance += diffuseColor.rgb * rim * 0.3 * (1.0 - crown);
totalEmissiveRadiance += vec3(1.0, 0.62, 0.25) * 0.04 * crown;`);
  };
  m.customProgramCacheKey = () => `felt${shell}`;
}

export function King({ position, scale = 1, onClick }: { position: [number, number, number]; scale?: number; onClick?: () => void }) {
  const gltf = useGLTF(KING_URL);
  const root = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);
  const group = useRef<THREE.Group>(null);
  const { actions, names } = useAnimations(gltf.animations, group);
  useEffect(() => {
    const a = actions[names.find(n => /idle/i.test(n)) ?? names[0]];
    a?.reset().setEffectiveWeight(KING_W).setEffectiveTimeScale(0.7).play();
    return () => { a?.stop(); };
  }, [actions, names]);
  useMemo(() => {
    const meshes: THREE.SkinnedMesh[] = [];
    root.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh); });
    for (const mesh of meshes) {
      const src = mesh.material as THREE.MeshStandardMaterial;
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!, lo = bb.min.y, hi = bb.max.y;
      const make = (shell: number) => {
        const m = new THREE.MeshPhysicalMaterial({
          map: src.map, normalMap: src.normalMap, normalScale: new THREE.Vector2(1, 1),
          roughness: 0.9, metalness: 0, sheen: 1, sheenRoughness: 0.6,
          sheenColor: new THREE.Color(0.45, 0.44, 0.42), sheenColorMap: src.map,
          transparent: false, side: THREE.FrontSide,
        });
        feltShader(m, lo, hi, { shell, of: SHELLS });
        return m;
      };
      mesh.material = make(0);
      mesh.castShadow = false;
      mesh.frustumCulled = false;
      for (let i = 1; i <= SHELLS; i++) {
        const sh = new THREE.SkinnedMesh(mesh.geometry, make(i));
        sh.bind(mesh.skeleton, mesh.bindMatrix);
        sh.frustumCulled = false;
        sh.renderOrder = i;
        mesh.parent!.add(sh);
      }
    }
  }, [root]);
  // A slow sway on top (dev: ?kingrot=deg turns him) of the idle so he never looks frozen between loops
  useFrame(({ clock }) => { if (group.current) group.current.rotation.y = KING_TURN + Math.sin(clock.elapsedTime * 0.4) * 0.05; });
  return <group position={position} rotation={[Math.PI / 2, 0, 0]} scale={scale}>
    <group ref={group} onClick={onClick ? e => { e.stopPropagation(); onClick(); } : undefined}><primitive object={root} /></group>
  </group>;
}
useGLTF.preload(KING_URL);
