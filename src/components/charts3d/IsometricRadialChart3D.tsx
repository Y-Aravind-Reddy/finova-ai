import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, ContactShadows, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

interface RadialData {
  label: string;
  value: number;
  amount: number;
  color: string;
}

interface IsometricRadialChart3DProps {
  data: RadialData[];
  title?: string;
  centerLabel?: string;
  centerValue?: string | number;
}

const DonutSegment: React.FC<{
  startAngle: number;
  endAngle: number;
  innerRadius: number;
  outerRadius: number;
  height: number;
  color: string;
  data: RadialData;
}> = ({ startAngle, endAngle, innerRadius, outerRadius, height, color, data }) => {
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
    bevelSegments: 3,
  }), [height]);

  useFrame(() => {
    if (!meshRef.current) return;
    const targetZ = hovered ? 0.3 : 0;
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, 0.1);
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial
          color={color}
          metalness={0.8}
          roughness={0.2}
          emissive={color}
          emissiveIntensity={hovered ? 0.5 : 0.1}
        />
      </mesh>

      {hovered && (
        <Html position={[
          Math.cos((startAngle + endAngle) / 2) * (outerRadius + 0.5),
          0.5,
          Math.sin((startAngle + endAngle) / 2) * (outerRadius + 0.5)
        ]}>
          <div className="bg-[#121212]/95 border border-[#D4A017] p-2 rounded shadow-2xl text-[10px] min-w-[120px] pointer-events-none backdrop-blur-sm">
            <p className="font-bold text-[#D4A017] uppercase mb-1">{data.label}</p>
            <div className="flex justify-between text-white border-t border-white/10 pt-1">
              <span>Count:</span>
              <span className="font-mono">{data.value.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[#E6C78B]">
              <span>Volume:</span>
              <span className="font-mono">₹{(data.amount / 1000000).toFixed(1)}M</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

export const IsometricRadialChart3D: React.FC<IsometricRadialChart3DProps> = ({ data, title, centerLabel, centerValue }) => {
  const total = useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);
  
  const segments = useMemo(() => {
    let currentAngle = 0;
    return data.map((d) => {
      const angle = (d.value / total) * Math.PI * 2;
      const seg = {
        ...d,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
      };
      currentAngle += angle;
      return seg;
    });
  }, [data, total]);

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
        <PerspectiveCamera makeDefault position={[5, 5, 8]} fov={35} />
        <OrbitControls 
          enablePan={false} 
          maxPolarAngle={Math.PI / 2.1} 
          minDistance={5} 
          maxDistance={12}
          makeDefault
        />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
        <Environment preset="city" />

        <group position={[0, -0.5, 0]}>
          {segments.map((s, i) => (
            <DonutSegment
              key={i}
              startAngle={s.startAngle}
              endAngle={s.endAngle}
              innerRadius={2}
              outerRadius={3}
              height={0.6}
              color={s.color}
              data={s}
            />
          ))}

          {/* Center Info */}
          <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
            <Text
              position={[0, 0, 0.7]}
              fontSize={0.3}
              color="#D4A017"
              font="/fonts/Cinzel-Bold.ttf"
              anchorX="center"
              anchorY="middle"
            >
              {centerLabel || 'TOTAL'}
            </Text>
            <Text
              position={[0, -0.5, 0.7]}
              fontSize={0.5}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              {centerValue || total.toLocaleString()}
            </Text>
          </group>
        </group>

        <ContactShadows position={[0, -1, 0]} opacity={0.4} scale={15} blur={2} far={4.5} />
      </Canvas>
    </div>
  );
};
