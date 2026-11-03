import React from 'react';

export const KpiSkeleton = () => (
  <div className="rounded-2xl p-6 bg-[#1A1A1A] border border-[#262626] animate-pulse">
    <div className="flex justify-between items-start mb-4">
      <div className="w-8 h-8 rounded-lg bg-[#262626]" />
      <div className="w-12 h-4 rounded bg-[#262626]" />
    </div>
    <div className="w-16 h-4 rounded bg-[#262626] mb-2" />
    <div className="w-24 h-8 rounded bg-[#262626] mb-2" />
    <div className="w-20 h-3 rounded bg-[#262626]" />
  </div>
);

export const ChartSkeleton = () => (
  <div className="rounded-2xl p-6 bg-[#121212]/30 border border-[#262626] animate-pulse h-[350px] flex flex-col">
    <div className="w-32 h-4 rounded bg-[#262626] mb-6" />
    <div className="flex-1 w-full bg-[#1A1A1A] rounded-xl" />
  </div>
);

export const ModuleSkeleton = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <KpiSkeleton key={i} />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  </div>
);
