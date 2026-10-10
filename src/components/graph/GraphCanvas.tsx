import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MOUSE } from 'three';
import { selectAxisGap, selectGridSteps, selectIsolatePlane, useStore } from '../../state/store';
import {
  AXIS_IDS,
  DIAGONAL_IDS,
  ISOLATE_PLANES,
  PERSON_RADIUS,
  PLANE_IDS,
  STEP_MAX,
  type AnyAxisId,
  type PlaneId,
} from '../../state/schema';
import { PLANE_BASIS, axisInPlane, gridExtent, type MarkerOptions } from '../../lib/coords';
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
  const compass = useStore((s) => s.modes.compass);
  const gap = useStore(selectAxisGap);
  const steps = useStore(selectGridSteps);
  const extent = gridExtent(gap, steps);

  const isolate = mode === 'isolate';
  // Grids drawn: the isolated plane, or all planes (plus the two 45° Compass planes).
  const gridPlanes = isolate ? [isolatePlane] : compass ? ISOLATE_PLANES : PLANE_IDS;
  // Planes whose 2D points are shown; Compass planes hold no points of their own.
  const pointPlanes: readonly PlaneId[] = isolate
    ? PLANE_IDS.filter((p) => p === isolatePlane)
    : PLANE_IDS;
  // Diagonals shown: all of them in 3D, or only those lying in the isolated plane.
  const diagonals = compass ? DIAGONAL_IDS.filter((d) => !isolate || axisInPlane(d, isolatePlane)) : [];
  const axes: AnyAxisId[] = [
    ...(isolate ? PLANE_BASIS[isolatePlane] : AXIS_IDS),
    ...diagonals.filter((d) => !isolate || !PLANE_BASIS[isolatePlane].includes(d)),
  ];
  const markerOptions: MarkerOptions = { planes: pointPlanes, diagonals, single, compass, gap };

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
      <PointDots options={markerOptions} />
      {(mode === 'vectors' || pushOn) && (
        <Vectors
          options={markerOptions}
          push={pushOn ? { center: personPosition, radius: PERSON_RADIUS } : null}
        />
      )}
      {personOn && <PersonSphere position={personPosition} radius={PERSON_RADIUS} />}
    </Canvas>
  );
}
