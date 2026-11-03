import React from 'react';
import { ThreeDColumnChart } from '../../charts3d/ThreeDColumnChart';
import { ThreeDAreaChart } from '../../charts3d/ThreeDAreaChart';
import { Cpu, Database, Server, Zap } from 'lucide-react';

export const SystemHealth: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDAreaChart
          title="API Response Latency"
          subtitle="Platform core engine performance (ms)"
          data={[
            { label: '08:00', value: 42 },
            { label: '10:00', value: 38 },
            { label: '12:00', value: 56 },
            { label: '14:00', value: 44 },
            { label: '16:00', value: 40 },
          ]}
          valueSuffix="ms"
          height={300}
        />
        
        <ThreeDColumnChart
          title="Database Query Load"
          subtitle="Operations per second (OPS)"
          data={[
            { label: 'Read', value: 4800 },
            { label: 'Write', value: 1200 },
            { label: 'Agg', value: 850 },
            { label: 'RPC', value: 3200 },
          ]}
          height={300}
          primaryLabel="OPS"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Engine Uptime', value: '99.998%', icon: <Server className="text-emerald-400" /> },
          { label: 'CPU Load', value: '12.4%', icon: <Cpu className="text-blue-400" /> },
          { label: 'Storage Used', value: '2.4 TB', icon: <Database className="text-[#D4A017]" /> },
          { label: 'Real-time Sync', value: 'Active', icon: <Zap className="text-emerald-400" /> },
        ].map((stat, idx) => (
          <div key={idx} className="rounded-xl bg-[#1A1A1A] border border-[#3A3A3A] p-4 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[#121212] border border-[#3A3A3A]">
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider">{stat.label}</p>
              <p className="font-mono text-lg font-bold text-[#FAF7F0]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const StrategicMap: React.FC = () => {
  return (
    <div className="rounded-2xl bg-[#1A1A1A] border border-[#3A3A3A] p-8 shadow-2xl min-h-[500px] flex flex-col items-center justify-center text-center">
      <div className="w-24 h-24 rounded-full bg-[#D4A017]/10 border border-[#D4A017]/30 flex items-center justify-center mb-6 animate-pulse">
        <div className="w-16 h-16 rounded-full bg-[#D4A017]/20 border border-[#D4A017]/50 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-[#D4A017]" />
        </div>
      </div>
      <h3 className="font-cinzel text-2xl font-bold text-[#E6C78B] mb-2">Global Strategic Intelligence Map</h3>
      <p className="text-[#9CA3AF] max-w-md mx-auto mb-8">
        Visualizing real-time capital flows across 28 global financial hubs. High-fidelity geographical rendering in progress.
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-3xl">
        {[
          { city: 'New York', volume: '$2.4B', active: true },
          { city: 'London', volume: '$1.8B', active: true },
          { city: 'Zurich', volume: '$1.2B', active: true },
          { city: 'Singapore', volume: '$840M', active: true },
        ].map((loc, i) => (
          <div key={i} className="space-y-1">
            <p className="font-cinzel text-[10px] font-bold text-[#D4A017] uppercase tracking-widest">{loc.city}</p>
            <p className="font-mono text-lg text-[#FAF7F0]">{loc.volume}</p>
            <div className="flex justify-center items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[8px] text-emerald-400 font-bold">NODE ACTIVE</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
