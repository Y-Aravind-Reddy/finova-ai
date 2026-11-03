import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, Float, ContactShadows, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

interface DataPoint {
  label: string;
  value: number;
}

interface GoldRibbonChart3DProps {
  data: DataPoint[];
  title?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}

const RibbonMesh: React.FC<{ data: DataPoint[]; maxVal: number }> = ({ data, maxVal }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const width = 8;
    const height = 4;
    data.forEach((d, i) => {
      const x = (i / (data.length - 1)) * width - width / 2;
      const y = (d.value / maxVal) * height;
      pts.push(new THREE.Vector3(x, y, 0));
    });
    return pts;
  }, [data, maxVal]);

  const ribbonGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, 0);
    points.forEach((p) => shape.lineTo(p.x, p.y));
    shape.lineTo(points[points.length - 1].x, 0);
    shape.closePath();

    const extrudeSettings = {
      steps: 1,
      depth: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelOffset: 0,
      bevelSegments: 3,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [points]);

  const lineGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  return (
    <group position={[0, -2, 0]}>
      {/* Extruded Ribbon Body */}
      <mesh geometry={ribbonGeometry}>
        <meshStandardMaterial
          color="#D4A017"
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={0.6}
          emissive="#D4A017"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Glowing Top Line */}
      <line {...({ geometry: lineGeometry, position: [0, 0, 0.5] } as any)}>
        <lineBasicMaterial color="#F5C542" linewidth={2} />
      </line>

      {/* Data Points */}
      {points.map((p, i) => (
        <group key={i} position={[p.x, p.y, 0.5]}>
          <mesh
            onPointerOver={() => setHoveredIdx(i)}
            onPointerOut={() => setHoveredIdx(null)}
          >
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial
              color="#FFF8E7"
              emissive="#F5C542"
              emissiveIntensity={hoveredIdx === i ? 2 : 1}
            />
          </mesh>

          {/* Vertical Reference Line */}
          <mesh position={[0, -p.y / 2, 0]}>
            <boxGeometry args={[0.02, p.y, 0.01]} />
            <meshStandardMaterial color="#D4A017" transparent opacity={0.3} />
          </mesh>

          {/* Label below */}
          <Text
            position={[0, -p.y - 0.5, 0]}
            fontSize={0.25}
            color="#D4A017"
            font="/fonts/JetBrainsMono-Regular.ttf"
          >
            {data[i].label}
          </Text>

          {/* Tooltip */}
          {hoveredIdx === i && (
            <Html position={[0, 0.5, 0]}>
              <div className="bg-[#121212]/90 border border-[#D4A017] p-2 rounded shadow-xl whitespace-nowrap pointer-events-none">
                <p className="text-[10px] font-mono text-[#9CA3AF] uppercase">{data[i].label}</p>
                <p className="text-xs font-bold text-white">
                  {data[i].value.toLocaleString()}
                </p>
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
};

export const GoldRibbonChart3D: React.FC<GoldRibbonChart3DProps> = ({ data, title, valuePrefix = '', valueSuffix = '' }) => {
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-full h-full min-h-[300px] relative bg-[#1E1E1E] rounded-xl border border-[#D4A017]/20 shadow-2xl overflow-hidden">
      {title && (
        <div className="absolute top-4 left-5 z-10">
          <h3 className="font-cinzel text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017]">
            {title}
          </h3>
        </div>
      )}
      
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 2, 10]} fov={40} />
        <OrbitControls 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2.2} 
          minDistance={5} 
          maxDistance={15}
          makeDefault
        />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#D4A017" />
        
        <Environment preset="city" />

        <RibbonMesh data={data} maxVal={maxVal} />

        <ContactShadows position={[0, -2.1, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
      </Canvas>
    </div>
  );
};
