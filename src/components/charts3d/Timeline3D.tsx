import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera, Environment, Html, Float } from '@react-three/drei';
import * as THREE from 'three';

interface TimelineNodeProps {
  position: [number, number, number];
  data: { 
    month: string; 
    quarter: string; 
    count: number; 
    volume: number; 
    avg: number;
  };
  displayType: 'count' | 'volume' | 'avg';
  maxVal: number;
}

const TimelineNode: React.FC<TimelineNodeProps> = ({ position, data, displayType, maxVal }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const val = data[displayType];
  const scale = (val / maxVal) * 2 + 0.2;

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.scale.setScalar(THREE.MathUtils.lerp(meshRef.current.scale.x, hovered ? 1.5 : 1, 0.1));
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[scale * 0.2, 32, 32]} />
        <meshStandardMaterial 
          color="#D4A017" 
          metalness={1} 
          roughness={0.1}
          emissive="#D4A017"
          emissiveIntensity={hovered ? 1 : 0.2}
        />
      </mesh>

      <Text
        position={[0, -0.6, 0]}
        fontSize={0.15}
        color="#9CA3AF"
        rotation={[0, 0, 0]}
      >
        {data.month}
      </Text>

      {hovered && (
        <Html position={[0, scale * 0.2 + 0.3, 0]}>
          <div className="bg-[#121212] border border-[#D4A017] p-2 rounded-lg shadow-2xl text-[10px] min-w-[120px] pointer-events-none">
            <p className="font-bold text-[#D4A017] uppercase">{data.month} ({data.quarter})</p>
            <div className="mt-1 space-y-0.5 text-white">
              <div className="flex justify-between">
                <span>Count:</span>
                <span className="font-mono">{data.count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Volume:</span>
                <span className="font-mono">₹{(data.volume / 1000000).toFixed(1)}M</span>
              </div>
              <div className="flex justify-between">
                <span>Avg:</span>
                <span className="font-mono">₹{data.avg.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

interface Timeline3DProps {
  data: { 
    year: number; 
    quarter: string; 
    month: string; 
    count: number; 
    volume: number; 
    avg: number; 
  }[];
}

export const Timeline3D: React.FC<Timeline3DProps> = ({ data }) => {
  const [displayType, setDisplayType] = useState<'count' | 'volume' | 'avg'>('volume');
  
  const maxVal = useMemo(() => Math.max(...data.map(d => d[displayType]), 1), [data, displayType]);

  const linePoints = useMemo(() => {
    return data.map((d, i) => {
      const x = i * 1.5 - ((data.length - 1) * 1.5) / 2;
      const y = (d[displayType] / maxVal) * 2;
      return new THREE.Vector3(x, y, 0);
    });
  }, [data, displayType, maxVal]);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(linePoints), [linePoints]);

  return (
    <div className="w-full h-full min-h-[400px] relative">
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {(['count', 'volume', 'avg'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setDisplayType(type)}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
              displayType === type 
                ? 'bg-[#D4A017] text-[#1A1A1A]' 
                : 'bg-[#1A1A1A]/80 text-[#9CA3AF] border border-[#3A3A3A] hover:border-[#D4A017]'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 2, 8]} fov={40} />
        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2} makeDefault />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} intensity={1} castShadow />
        <Environment preset="city" />

        <group position={[0, -1, 0]}>
          {/* Path Line */}
          <mesh>
            <tubeGeometry args={[curve, 64, 0.03, 8, false]} />
            <meshStandardMaterial color="#D4A017" emissive="#D4A017" emissiveIntensity={0.5} />
          </mesh>

          {data.map((d, i) => (
            <TimelineNode
              key={i}
              position={[linePoints[i].x, linePoints[i].y, 0]}
              data={d}
              displayType={displayType}
              maxVal={maxVal}
            />
          ))}

          {/* X Axis Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
            <planeGeometry args={[15, 0.1]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      </Canvas>
    </div>
  );
};
