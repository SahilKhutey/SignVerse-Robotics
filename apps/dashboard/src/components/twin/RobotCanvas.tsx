import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import RobotArm from './RobotArm';
import PoseSkeleton from './PoseSkeleton';
import TwinControls from './TwinControls';
import { useTelemetryStore } from '../../store/telemetry';

/** DOM overlay for joint angles - outside the WebGL canvas so Playwright can query it. */
function JointAngleReadouts({ show }: { show: boolean }) {
  const frame = useTelemetryStore((state) => state.frame);
  const isTwinFrozen = useTelemetryStore((state) => state.isTwinFrozen);
  const [frozenAngles, setFrozenAngles] = React.useState<number[] | null>(null);
  const frameRef = React.useRef(frame);

  React.useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  React.useEffect(() => {
    if (isTwinFrozen) {
      if (frameRef.current?.jointAngles) {
        setFrozenAngles([...frameRef.current.jointAngles]);
      }
    } else {
      setFrozenAngles(null);
    }
  }, [isTwinFrozen]);

  if (!show || !frame?.jointAngles) return null;

  const angles = isTwinFrozen && frozenAngles ? frozenAngles : frame.jointAngles;

  return (
    <div
      id="joint-angle-dom-readouts"
      className="absolute top-12 left-3 flex flex-col gap-0.5 pointer-events-none z-20"
      aria-label="Joint angle readouts"
    >
      {angles.map((angleDeg, i) => (
        <div
          key={i}
          id={`joint-readout-${i}`}
          className="font-mono text-[9px] font-bold bg-black/70 px-1.5 py-0.5 rounded text-accent-cyan border border-accent-cyan/15"
        >
          {`J${i}: ${Math.round(angleDeg)}°`}
        </div>
      ))}
    </div>
  );
}

// Preset view definitions
const CAMERA_PRESETS = {
  Front: {
    pos: new THREE.Vector3(0, 1.2, 3.2),
    target: new THREE.Vector3(0, 0.4, 0)
  },
  Side: {
    pos: new THREE.Vector3(3.2, 0.8, 0),
    target: new THREE.Vector3(0, 0.4, 0)
  },
  Top: {
    pos: new THREE.Vector3(0, 3.5, 0.01), // Slight Z offset to prevent Gimbal lock
    target: new THREE.Vector3(0, 0.4, 0)
  }
};

interface CameraControllerProps {
  preset: 'Front' | 'Side' | 'Top' | 'Free';
  controlsRef: React.RefObject<any>;
  isProgrammaticUpdate: React.MutableRefObject<boolean>;
  onTransitionEnd: () => void;
}

function CameraController({
  preset,
  controlsRef,
  isProgrammaticUpdate,
  onTransitionEnd
}: CameraControllerProps) {
  const { camera } = useThree();

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).camera = camera;
    }
  }, [camera]);
  const isAnimating = useRef(false);
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (preset !== 'Free') {
      const config = CAMERA_PRESETS[preset];
      if (config) {
        targetPos.current = config.pos.clone();
        targetLook.current = config.target.clone();
        isAnimating.current = true;
        
        // Disable control inputs during transition so they don't fight
        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }
      }
    } else {
      isAnimating.current = false;
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    }
  }, [preset, controlsRef]);

  useFrame(() => {
    if (!isAnimating.current || !targetPos.current || !targetLook.current) return;

    // Interpolate camera position towards the target position
    camera.position.lerp(targetPos.current, 0.08);

    // Interpolate OrbitControls target
    if (controlsRef.current) {
      const currentTarget = controlsRef.current.target;
      currentTarget.lerp(targetLook.current, 0.08);
      
      // Update controls and mark it as programmatic so we don't trigger 'Free' mode automatically
      isProgrammaticUpdate.current = true;
      controlsRef.current.update();
      isProgrammaticUpdate.current = false;
    }

    // Stop animating when camera is extremely close to the preset destination
    if (camera.position.distanceTo(targetPos.current) < 0.01) {
      isAnimating.current = false;
      // Re-enable controls if we reached the preset (but we keep the visual preset highlighted)
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      onTransitionEnd();
    }
  });

  return null;
}

export default function RobotCanvas({
  customJointAngles,
  onShareClick
}: {
  customJointAngles?: number[];
  onShareClick?: () => void;
}) {
  const [preset, setPreset] = useState<'Front' | 'Side' | 'Top' | 'Free'>('Free');
  const [showReadouts, setShowReadouts] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const controlsRef = useRef<any>(null);
  const isProgrammaticUpdate = useRef(false);
  const isRecording = useTelemetryStore((state) => state.isRecording);
  const activeComparisonSessionId = useTelemetryStore((state) => state.activeComparisonSessionId);
  const comparisonFrames = useTelemetryStore((state) => state.comparisonFrames);
  const hasComparison = !!activeComparisonSessionId && comparisonFrames.length > 0;

  if (typeof window !== 'undefined') {
    (window as any).__robotCanvasRenderCount = ((window as any).__robotCanvasRenderCount || 0) + 1;
  }

  return (
    <div className={`relative flex-1 rounded-xl overflow-hidden bg-gradient-to-b from-[#10141f] to-[#07080a] aspect-video min-h-[300px] md:min-h-[400px] xl:min-h-[450px] border transition-all duration-300 shadow-2xl ${
      isRecording 
        ? 'border-accent-red/60 shadow-[0_0_15px_rgba(255,51,102,0.15)] animate-pulse' 
        : 'border-white/5'
    }`}>
      {/* 3D R3F Canvas */}
      <Canvas 
        shadows 
        camera={{ position: [2.5, 2.5, 3.5], fov: 45 }}
        role="img"
        aria-label="3D Robot Digital Twin Viewer. Displays real-time physical joints configuration state."
      >
        <color attach="background" args={['#08090c']} />
        
        {/* Lights */}
        <ambientLight intensity={0.4} />
        <directionalLight
          castShadow
          position={[5, 8, 5]}
          intensity={1.0}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0001}
        />
        
        {/* City Environment Map for Realistic metallic surface reflections */}
        <Environment preset="city" />

        {/* Floor Grid */}
        <Grid
          position={[0, -0.6, 0]}
          args={[10.5, 10.5]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#1e222b"
          sectionSize={2.5}
          sectionThickness={1}
          sectionColor="#00f0ff"
          fadeDistance={10}
          fadeStrength={1}
          infiniteGrid
        />

        {/* Robot Arm Mesh component */}
        {hasComparison ? (
          <>
            <RobotArm showReadouts={showReadouts} position={[-0.75, -0.6, 0]} customJointAngles={customJointAngles} />
            <RobotArm showReadouts={false} isComparisonArm={true} position={[0.75, -0.6, 0]} />
          </>
        ) : (
          <RobotArm showReadouts={showReadouts} position={[0, -0.6, 0]} customJointAngles={customJointAngles} />
        )}

        {/* MediaPipe Pose Skeleton component */}
        <PoseSkeleton showSkeleton={showSkeleton} />

        {/* Interpolated view controls agent */}
        <CameraController 
          preset={preset} 
          controlsRef={controlsRef} 
          isProgrammaticUpdate={isProgrammaticUpdate}
          onTransitionEnd={() => {}}
        />

        {/* Orbit Camera Controls */}
        <OrbitControls 
          ref={controlsRef}
          enableDamping 
          dampingFactor={0.05} 
          maxPolarAngle={Math.PI / 2 - 0.05} 
          minDistance={1.2}
          maxDistance={8}
          onChange={() => {
            // When user changes position manually, fall back to "Free" camera preset
            if (!isProgrammaticUpdate.current && preset !== 'Free' && controlsRef.current && controlsRef.current.enabled) {
              setPreset('Free');
            }
          }}
        />
      </Canvas>

      {/* Glassmorphic overlay HUD dashboard panels */}
      <TwinControls
        currentPreset={preset}
        setPreset={setPreset}
        showReadouts={showReadouts}
        setShowReadouts={setShowReadouts}
        showSkeleton={showSkeleton}
        setShowSkeleton={setShowSkeleton}
        onShareClick={onShareClick}
      />

      {/* DOM joint angle readouts — outside WebGL canvas for Playwright/accessibility */}
      <JointAngleReadouts show={showReadouts} />
    </div>
  );
}
