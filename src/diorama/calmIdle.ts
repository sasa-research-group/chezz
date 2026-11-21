// The king's Idle clip stands him about 40 degrees to one side and swings the hips through 90 degrees and the
// head through 240 while he looks around, so it fights the heading the board gives him. calmIdle squares
// the stance to the front, keeps a fraction of the hip turn, and keeps the legs where the clip planted them;
// the spine and head keep a little of their motion around their rest pose. Breathing and arms are untouched.
import * as THREE from "three";

const KEEP_HIPS = 0.15, KEEP_SPINE = 0.5, KEEP_HEAD = 0.25;
const SPINE = ["Spine", "Spine01", "Spine02"], HEAD = ["neck", "Head"];

const twist = (q: THREE.Quaternion, u: THREE.Vector3) => 2 * Math.atan2(q.x * u.x + q.y * u.y + q.z * u.z, q.w);

export function calmIdle(clip: THREE.AnimationClip, scene: THREE.Object3D): THREE.AnimationClip {
  const out = clip.clone();
  const find = (bone: string, prop = "quaternion") => out.tracks.find(t => t.name === `${bone}.${prop}`) as THREE.QuaternionKeyframeTrack | undefined;
  const hipsBone = scene.getObjectByName("Hips"), hips = find("Hips");
  if (!hipsBone || !hips) return out;
  scene.updateMatrixWorld(true);
  // Model up (+y) in the hips' parent space: the axis the stance turns about.
  const pq = new THREE.Quaternion();
  hipsBone.parent?.getWorldQuaternion(pq);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(pq.invert()).normalize();
  const at = (v: ArrayLike<number>, i: number) => new THREE.Quaternion(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]);
  const yaw = (a: number) => new THREE.Quaternion().setFromAxisAngle(up, a);

  // The moment the head looks where the body faces: the spine and head calm down around their pose then.
  const ref = (() => {
    const rig = scene.clone(true), mixer = new THREE.AnimationMixer(rig), head = rig.getObjectByName("Head"), body = rig.getObjectByName("Hips");
    const track = find("Head");
    if (!head || !body || !track) return 0;
    mixer.clipAction(clip).play();
    const fwd = (o: THREE.Object3D) => { const v = new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())); return Math.atan2(v.x, v.z); };
    let best = 0, err = Infinity;
    track.times.forEach((t, i) => {
      mixer.setTime(t); rig.updateMatrixWorld(true);
      const d = Math.abs(Math.atan2(Math.sin(fwd(head) - fwd(body)), Math.cos(fwd(head) - fwd(body))));
      if (d < err) { err = d; best = i; }
    });
    mixer.stopAllAction(); mixer.uncacheRoot(rig);
    return track.times[best];
  })();

  // Hips: yaw = rest + (clip - first key) * KEEP_HIPS. The whole stance turns by `square` (first key to rest).
  const orig = hips.clone();
  const sample = (t: number) => {
    const ts = orig.times, next = ts.findIndex(x => x > t), i = Math.max(0, Math.min(ts.length - 2, (next < 0 ? ts.length : next) - 1));
    const f = ts.length < 2 ? 0 : Math.min(1, Math.max(0, (t - ts[i]) / (ts[i + 1] - ts[i])));
    return at(orig.values, i).slerp(at(orig.values, Math.min(i + 1, ts.length - 1)), f);
  };
  const restYaw = twist(hipsBone.quaternion, up), firstYaw = twist(at(orig.values, 0), up), square = restYaw - firstYaw;
  const newHips = (q: THREE.Quaternion) => {
    const y = twist(q, up);
    return yaw(restYaw + (y - firstYaw) * KEEP_HIPS - y).multiply(q);
  };
  for (let i = 0; i < hips.times.length; i++) newHips(at(orig.values, i)).toArray(hips.values, i * 4);

  // Legs: keep their pose relative to the squared stance, so the feet stay planted as the hips calm down.
  for (const child of hipsBone.children) {
    const t = find(child.name);
    if (!t || SPINE.includes(child.name)) continue;
    for (let i = 0; i < t.times.length; i++) {
      const h = sample(t.times[i]);
      const q = newHips(h).invert().multiply(yaw(square)).multiply(h).multiply(at(t.values, i));
      q.toArray(t.values, i * 4);
    }
  }

  // Spine and head: their pose at `ref` plus a share of how far the clip moves them from it.
  for (const [names, keep] of [[SPINE, KEEP_SPINE], [HEAD, KEEP_HEAD]] as const) for (const name of names) {
    const t = find(name);
    if (!t) continue;
    const r = Math.max(0, t.times.findIndex(x => x >= ref - 1e-4)), base = at(t.values, r), q0inv = base.clone().invert();
    for (let i = 0; i < t.times.length; i++) {
      const d = q0inv.clone().multiply(at(t.values, i));
      base.clone().multiply(new THREE.Quaternion().slerp(d, keep)).toArray(t.values, i * 4);
    }
  }
  // With the hips turning less the feet would slide: shift the hips to hold the point between them still.
  const pos = out.tracks.find(t => t.name === "Hips.position") as THREE.VectorKeyframeTrack | undefined, rig = scene.clone(true);
  const feet = ["LeftFoot", "RightFoot"].map(n => rig.getObjectByName(n)), hipsCopy = rig.getObjectByName("Hips");
  if (pos && feet[0] && feet[1] && hipsCopy?.parent) {
    const mixer = new THREE.AnimationMixer(rig);
    mixer.clipAction(out).play();
    const toParent = (t: number) => {
      mixer.setTime(t); rig.updateMatrixWorld(true);
      const mid = feet[0]!.getWorldPosition(new THREE.Vector3()).add(feet[1]!.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
      return hipsCopy.parent!.worldToLocal(mid);
    };
    const at0 = toParent(0), shift = Array.from(pos.times, t => {
      const d = toParent(t).sub(at0);
      return d.sub(up.clone().multiplyScalar(d.dot(up)));
    });
    shift.forEach((d, i) => { for (let k = 0; k < 3; k++) pos.values[i * 3 + k] -= d.getComponent(k); });
    mixer.stopAllAction(); mixer.uncacheRoot(rig);
  }
  return out;
}
