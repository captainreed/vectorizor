import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MOUSE } from 'three';
import { selectAxisGap, selectGridSteps, useStore } from '../../state/store';
import { PERSON_RADIUS, PLANE_IDS, STEP_MAX } from '../../state/schema';
import { PLANE_AXES, gridExtent } from '../../lib/coords';
import GridPlane from './GridPlane';
import Axes from './Axes';
import PointDots from './PointDots';
import Vectors from './Vectors';
import PersonSphere from './PersonSphere';
import { IsolateCameraRig, PerspectiveCameraRig } from './CameraRig';

export default function GraphCanvas() {
  const mode = useStore((s) => s.view.mode);
  const isolatePlane = useStore((s) => s.view.isolatePlane);
  const select = useStore((s) => s.select);
  const personOn = useStore((s) => s.modes.person);
  const personPosition = useStore((s) => s.person.position);
  // Push needs the sphere to push against; it also shows arrows in every view, not just Vectors.
  const pushOn = useStore((s) => s.modes.push) && personOn;
  const single = useStore((s) => s.modes.single);
  const gap = useStore(selectAxisGap);
  const steps = useStore(selectGridSteps);
  const extent = gridExtent(gap, steps);

  const isolate = mode === 'isolate';
  const planes = isolate ? [isolatePlane] : PLANE_IDS;
  const axes = isolate ? PLANE_AXES[isolatePlane] : (['x', 'y', 'z'] as const);

  return (
    <Canvas
      // Remount on camera type change so the default camera and controls are rebuilt cleanly.
      key={isolate ? 'ortho' : 'persp'}
      orthographic={isolate}
      camera={isolate ? { position: [0, 0, 20], zoom: 30, near: 0.1, far: 200 } : { position: [11, 8, 11], fov: 45, near: 0.1, far: 200 }}
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

      {planes.map((p) => (
        <GridPlane key={p} plane={p} gap={gap} steps={steps} />
      ))}
      <Axes axes={[...axes]} gap={gap} steps={steps} />
      <PointDots planes={[...planes]} gap={gap} single={single} />
      {(mode === 'vectors' || pushOn) && (
        <Vectors
          planes={[...planes]}
          gap={gap}
          single={single}
          push={pushOn ? { center: personPosition, radius: PERSON_RADIUS } : null}
        />
      )}
      {personOn && <PersonSphere position={personPosition} radius={PERSON_RADIUS} />}
    </Canvas>
  );
}
