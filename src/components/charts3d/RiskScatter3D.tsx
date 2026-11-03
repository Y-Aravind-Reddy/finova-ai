import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera, Stars, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

interface ScatterPointProps {
  position: [number, number, number];
  data: { 
    id: string; 
    customerId: string; 
    amount: number; 
    currency: string; 
    riskScore: number; 
    type: string; 
    date: string;
  };
  color: string;
  onClick: () => void;
}

const ScatterPoint: React.FC<ScatterPointProps> = ({ position, data, color, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!meshRef.current) return;
    const s = hovered ? 1.5 : 1;
    meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, s, 0.1));
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={hovered ? 2 : 0.5} 
          metalness={0.8} 
          roughness={0.2} 
        />
      </mesh>

      {hovered && (
        <Html position={[0.2, 0.2, 0]}>
          <div className="bg-[#121212]/95 border border-[#D4A017] p-3 rounded-xl shadow-2xl text-[10px] min-w-[180px] pointer-events-none backdrop-blur-md">
            <p className="font-bold text-[#D4A017] border-b border-[#D4A017]/30 pb-1 mb-2">{data.id}</p>
            <div className="space-y-1 text-white">
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Customer:</span>
                <span>{data.customerId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Amount:</span>
                <span className="font-bold">₹{data.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Risk Score:</span>
                <span className={data.riskScore > 75 ? 'text-rose-400 font-bold' : data.riskScore > 50 ? 'text-amber-400' : 'text-emerald-400'}>
                  {data.riskScore}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Type:</span>
                <span>{data.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9CA3AF]">Date:</span>
                <span>{data.date}</span>
              </div>
            </div>
            <p className="mt-2 text-[8px] text-center text-[#D4A017]/60 italic">Click to view full details</p>
          </div>
        </Html>
      )}
    </group>
  );
};

interface RiskScatter3DProps {
  data: { 
    x: number; 
    y: number; 
    z: number; 
    id: string; 
    customerId: string; 
    amount: number; 
    currency: string; 
    riskScore: number; 
    type: string; 
    date: string;
  }[];
  onPointClick: (id: string) => void;
}

export const RiskScatter3D: React.FC<RiskScatter3DProps> = ({ data, onPointClick }) => {
  const maxAmount = useMemo(() => Math.max(...data.map(d => d.x), 1), [data]);
  const minTime = useMemo(() => Math.min(...data.map(d => d.z)), [data]);
  const maxTime = useMemo(() => Math.max(...data.map(d => d.z)), [data]);

  const points = useMemo(() => {
    return data.map(d => {
      // Scale coordinates
      const scaledX = (d.x / maxAmount) * 8 - 4; // Amount -> X
      const scaledY = (d.y / 100) * 5 - 2.5;   // Risk Score -> Y
      const scaledZ = maxTime === minTime ? 0 : ((d.z - minTime) / (maxTime - minTime)) * 6 - 3; // Time -> Z
      
      const color = d.riskScore > 75 ? '#FF4D4D' : d.riskScore > 50 ? '#F5C542' : '#22C55E';
      
      return { 
        position: [scaledX, scaledY, scaledZ] as [number, number, number], 
        data: d, 
        color 
      };
    });
  }, [data, maxAmount, minTime, maxTime]);

  return (
    <div className="w-full h-full min-h-[450px] relative">
      <Canvas>
        <PerspectiveCamera makeDefault position={[5, 5, 8]} fov={40} />
        <OrbitControls makeDefault />
        
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="night" />

        {/* Axes */}
        <group>
          {/* X Axis (Amount) */}
          <mesh position={[0, -2.5, -3]}>
            <boxGeometry args={[8.2, 0.05, 0.05]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <Text position={[4.5, -2.5, -3]} fontSize={0.2} color="#9CA3AF">AMOUNT →</Text>

          {/* Y Axis (Risk) */}
          <mesh position={[-4, 0, -3]}>
            <boxGeometry args={[0.05, 5.2, 0.05]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <Text position={[-4, 2.8, -3]} fontSize={0.2} color="#9CA3AF" rotation={[0, 0, Math.PI / 2]}>RISK SCORE →</Text>

          {/* Z Axis (Time) */}
          <mesh position={[-4, -2.5, 0]}>
            <boxGeometry args={[0.05, 0.05, 6.2]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <Text position={[-4, -2.5, 3.5]} fontSize={0.2} color="#9CA3AF" rotation={[0, Math.PI / 2, 0]}>TIME →</Text>
        </group>

        {points.map((p, i) => (
          <ScatterPoint 
            key={i} 
            position={p.position} 
            data={p.data} 
            color={p.color} 
            onClick={() => onPointClick(p.data.id)} 
          />
        ))}
      </Canvas>
      
      <div className="absolute bottom-4 left-4 flex gap-4 text-[10px] font-mono">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#FF4D4D]" />
          <span className="text-white">High Risk ({'>'}75)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#F5C542]" />
          <span className="text-white">Medium Risk (50-75)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
          <span className="text-white">Low Risk ({'<'}50)</span>
        </div>
      </div>
    </div>
  );
};
