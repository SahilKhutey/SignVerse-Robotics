'use client'
import { Canvas } from '@react-three/fiber';
import { VRButton, XR, Controllers, Hands } from '@react-three/xr';
import { SpatialHUD } from '../components/SpatialHUD';

export default function XROverlayPage() {
  return (
    <main className="w-screen h-screen">
      <div className="absolute top-4 left-4 z-10">
        <VRButton className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500" />
      </div>
      
      <Canvas>
        <XR>
          <ambientLight intensity={1} />
          <Controllers />
          <Hands />
          <SpatialHUD />
        </XR>
      </Canvas>
    </main>
  );
}
