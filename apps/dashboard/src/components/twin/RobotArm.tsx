import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTelemetryStore } from '../../store/telemetry';
import { useCommandStore } from '../../store/command';

interface RobotArmProps {
  showReadouts: boolean;
  isComparisonArm?: boolean;
  position?: [number, number, number];
  customJointAngles?: number[];
}

export default function RobotArm({ 
  showReadouts, 
  isComparisonArm = false, 
  position,
  customJointAngles
}: RobotArmProps) {
  // References for nested joints
  const joint0Ref = useRef<THREE.Group>(null);
  const joint1Ref = useRef<THREE.Group>(null);
  const joint2Ref = useRef<THREE.Group>(null);
  const joint3Ref = useRef<THREE.Group>(null);
  const joint4Ref = useRef<THREE.Group>(null);
  const joint5Ref = useRef<THREE.Group>(null);
  const joint6Ref = useRef<THREE.Group>(null);

  // References for joint mesh materials to update colors on E-Stop / Command pulses / Heatmaps
  const jointMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  // References for structural link mesh materials
  const linkMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  // References for joint label HTML elements to update readouts without React render cycles
  const labelRefs = useRef<(HTMLDivElement | null)[]>(new Array(7).fill(null));

  // Joint angle states (current for lerp, target for incoming stream)
  const anglesRef = useRef({
    current: new Array(7).fill(0),
    target: new Array(7).fill(0),
  });

  // Reference to hold velocity/frequency statistics for heatmap & anomaly overlays
  const statsRef = useRef<{
    meanVel: number[];
    stdVel: number[];
    maxCount: number[];
    bins: { min: number; max: number; count: number }[][];
  }>({
    meanVel: new Array(7).fill(0),
    stdVel: new Array(7).fill(0),
    maxCount: new Array(7).fill(1),
    bins: Array.from({ length: 7 }, () => [])
  });

  // Select appropriate frames for stats calculations
  const activeFrames = useTelemetryStore((state) => {
    if (isComparisonArm) {
      return state.comparisonFrames;
    }
    return state.isReplayMode ? state.replayFrames : state.recordedFrames;
  });

  // Re-calculate statistics whenever frames change
  useEffect(() => {
    if (activeFrames.length < 2) return;

    const numJoints = 7;
    const velocities: number[][] = Array.from({ length: numJoints }, () => []);
    const angles: number[][] = Array.from({ length: numJoints }, () => []);

    for (let k = 0; k < activeFrames.length; k++) {
      const f = activeFrames[k];
      if (!f || !f.jointAngles) continue;
      for (let j = 0; j < numJoints; j++) {
        angles[j].push(f.jointAngles[j] || 0);
      }

      if (k > 0) {
        const fPrev = activeFrames[k - 1];
        if (fPrev && fPrev.jointAngles) {
          const dt = (f.timestampMs - fPrev.timestampMs) / 1000 || 0.016;
          for (let j = 0; j < numJoints; j++) {
            const v = Math.abs((f.jointAngles[j] || 0) - (fPrev.jointAngles[j] || 0)) / dt;
            velocities[j].push(v);
          }
        }
      }
    }

    // Calculate mean and standard deviation of velocities
    const meanVel = new Array(numJoints).fill(0);
    const stdVel = new Array(numJoints).fill(0);
    for (let j = 0; j < numJoints; j++) {
      const vels = velocities[j];
      if (vels.length > 0) {
        const sum = vels.reduce((a, b) => a + b, 0);
        meanVel[j] = sum / vels.length;
        const sqDiffSum = vels.reduce((a, b) => a + Math.pow(b - meanVel[j], 2), 0);
        stdVel[j] = Math.sqrt(sqDiffSum / vels.length);
      }
    }

    // Calculate joint angle histogram bins for ROM heatmap
    const maxCount = new Array(numJoints).fill(0);
    const bins: { min: number; max: number; count: number }[][] = [];

    for (let j = 0; j < numJoints; j++) {
      const jAngles = angles[j];
      if (jAngles.length === 0) {
        bins.push([]);
        continue;
      }
      const minAngle = Math.min(...jAngles);
      const maxAngle = Math.max(...jAngles);
      const range = maxAngle - minAngle;

      const jBins = Array.from({ length: 10 }, (_, bIdx) => {
        const binWidth = (range / 10) || 1.0;
        return {
          min: minAngle + bIdx * binWidth,
          max: minAngle + (bIdx + 1) * binWidth,
          count: 0
        };
      });

      for (const a of jAngles) {
        let placed = false;
        for (let b = 0; b < 10; b++) {
          if (a >= jBins[b].min && a <= jBins[b].max) {
            jBins[b].count++;
            placed = true;
            break;
          }
        }
        if (!placed && jBins[9]) {
          jBins[9].count++;
        }
      }

      const counts = jBins.map((b) => b.count);
      maxCount[j] = Math.max(...counts, 1);
      bins.push(jBins);
    }

    statsRef.current = {
      meanVel,
      stdVel,
      maxCount,
      bins
    };
  }, [activeFrames]);

  useFrame(() => {
    const { 
      getRawFrame, 
      isReplayMode, 
      replayFrames, 
      comparisonFrames,
      playbackIndex, 
      isEstopTriggered, 
      isTwinFrozen,
      heatmapActive,
      anomalyActive
    } = useTelemetryStore.getState();

    // 1. Fetch current frame based on comparison vs primary replay vs raw live
    let frame = null;
    let prevFrame = null;

    if (isComparisonArm) {
      if (comparisonFrames.length > 0) {
        const idx = Math.min(playbackIndex, comparisonFrames.length - 1);
        frame = comparisonFrames[idx];
        if (idx > 0) prevFrame = comparisonFrames[idx - 1];
      }
    } else if (isReplayMode) {
      if (replayFrames.length > 0) {
        const idx = Math.min(playbackIndex, replayFrames.length - 1);
        frame = replayFrames[idx];
        if (idx > 0) prevFrame = replayFrames[idx - 1];
      }
    } else {
      frame = getRawFrame();
    }

    const hasData = !!frame;

    // 2. Set target angles
    if (customJointAngles && !isTwinFrozen) {
      for (let i = 0; i < 7; i++) {
        const angleDeg = customJointAngles[i] ?? 0;
        anglesRef.current.target[i] = angleDeg * (Math.PI / 180);
      }
    } else if (frame && frame.jointAngles && !isTwinFrozen) {
      for (let i = 0; i < 7; i++) {
        const angleDeg = frame.jointAngles[i] ?? 0;
        anglesRef.current.target[i] = angleDeg * (Math.PI / 180);
      }
    } else if (!frame) {
      for (let i = 0; i < 7; i++) {
        anglesRef.current.target[i] = 0;
      }
    }

    // 3. Smoothly interpolate (lerp) towards target angles
    for (let i = 0; i < 7; i++) {
      anglesRef.current.current[i] = THREE.MathUtils.lerp(
        anglesRef.current.current[i],
        anglesRef.current.target[i],
        0.15
      );
    }

    // 4. Write rotations directly on nested joint groups
    if (joint0Ref.current) joint0Ref.current.rotation.y = anglesRef.current.current[0];
    if (joint1Ref.current) joint1Ref.current.rotation.z = anglesRef.current.current[1];
    if (joint2Ref.current) joint2Ref.current.rotation.y = anglesRef.current.current[2];
    if (joint3Ref.current) joint3Ref.current.rotation.z = anglesRef.current.current[3];
    if (joint4Ref.current) joint4Ref.current.rotation.y = anglesRef.current.current[4];
    if (joint5Ref.current) joint5Ref.current.rotation.z = anglesRef.current.current[5];
    if (joint6Ref.current) joint6Ref.current.rotation.y = anglesRef.current.current[6];

    // 5. Update HTML readouts imperatively via DOM element textContent
    for (let i = 0; i < 7; i++) {
      const el = labelRefs.current[i];
      if (el) {
        el.style.display = showReadouts && hasData ? 'block' : 'none';
        if (showReadouts && frame && frame.jointAngles) {
          const angleDeg = Math.round(anglesRef.current.current[i] * (180 / Math.PI));
          el.textContent = `J${i}: ${angleDeg}°`;
        }
      }
    }

    // 6. Visual styling feedback loop
    const { highlightedJoints, highlightTimestamp } = useCommandStore.getState();
    const elapsed = highlightTimestamp ? (Date.now() - highlightTimestamp) / 1000 : 999;
    const isPulsing = elapsed < 2.0;

    const f = frame;
    const pf = prevFrame;

    jointMaterialsRef.current.forEach((mat, i) => {
      if (!mat) return;

      if (isComparisonArm) {
        // Translucent purple overlay ghost arm
        mat.color.setStyle('#b7791f'); // gold/purple glow target
        mat.color.setHSL(0.77, 0.7, 0.5); // Purple HSL
        mat.emissive.setHSL(0.77, 0.7, 0.5);
        mat.emissiveIntensity = 0.5;
        mat.transparent = true;
        mat.opacity = 0.45;
      } else if (!f) {
        // Ghost pose: transparent grey, no emissive glow
        mat.color.setStyle('#4a5568');
        mat.emissive.setStyle('#000000');
        mat.emissiveIntensity = 0;
        mat.transparent = true;
        mat.opacity = 0.35;
      } else {
        mat.transparent = false;
        mat.opacity = 1.0;

        // Check for 3-sigma velocity anomalies
        let isAnomaly = false;
        if (anomalyActive && f && pf && f.jointAngles && pf.jointAngles) {
          const dt = (f.timestampMs - pf.timestampMs) / 1000 || 0.016;
          const v = Math.abs((f.jointAngles[i] || 0) - (pf.jointAngles[i] || 0)) / dt;
          const { meanVel, stdVel } = statsRef.current;
          if (stdVel[i] > 0.1 && v > meanVel[i] + 3 * stdRefFactor(stdVel[i]) && v > 5.0) {
            isAnomaly = true;
          }
        }

        if (isEstopTriggered) {
          const pulse = 1.8 + Math.sin(Date.now() * 0.015) * 0.7;
          mat.color.setStyle('#ff3366');
          mat.emissive.setStyle('#ff3366');
          mat.emissiveIntensity = pulse;
        } else if (isAnomaly) {
          // Flagged velocity anomaly joint: flashing critical red
          const pulse = 2.0 + Math.sin(Date.now() * 0.02) * 1.0;
          mat.color.setStyle('#ff0033');
          mat.emissive.setStyle('#ff0033');
          mat.emissiveIntensity = pulse;
        } else if (heatmapActive && activeFrames.length > 0 && f.jointAngles) {
          // Heatmap: color by angle visitation frequency (Blue = cold, Red = hot)
          const angleDeg = f.jointAngles[i] || 0;
          const { bins, maxCount } = statsRef.current;
          let count = 0;
          const jBins = bins[i] || [];
          for (let b = 0; b < jBins.length; b++) {
            if (angleDeg >= jBins[b].min && angleDeg <= jBins[b].max) {
              count = jBins[b].count;
              break;
            }
          }
          const ratio = Math.min(count / (maxCount[i] || 1), 1.0);
          const hue = (1.0 - ratio) * 240; // 240 (blue) -> 0 (red)
          mat.color.setHSL(hue / 360, 1.0, 0.45);
          mat.emissive.setHSL(hue / 360, 1.0, 0.45);
          mat.emissiveIntensity = 0.8;
        } else if (isPulsing && highlightedJoints && highlightedJoints.includes(i)) {
          const pulse = 1.4 + Math.sin(elapsed * Math.PI * 3.5) * 0.8;
          mat.color.setStyle('#ffaa00');
          mat.emissive.setStyle('#ffaa00');
          mat.emissiveIntensity = pulse;
        } else {
          // default glowing cyan
          mat.color.setStyle('#00f0ff');
          mat.emissive.setStyle('#00f0ff');
          mat.emissiveIntensity = 0.8;
        }
      }
    });

    // Helper multiplier to scale std calculations
    function stdRefFactor(std: number) {
      return std;
    }

    // Apply link/structural material styles
    linkMaterialsRef.current.forEach((mat) => {
      if (!mat) return;
      if (isComparisonArm) {
        mat.color.setStyle('#553c9a'); // violet link
        mat.transparent = true;
        mat.opacity = 0.3;
      } else if (!hasData) {
        mat.transparent = true;
        mat.opacity = 0.2;
      } else {
        mat.transparent = false;
        mat.opacity = 1.0;
      }
    });
  });

  const registerJointMaterial = (el: THREE.MeshStandardMaterial | null) => {
    if (el && !jointMaterialsRef.current.includes(el)) {
      jointMaterialsRef.current.push(el);
    }
  };

  const registerLinkMaterial = (el: THREE.MeshStandardMaterial | null) => {
    if (el && !linkMaterialsRef.current.includes(el)) {
      linkMaterialsRef.current.push(el);
    }
  };

  const JointLabel = ({ index }: { index: number }) => (
    <Html distanceFactor={3.5} position={[0.15, 0.15, 0]}>
      <div 
        ref={(el) => { labelRefs.current[index] = el; }}
        className="bg-[#07080a]/85 border border-white/10 px-2 py-0.5 rounded font-mono text-[8px] font-bold text-accent-cyan shadow-[0_0_8px_rgba(0,240,255,0.1)] select-none pointer-events-none"
        style={{ display: 'none' }}
      >
        J{index}: 0°
      </div>
    </Html>
  );

  return (
    <group position={position || [0, -0.6, 0]}>
      {/* Base Pedestal (Static) */}
      <mesh castShadow receiveShadow position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.3, 0.35, 0.15, 32]} />
        <meshStandardMaterial ref={registerLinkMaterial} color="#1a202c" roughness={0.6} metalness={0.7} />
      </mesh>

      {/* Joint 0 Group: Base Yaw (rotates around Y) */}
      <group ref={joint0Ref} position={[0, 0.15, 0]}>
        <mesh castShadow position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial 
            ref={registerJointMaterial}
            color="#00f0ff" 
            roughness={0.1} 
            emissive="#00f0ff" 
            emissiveIntensity={0.8} 
          />
          <JointLabel index={0} />
        </mesh>
        {/* Link 1 (Base Cylinder) */}
        <mesh castShadow position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.3, 16]} />
          <meshStandardMaterial ref={registerLinkMaterial} color="#2d3748" roughness={0.4} metalness={0.8} />
        </mesh>

        {/* Joint 1 Group: Shoulder Pitch (rotates around Z) */}
        <group ref={joint1Ref} position={[0, 0.35, 0]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.065, 0.065, 0.15, 16]} />
            <meshStandardMaterial 
              ref={registerJointMaterial}
              color="#00f0ff" 
              roughness={0.1} 
              emissive="#00f0ff" 
              emissiveIntensity={0.8} 
            />
            <JointLabel index={1} />
          </mesh>
          {/* Link 2 (Shoulder segment) */}
          <mesh castShadow position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.3, 16]} />
            <meshStandardMaterial ref={registerLinkMaterial} color="#4a5568" roughness={0.4} metalness={0.8} />
          </mesh>

          {/* Joint 2 Group: Upperarm Roll (rotates around Y) */}
          <group ref={joint2Ref} position={[0, 0.35, 0]}>
            <mesh castShadow position={[0, 0.025, 0]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial 
                ref={registerJointMaterial}
                color="#00f0ff" 
                roughness={0.1} 
                emissive="#00f0ff" 
                emissiveIntensity={0.8} 
              />
              <JointLabel index={2} />
            </mesh>
            {/* Link 3 (Upperarm segment) */}
            <mesh castShadow position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.25, 16]} />
              <meshStandardMaterial ref={registerLinkMaterial} color="#2d3748" roughness={0.4} metalness={0.8} />
            </mesh>

            {/* Joint 3 Group: Elbow Pitch (rotates around Z) */}
            <group ref={joint3Ref} position={[0, 0.275, 0]}>
              <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.12, 16]} />
                <meshStandardMaterial 
                  ref={registerJointMaterial}
                  color="#00f0ff" 
                  roughness={0.1} 
                  emissive="#00f0ff" 
                  emissiveIntensity={0.8} 
                />
                <JointLabel index={3} />
              </mesh>
              {/* Link 4 (Forearm segment) */}
              <mesh castShadow position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.038, 0.038, 0.25, 16]} />
                <meshStandardMaterial ref={registerLinkMaterial} color="#4a5568" roughness={0.4} metalness={0.8} />
              </mesh>

              {/* Joint 4 Group: Forearm Roll (rotates around Y) */}
              <group ref={joint4Ref} position={[0, 0.275, 0]}>
                <mesh castShadow position={[0, 0.02, 0]}>
                  <sphereGeometry args={[0.045, 16, 16]} />
                  <meshStandardMaterial 
                    ref={registerJointMaterial}
                    color="#00f0ff" 
                    roughness={0.1} 
                    emissive="#00f0ff" 
                    emissiveIntensity={0.8} 
                  />
                  <JointLabel index={4} />
                </mesh>
                {/* Link 5 (Wrist link) */}
                <mesh castShadow position={[0, 0.1, 0]}>
                  <cylinderGeometry args={[0.032, 0.032, 0.16, 16]} />
                  <meshStandardMaterial ref={registerLinkMaterial} color="#2d3748" roughness={0.4} metalness={0.8} />
                </mesh>

                {/* Joint 5 Group: Wrist Pitch (rotates around Z) */}
                <group ref={joint5Ref} position={[0, 0.18, 0]}>
                  <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.036, 0.036, 0.08, 16]} />
                    <meshStandardMaterial 
                      ref={registerJointMaterial}
                      color="#00f0ff" 
                      roughness={0.1} 
                      emissive="#00f0ff" 
                      emissiveIntensity={0.8} 
                    />
                    <JointLabel index={5} />
                  </mesh>
                  {/* Link 6 (Hand segment) */}
                  <mesh castShadow position={[0, 0.1, 0]}>
                    <cylinderGeometry args={[0.026, 0.026, 0.15, 16]} />
                    <meshStandardMaterial ref={registerLinkMaterial} color="#4a5568" roughness={0.4} metalness={0.8} />
                  </mesh>

                  {/* Joint 6 Group: Wrist Roll (rotates around Y) */}
                  <group ref={joint6Ref} position={[0, 0.175, 0]}>
                    <mesh castShadow position={[0, 0.015, 0]}>
                      <sphereGeometry args={[0.032, 16, 16]} />
                      <meshStandardMaterial 
                        ref={registerJointMaterial}
                        color="#00f0ff" 
                        roughness={0.1} 
                        emissive="#00f0ff" 
                        emissiveIntensity={0.8} 
                      />
                      <JointLabel index={6} />
                    </mesh>

                    {/* Gripper Base Cylinder */}
                    <mesh castShadow position={[0, 0.05, 0]}>
                      <cylinderGeometry args={[0.038, 0.038, 0.04, 16]} />
                      <meshStandardMaterial ref={registerLinkMaterial} color="#1a202c" roughness={0.5} />
                    </mesh>

                    {/* Gripper Finger Claws (Procedural Claws) */}
                    <group position={[0, 0.07, 0]}>
                      {<mesh castShadow position={[-0.022, 0.04, 0]}>
                        <boxGeometry args={[0.006, 0.08, 0.012]} />
                        <meshStandardMaterial ref={registerLinkMaterial} color="#718096" roughness={0.4} />
                      </mesh>}
                      {<mesh castShadow position={[0.022, 0.04, 0]}>
                        <boxGeometry args={[0.006, 0.08, 0.012]} />
                        <meshStandardMaterial ref={registerLinkMaterial} color="#718096" roughness={0.4} />
                      </mesh>}
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
