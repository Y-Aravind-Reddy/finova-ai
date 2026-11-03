import React from 'react';
import { ThreeDAreaChart } from '../../charts3d/ThreeDAreaChart';
import { ThreeDColumnChart } from '../../charts3d/ThreeDColumnChart';
import { Lock, UserCheck, Shield, Globe } from 'lucide-react';

export const AuditSecurityTrail: React.FC = () => {
  // Mocking detailed audit data for now as specific aggregate RPC for audit is not yet extensive
  const activityData = [
    { label: '00:00', value: 420 },
    { label: '04:00', value: 380 },
    { label: '08:00', value: 1240 },
    { label: '12:00', value: 2850 },
    { label: '16:00', value: 2100 },
    { label: '20:00', value: 890 },
  ];

  const actionData = [
    { label: 'Profile Update', value: 840 },
    { label: 'Role Change', value: 42 },
    { label: 'TXN Override', value: 112 },
    { label: 'KYC Approval', value: 520 },
    { label: 'Auth Login', value: 4800 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreeDAreaChart
          title="3D System Access Velocity"
          subtitle="Total platform interactions (24h)"
          data={activityData}
          height={300}
        />
        
        <ThreeDColumnChart
          title="Privileged Action Log"
          subtitle="Top administrative interventions"
          data={actionData}
          height={300}
          primaryLabel="Actions"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Sessions', value: '4,120', icon: <UserCheck className="text-emerald-400" /> },
          { label: 'Security Flags', value: '12', icon: <Shield className="text-[#D4A017]" /> },
          { label: 'Geo-Access Points', value: '28 Cities', icon: <Globe className="text-blue-400" /> },
          { label: 'Policy Breaches', value: '0', icon: <Lock className="text-emerald-400" /> },
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

      <div className="rounded-2xl bg-[#1A1A1A]/30 border border-[#3A3A3A] p-4 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-[#D4A017]" />
          <h4 className="font-cinzel text-xs font-bold text-[#E6C78B]">Real-time Immutable Audit Feed</h4>
        </div>
        <div className="space-y-2 font-mono text-[9px]">
          {[
            { actor: 'Claire M.', action: 'Override: Wire Settlement #TXN-421', time: '14:28:01', status: 'Authorized' },
            { actor: 'System', action: 'Automated Flag: Rapid Velocity Anomaly', time: '14:27:55', status: 'Flagged' },
            { actor: 'Hans W.', action: 'Role Change: Analyst -> Admin', time: '14:25:30', status: 'Authorized' },
            { actor: 'Eleanor S.', action: 'Bulk Upload: Client KYC Profiles', time: '14:20:12', status: 'Authorized' },
          ].map((log, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded bg-[#121212] border border-[#262626]">
              <div className="flex items-center gap-4">
                <span className="text-[#9CA3AF] w-12">{log.time}</span>
                <span className="text-[#E6C78B] w-20">{log.actor}</span>
                <span className="text-[#FAF7F0]">{log.action}</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${log.status === 'Authorized' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                {log.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
