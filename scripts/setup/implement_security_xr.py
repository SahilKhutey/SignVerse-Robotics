import os
import json

base_dir = "c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")

# 1. Auth Service: JWT Engine & RBAC
write_file("services/auth-service/src/auth/jwt_validator.py", """
import jwt
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

SECRET_KEY = "SIGNVERSE_ENTERPRISE_SECURE_KEY"
ALGORITHM = "HS256"

class SecurityEngine:
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=15)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        logger.info(f"Generated JWT token for entity: {data.get('sub', 'unknown')}")
        return encoded_jwt

    @staticmethod
    def verify_token(token: str) -> Dict[str, Any]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Authentication failed: Token expired")
            raise Exception("Token expired")
        except jwt.InvalidTokenError:
            logger.warning("Authentication failed: Invalid token")
            raise Exception("Invalid token")
""")

write_file("services/auth-service/src/rbac/engine.py", """
import logging
from typing import List

logger = logging.getLogger(__name__)

# Enterprise Zero-Trust Roles
ROLE_PERMISSIONS = {
    "admin": ["*"],
    "researcher": ["read:telemetry", "execute:inference", "read:datasets"],
    "edge_node": ["write:telemetry", "execute:inference"]
}

class RBACEngine:
    @staticmethod
    def check_permission(user_role: str, required_scope: str) -> bool:
        if user_role not in ROLE_PERMISSIONS:
            logger.warning(f"Access Denied: Unknown role {user_role}")
            return False
            
        allowed_scopes = ROLE_PERMISSIONS[user_role]
        if "*" in allowed_scopes:
            return True
            
        if required_scope in allowed_scopes:
            logger.debug(f"Access Granted: Role {user_role} has scope {required_scope}")
            return True
            
        logger.warning(f"Access Denied: Role {user_role} lacks scope {required_scope}")
        return False
""")


# 2. XR Overlay App: WebXR HUD
write_file("apps/xr-overlay/package.json", json.dumps({
  "name": "xr-overlay",
  "version": "1.0.0",
  "private": True,
  "scripts": {
    "dev": "next dev",
    "build": "next build"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@react-three/fiber": "^8.16.0",
    "@react-three/xr": "^5.7.1",
    "three": "^0.160.0",
    "tailwindcss": "^3.4.3"
  }
}, indent=2))

write_file("apps/xr-overlay/src/app/globals.css", """@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: transparent; /* Essential for AR Passthrough */
}
""")

write_file("apps/xr-overlay/src/components/SpatialHUD.tsx", """'use client'
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export function SpatialHUD() {
  const textRef = useRef<any>();

  useFrame(({ clock }) => {
    if (textRef.current) {
      // Bobbing effect for HUD
      textRef.current.position.y = 1.5 + Math.sin(clock.elapsedTime * 2) * 0.05;
    }
  });

  return (
    <group position={[0, 1.5, -2]}>
      <mesh>
        <planeGeometry args={[1.5, 0.8]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <Text
        ref={textRef}
        position={[-0.6, 0.2, 0.01]}
        fontSize={0.08}
        color="#4ade80"
        anchorX="left"
        anchorY="middle"
      >
        SIGN-VERSE AR TELEMETRY
      </Text>
      <Text
        position={[-0.6, 0, 0.01]}
        fontSize={0.06}
        color="#9ca3af"
        anchorX="left"
        anchorY="middle"
      >
        Gesture Status: ANALYZING
      </Text>
      <Text
        position={[-0.6, -0.2, 0.01]}
        fontSize={0.06}
        color="#9ca3af"
        anchorX="left"
        anchorY="middle"
      >
        Robot Link: CONNECTED
      </Text>
    </group>
  );
}
""")

write_file("apps/xr-overlay/src/app/page.tsx", """'use client'
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
""")

write_file("apps/xr-overlay/src/app/layout.tsx", """import './globals.css'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
""")

print("Enterprise Security and XR Overlay modules generated.")
