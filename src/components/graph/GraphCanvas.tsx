import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MOUSE } from 'three';
import { selectAxisGap, selectGridSteps, selectIsolatePlane, useStore } from '../../state/store';
import { AXIS_IDS, PERSON_RADIUS, PLANE_IDS, STEP_MAX, type AnyAxisId } from '../../state/schema';
import {
  COMPASS_PLANE_AXES,
  activeCompassPlanes,
  resultCenter,
  axisInPlane,
  gridExtent,
  type MarkerOptions,
  type Vec3,
} from '../../lib/coords';
import GridPlane from './GridPlane';
import Axes from './Axes';
import PointDots from './PointDots';
import Vectors from './Vectors';
import PersonSphere from './PersonSphere';
import { IsolateCameraRig, PerspectiveCameraRig } from './CameraRig';

export default function GraphCanvas() {
  const mode = useStore((s) => s.view.mode);
  const isolatePlane = useStore(selectIsolatePlane);
  const select = useStore((s) => s.select);
  const personOn = useStore((s) => s.modes.person);
  const personPosition = useStore((s) => s.person.position);
  // Push needs the sphere to push against; it also shows arrows in every view, not just Vectors.
  const pushOn = useStore((s) => s.modes.push) && personOn;
  const single = useStore((s) => s.modes.single);
  const items = useStore((s) => s.items);
  const gap = useStore(selectAxisGap);
  const steps = useStore(selectGridSteps);
  const extent = gridExtent(gap, steps);

  const isolate = mode === 'isolate';
  // A compass plane (and its two diagonal axes) appears once some visible item uses one of its diagonals.
  const compassPlanes = activeCompassPlanes(items);
  const gridPlanes = isolate ? [isolatePlane] : [...PLANE_IDS, ...compassPlanes];
  // Axes drawn and whose values are shown: in isolate, only those lying in the plane.
  const axes: AnyAxisId[] = [...AXIS_IDS, ...compassPlanes.flatMap((p) => COMPASS_PLANE_AXES[p])].filter(
    (a) => !isolate || axisInPlane(a, isolatePlane),
  );
  const markerOptions: MarkerOptions = { axes, single, gap };

  // Result mode: the sphere sits where the dots' spring pulls balance (their average position).
  const resultOn = useStore((s) => s.modes.result) && personOn;
  const sphereCenter: Vec3 = (resultOn && resultCenter(items, { single, gap })) || personPosition;
  const sphere = personOn ? { center: sphereCenter, radius: PERSON_RADIUS } : null;

  return (
    <Canvas
      // Remount on camera type change so the default camera and controls are rebuilt cleanly.
      key={isolate ? 'ortho' : 'persp'}
      orthographic={isolate}
      camera={isolate ? { position: [0, 0, 20], zoom: 30, near: 0.1, far: 500 } : { position: [14, 8, 7], fov: 45, near: 0.1, far: 500 }}
      dpr={[1, 2]}
      onPointerMissed={() => select(null)}
      data-testid="graph-canvas"
    >
      <color attach="background" args={['#fbfbfd']} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} />

      {isolate ? (
        <OrbitControls
          makeDefault
          enableRotate={false}
          enableDamping={false}
          screenSpacePanning
          mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
          minZoom={4}
          maxZoom={300}
        />
      ) : (
        <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={4} maxDistance={(40 * extent) / STEP_MAX} />
      )}
      {isolate ? <IsolateCameraRig plane={isolatePlane} extent={extent} /> : <PerspectiveCameraRig extent={extent} />}

      {gridPlanes.map((p) => (
        <GridPlane key={p} plane={p} gap={gap} steps={steps} />
      ))}
      <Axes axes={axes} gap={gap} steps={steps} />
      {/* In Push mode the arrows stand in for the points, so their dots are hidden. */}
      {!pushOn && <PointDots options={markerOptions} />}
      {(mode === 'vectors' || pushOn) && (
        <Vectors
          options={markerOptions}
          sphere={sphere}
          push={pushOn}
        />
      )}
      {sphere && <PersonSphere position={sphere.center} radius={sphere.radius} />}
    </Canvas>
  );
}
