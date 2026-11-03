import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Float, PerspectiveCamera, ContactShadows, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

interface DonutSegmentProps {
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  height: number;
  color: string;
  label: string;
  value: number;
  percentage: number;
  amount: number;
  isSelected: boolean;
  onSelect: () => void;
}

const DonutSegment: React.FC<DonutSegmentProps> = ({
  startAngle,
  endAngle,
  innerRadius,
  outerRadius,
  height,
  color,
  label,
  value,
  percentage,
  amount,
  isSelected,
  onSelect
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, outerRadius, startAngle, endAngle, false);
    s.absarc(0, 0, innerRadius, endAngle, startAngle, true);
    return s;
  }, [startAngle, endAngle, innerRadius, outerRadius]);

  const extrudeSettings = useMemo(() => ({
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelOffset: 0,
    bevelSegments: 3
  }), [height]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const targetY = (hovered || isSelected) ? 0.2 : 0;
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetY, 0.1);
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial 
          color={color} 
          metalness={0.8} 
          roughness={0.2} 
          emissive={isSelected ? color : 'black'}
          emissiveIntensity={isSelected ? 0.5 : 0}
        />
      </mesh>

      {(hovered || isSelected) && (
        <Html position={[
          Math.cos((startAngle + endAngle) / 2) * (outerRadius + 0.5),
          0.5,
          Math.sin((startAngle + endAngle) / 2) * (outerRadius + 0.5)
        ]}>
          <div className="bg-[#121212] border border-[#D4A017] p-2 rounded-lg shadow-2xl text-[10px] min-w-[120px] pointer-events-none">
            <p className="font-bold text-[#D4A017] uppercase">{label}</p>
            <div className="flex justify-between mt-1 text-white">
              <span>Count:</span>
              <span className="font-mono">{value.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-white">
              <span>Share:</span>
              <span className="font-mono">{percentage.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-white">
              <span>Volume:</span>
              <span className="font-mono text-[#E6C78B]">₹{(amount / 1000000).toFixed(1)}M</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

interface TransactionTypeDonut3DProps {
  data: { label: string; value: number; color: string; amount: number }[];
  onSegmentSelect: (label: string) => void;
  selectedType: string | null;
}

export const TransactionTypeDonut3D: React.FC<TransactionTypeDonut3DProps> = ({ data, onSegmentSelect, selectedType }) => {
  const total = useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);
  
  const segments = useMemo(() => {
    let currentAngle = 0;
    return data.map((d) => {
      const angle = (d.value / total) * Math.PI * 2;
      const segment = {
        ...d,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        percentage: (d.value / total) * 100
      };
      currentAngle += angle;
      return segment;
    });
  }, [data, total]);

  const resetCamera = () => {
    // This would ideally interact with OrbitControls, but we'll let users just rotate
  };

  return (
    <div className="w-full h-full min-h-[350px] relative">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 5, 8]} fov={40} />
        <OrbitControls 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2.1} 
          minDistance={5} 
          maxDistance={12}
          makeDefault
        />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <Environment preset="city" />

        <group position={[0, -0.5, 0]}>
          {segments.map((s, i) => (
            <DonutSegment
              key={i}
              {...s}
              innerRadius={2}
              outerRadius={3}
              height={0.5}
              isSelected={selectedType === s.label}
              onSelect={() => onSegmentSelect(s.label)}
            />
          ))}

          {/* Center Text */}
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <Text
              position={[0, 0.6, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.4}
              color="#D4A017"
              font="/fonts/Cinzel-Bold.ttf" // Use standard font if cinzel not available
              anchorX="center"
              anchorY="middle"
            >
              TOTAL
            </Text>
            <Text
              position={[0, 0.2, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.6}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              {total.toLocaleString()}
            </Text>
          </Float>
        </group>

        <ContactShadows position={[0, -1, 0]} opacity={0.4} scale={15} blur={2} far={4.5} />
      </Canvas>

      <button 
        onClick={() => onSegmentSelect('')}
        className="absolute top-4 right-4 bg-[#1A1A1A]/80 border border-[#D4A017]/30 text-[#D4A017] px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-[#D4A017] hover:text-[#1A1A1A] transition-all"
      >
        RESET VIEW
      </button>
    </div>
  );
};
