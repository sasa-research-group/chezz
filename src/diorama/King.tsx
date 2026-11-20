// The live white king, version A: Meshy's rigged figure, colours and clay relief baked from the stage's
// Cycles material (tools/art/diorama/bake_king.py), lit live. The board shows the pre-rendered Cycles king
// (KingSprite.tsx); this one stays for `?king=live` and, drawn into the shadow map only, casts his shadow.
// Felt: sheen in a lighter tint of the base colour, a fresnel rim for the fuzz halo, and a few shell layers. Crown: matte gold
// with a warm glow, picked out by height in the bind pose.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { calmIdle } from "./calmIdle";

export const KING_URL = "diorama/king.glb";
const CROWN = 0.82;  // bind-pose height fraction where the crown starts
const KING_TURN = import.meta.env.DEV && /kingrot=(-?\d+)/.test(location.search) ? +RegExp.$1 * Math.PI / 180 : 0;
// Felt: shells to SHELL_LEN x SHELLS of his height face-on, FRINGE times longer where the surface turns
// away (the silhouette), so fibres stand out against the dark like Cycles' hair; FIBRE fibre cells across the UVs.
const SHELLS = import.meta.env.DEV && /shells=(\d+)/.test(location.search) ? +RegExp.$1 : 7, SHELL_LEN = 0.0065, FRINGE = 2.2, FIBRE = 520.0;

type Tweak = { shell?: number; of?: number };
/** Adds the crown mask, the fresnel halo and (for shells) the push along the normal and fibre cut-out. */
function feltShader(m: THREE.MeshPhysicalMaterial, lo: number, hi: number, { shell = 0, of = 1 }: Tweak) {
  m.onBeforeCompile = s => {
    s.uniforms.lo = { value: lo }; s.uniforms.hi = { value: hi }; s.uniforms.shell = { value: shell / of };
    s.uniforms.push = { value: shell * SHELL_LEN * (hi - lo) };
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float lo; uniform float hi; uniform float push; varying float vH;")
      .replace("#include <skinning_vertex>", `#include <skinning_vertex>
vH = (position.y - lo) / (hi - lo);
vec3 nV = normalize(normalMatrix * objectNormal);
float edge = 1.0 - abs(dot(nV, normalize(-(modelViewMatrix * vec4(transformed, 1.0)).xyz)));
transformed += normalize(objectNormal) * push * (1.0 + ${FRINGE.toFixed(2)} * edge * edge) * step(vH, ${CROWN.toFixed(2)});`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float shell; varying float vH;\nfloat fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }")
      .replace("#include <map_fragment>", `#include <map_fragment>
float crown = smoothstep(${(CROWN - 0.01).toFixed(3)}, ${(CROWN + 0.01).toFixed(3)}, vH);
if (shell > 0.0) {
  if (crown > 0.5) discard;
  vec2 cell = floor(vMapUv * ${FIBRE.toFixed(1)});
  float edge = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
  if (fh(cell) < shell * 0.9 + 0.08 - 0.25 * edge) discard;
  diffuseColor.rgb *= (0.8 + 0.16 * shell) * (0.85 + 0.3 * fh(cell + 17.0));
}
diffuseColor.rgb *= mix(vec3(1.0), vec3(1.05, 0.9, 0.62), crown);`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.55, crown);")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
// The warm backlit halo: Cycles' king_rim (1, .82, .6) sits behind and above him, so the rim is warmest on top.
vec3 nRim = normalize(vNormal);
float rim = pow(1.0 - clamp(dot(nRim, normalize(vViewPosition)), 0.0, 1.0), 2.5) * (0.45 + 0.55 * clamp(0.5 + 0.5 * nRim.y, 0.0, 1.0));
totalEmissiveRadiance += mix(diffuseColor.rgb, vec3(1.0, 0.72, 0.45) * 0.5, 0.6) * rim * 0.4 * (1.0 - crown);
totalEmissiveRadiance += vec3(1.0, 0.62, 0.25) * 0.04 * crown;`);
  };
  m.customProgramCacheKey = () => `felt${shell}`;
}

/** A piece at rest stands still and only breathes: a 1% rise of his height, feet planted, every 3.5 s. */
export const breath = (t: number) => 1 + 0.01 * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI / 3.5));

/** `yaw`: his heading about the floor's up axis, 0 toward the camera; he turns to it over about 0.2 s.
 * `shadowOnly`: drawn into the shadow map and nowhere else. */
export function King({ position, scale = 1, yaw = 0, onClick, shadowOnly = false }: { position: [number, number, number]; scale?: number; yaw?: number; onClick?: () => void; shadowOnly?: boolean }) {
  const gltf = useGLTF(KING_URL);
  const root = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);
  const group = useRef<THREE.Group>(null);
  // Still: the Idle clip's first frame with the stance squared to the front (calmIdle), held.
  const clips = useMemo(() => gltf.animations.map(c => (/idle/i.test(c.name) ? calmIdle(c, gltf.scene) : c)), [gltf]);
  const { actions, names } = useAnimations(clips, group);
  useEffect(() => {
    const a = actions[names.find(n => /idle/i.test(n)) ?? names[0]];
    if (a) { a.reset().play(); a.time = 0; a.paused = true; }
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
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      if (shadowOnly) { Object.assign(mesh.material as THREE.Material, { colorWrite: false, depthWrite: false }); continue; }
      for (let i = 1; i <= SHELLS; i++) {
        const sh = new THREE.SkinnedMesh(mesh.geometry, make(i));
        sh.bind(mesh.skeleton, mesh.bindMatrix);
        sh.frustumCulled = false;
        sh.renderOrder = i;
        mesh.parent!.add(sh);
      }
    }
  }, [root, shadowOnly]);
  // Turn the short way to the heading (95% there in 0.2 s), and breathe (dev: ?kingrot=deg adds a turn).
  const heading = useRef(yaw);
  useFrame(({ clock }, dt) => {
    const d = Math.atan2(Math.sin(yaw - heading.current), Math.cos(yaw - heading.current));
    heading.current += d * (1 - Math.exp(-Math.min(dt, 0.1) * 15));
    if (group.current) { group.current.rotation.y = heading.current + KING_TURN; group.current.scale.y = breath(clock.elapsedTime); }
  });
  return <group position={position} rotation={[Math.PI / 2, 0, 0]} scale={scale}>
    <group ref={group} onClick={onClick ? e => { e.stopPropagation(); onClick(); } : undefined}><primitive object={root} /></group>
  </group>;
}
useGLTF.preload(KING_URL);
