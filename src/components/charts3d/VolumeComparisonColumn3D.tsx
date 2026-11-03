import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera, ContactShadows, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

interface ColumnProps {
  position: [number, number, number];
  height: number;
  color: string;
  label: string;
  amount: number;
  count: number;
  currency: string;
  avg: number;
}

const Column: React.FC<ColumnProps> = ({ position, height, color, label, amount, count, currency, avg }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!meshRef.current) return;
    const targetScale = hovered ? 1.05 : 1;
    meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetScale, 0.1);
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        position={[0, height / 2, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.8, height, 0.8]} />
        <meshStandardMaterial 
          color={color} 
          metalness={0.6} 
          roughness={0.1}
          emissive={hovered ? color : 'black'}
          emissiveIntensity={hovered ? 0.3 : 0}
        />
      </mesh>

      <Text
        position={[0, -0.5, 0.6]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.2}
        color="white"
        maxWidth={1}
        textAlign="center"
      >
        {label}
      </Text>

      {hovered && (
        <Html position={[0, height + 0.5, 0]}>
          <div className="bg-[#121212] border border-[#D4A017] p-2 rounded-lg shadow-2xl text-[10px] min-w-[140px] pointer-events-none">
            <p className="font-bold text-[#D4A017] uppercase mb-1">{label} Distribution</p>
            <div className="space-y-1 text-white">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-mono text-[#E6C78B]">₹{(amount / 1000000).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between">
                <span>Count:</span>
                <span className="font-mono">{count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg:</span>
                <span className="font-mono">₹{avg.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Currency:</span>
                <span className="font-mono">{currency}</span>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

interface VolumeComparisonColumn3DProps {
  data: { type: string; amount: number; count: number; currency: string; avg: number }[];
}

export const VolumeComparisonColumn3D: React.FC<VolumeComparisonColumn3DProps> = ({ data }) => {
  const maxAmount = useMemo(() => Math.max(...data.map(d => d.amount), 1), [data]);
  
  return (
    <div className="w-full h-full min-h-[350px]">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[5, 5, 8]} fov={40} />
        <OrbitControls 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2.1} 
          minDistance={5} 
          maxDistance={15}
          makeDefault
        />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        
        <Environment preset="city" />

        <group position={[-((data.length - 1) * 1.2) / 2, 0, 0]}>
          {data.map((d, i) => {
            const h = (d.amount / maxAmount) * 4 + 0.1;
            const colors = ['#D4A017', '#F5C542', '#E6C78B', '#6B3E00', '#FFF8E7', '#C49102', '#A67C00'];
            return (
              <Column
                key={i}
                position={[i * 1.5, 0, 0]}
                height={h}
                color={colors[i % colors.length]}
                label={d.type}
                amount={d.amount}
                count={d.count}
                currency={d.currency}
                avg={d.avg}
              />
            );
          })}
        </group>

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#111111" transparent opacity={0.5} roughness={1} />
        </mesh>

        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={15} blur={2} far={4.5} />
      </Canvas>
    </div>
  );
};
