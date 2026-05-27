import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

export default function Viewer() {
    const [points, setPoints] = useState<any[]>([]);

    useEffect(() => {
        const ws = new WebSocket('ws://localhost:8000/ws/stream');
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.landmarks && data.landmarks.pose) {
                setPoints(data.landmarks.pose);
            }
        };
        return () => ws.close();
    }, []);

    return (
        <div style={{ height: '100vh', width: '100vw', backgroundColor: '#111' }}>
            <Canvas camera={{ position: [0, 1, 3], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <OrbitControls />
                {points.map((pt, i) => (
                    <mesh key={i} position={[(pt.x - 0.5) * 2, -(pt.y - 0.5) * 2, -pt.z * 2]}>
                        <sphereGeometry args={[0.02, 16, 16]} />
                        <meshStandardMaterial color="#00ffaa" />
                    </mesh>
                ))}
            </Canvas>
        </div>
    );
}
