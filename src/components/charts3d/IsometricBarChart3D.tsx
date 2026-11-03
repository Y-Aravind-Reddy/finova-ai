import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, ContactShadows, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

interface BarData {
  category: string;
  completed: number;
  target: number;
  percentage: number;
}

interface IsometricBarChart3DProps {
  data: BarData[];
  title?: string;
}

const DualBar: React.FC<{
  position: [number, number, number];
  completed: number;
  target: number;
  maxVal: number;
  label: string;
  percentage: number;
}> = ({ position, completed, target, maxVal, label, percentage }) => {
  const [hovered, setHovered] = useState(false);
  const compHeight = (completed / maxVal) * 5;
  const targetHeight = (target / maxVal) * 5;

  return (
    <group position={position} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Target Bar (Bronze) */}
      <mesh position={[0, targetHeight / 2, -0.4]}>
        <boxGeometry args={[0.8, targetHeight, 0.4]} />
        <meshStandardMaterial color="#6B3E00" metalness={0.6} roughness={0.4} transparent opacity={0.5} />
      </mesh>

      {/* Completed Bar (Gold) */}
      <mesh position={[0, compHeight / 2, 0]}>
        <boxGeometry args={[0.8, compHeight, 0.4]} />
        <meshStandardMaterial
          color="#D4A017"
          metalness={0.8}
          roughness={0.2}
          emissive="#D4A017"
          emissiveIntensity={hovered ? 0.4 : 0.1}
        />
      </mesh>

      {/* Category Label */}
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0.8]}>
        <Text
          fontSize={0.2}
          color="#9CA3AF"
          maxWidth={1.5}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </group>

      {hovered && (
        <Html position={[0, Math.max(compHeight, targetHeight) + 0.5, 0]}>
          <div className="bg-[#121212]/95 border border-[#D4A017] p-2 rounded shadow-2xl text-[10px] min-w-[140px] pointer-events-none backdrop-blur-sm">
            <p className="font-bold text-[#D4A017] uppercase mb-1">{label}</p>
            <div className="space-y-1 text-white">
              <div className="flex justify-between">
                <span>Completed:</span>
                <span className="font-mono">{completed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Target:</span>
                <span className="font-mono text-[#9CA3AF]">{target.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-1 text-[#E6C78B]">
                <span>SLA:</span>
                <span className="font-mono font-bold">{percentage}%</span>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

export const IsometricBarChart3D: React.FC<IsometricBarChart3DProps> = ({ data, title }) => {
  const maxVal = useMemo(() => Math.max(...data.map((d) => Math.max(d.completed, d.target)), 1), [data]);

  return (
    <div className="w-full h-full min-h-[350px] relative bg-[#1E1E1E] rounded-xl border border-[#D4A017]/20 shadow-2xl overflow-hidden">
      {title && (
        <div className="absolute top-4 left-5 z-10">
          <h3 className="font-cinzel text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
            {title}
          </h3>
        </div>
      )}

      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[6, 6, 10]} fov={35} />
        <OrbitControls 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2.2} 
          minDistance={5} 
          maxDistance={15}
          makeDefault
        />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
        <Environment preset="city" />

        <group position={[-((data.length - 1) * 2) / 2, -2, 0]}>
          {data.map((d, i) => (
            <DualBar
              key={i}
              position={[i * 2, 0, 0]}
              completed={d.completed}
              target={d.target}
              maxVal={maxVal}
              label={d.category}
              percentage={d.percentage}
            />
          ))}
        </group>

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.05, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#111111" transparent opacity={0.4} />
        </mesh>

        <ContactShadows position={[0, -2.1, 0]} opacity={0.3} scale={15} blur={2.5} far={4.5} />
      </Canvas>
    </div>
  );
};
