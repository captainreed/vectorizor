import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../../state/store';
import type { PlaneId, Preset } from '../../state/schema';
import type { Vec3 } from '../../lib/coords';

const PRESET_POSES: Record<Preset, Vec3> = {
  front: [0, 0, 17],
  top: [0, 17, 0.001],
  side: [17, 0, 0],
  iso: [11, 8, 11],
};

const ANIM_MS = 400;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Animates the perspective camera to presets and handles "Reset view". */
export function PerspectiveCameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const mode = useStore((s) => s.view.mode);
  const preset = useStore((s) => s.view.preset);
  const nonce = useStore((s) => s.ui.cameraNonce);
  const anim = useRef<{ from: Vector3; fromTarget: Vector3; to: Vector3; start: number } | null>(null);
  const first = useRef(true);

  useEffect(() => {
    const pose = mode === 'preset' ? PRESET_POSES[preset] : PRESET_POSES.iso;
    const to = new Vector3(...pose);
    if (first.current) {
      // Restore the saved preset instantly on load, no animation.
      first.current = false;
      if (mode === 'preset') camera.position.copy(to);
      return;
    }
    anim.current = {
      from: camera.position.clone(),
      fromTarget: controls?.target.clone() ?? new Vector3(),
      to,
      start: performance.now(),
    };
    // Re-run whenever the user picks a preset (even the same one) or presses reset.
  }, [nonce, mode === 'preset' ? preset : null]);

  useFrame(() => {
    const a = anim.current;
    if (!a) return;
    const t = Math.min(1, (performance.now() - a.start) / ANIM_MS);
    const k = ease(t);
    camera.position.lerpVectors(a.from, a.to, k);
    if (controls) {
      controls.target.lerpVectors(a.fromTarget, new Vector3(), k);
      controls.update();
    } else {
      camera.lookAt(0, 0, 0);
    }
    if (t >= 1) anim.current = null;
  });

  return null;
}

const ISO_POSE: Record<PlaneId, { position: Vec3; up: Vec3 }> = {
  xy: { position: [0, 0, 20], up: [0, 1, 0] },
  xz: { position: [0, -20, 0], up: [0, 0, 1] }, // X right, Z up
  yz: { position: [20, 0, 0], up: [0, 0, 1] }, // Y right, Z up
};

/** Points the orthographic camera straight at the isolated plane and fits it to the viewport. */
export function IsolateCameraRig({ plane }: { plane: PlaneId }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);
  const nonce = useStore((s) => s.ui.cameraNonce);

  useEffect(() => {
    const pose = ISO_POSE[plane];
    camera.up.set(...pose.up);
    camera.position.set(...pose.position);
    camera.zoom = Math.max(10, Math.min(size.width, size.height) / 14);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
    // Fit only on plane change / reset / first mount, not on every resize.
  }, [plane, nonce, controls, camera]);

  return null;
}
