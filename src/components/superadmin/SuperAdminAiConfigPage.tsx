import React, { useState } from 'react';
import { Cpu, Sliders, Zap, ShieldAlert, Save, RefreshCw } from 'lucide-react';

export const SuperAdminAiConfigPage: React.FC = () => {
  const [model, setModel] = useState('Finova-Sentinel-Ultra-4.2');
  const [temperature, setTemperature] = useState(0.2);
  const [latencySla, setLatencySla] = useState(250);
  const [guardrailActive, setGuardrailActive] = useState(true);
  const [hallucinationFilter, setHallucinationFilter] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              AI Governance
            </span>
            <span className="text-xs text-[#D4A017]">Sentinel Tuning Engine</span>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            AI Engine Configuration
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Tune neural inference parameters, temperature limits, SOC-2 compliance filters, and grounding dataset linkages.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2"
        >
          <Save size={14} />
          <span>{saved ? 'Parameters Saved!' : 'Deploy Parameters'}</span>
        </button>
      </div>

      <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-6 shadow-lg space-y-5 max-w-3xl">
        <div className="space-y-4">
          <div>
            <label className="text-[#D4A017] font-bold block mb-1">
              Active Production Foundation Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
            >
              <option value="Finova-Sentinel-Ultra-4.2">Finova Sentinel Ultra 4.2 (Zero-Hallucination Tier)</option>
              <option value="Finova-Forensic-Vision-6.1">Finova Forensic Vision 6.1 (Document & MRZ OCR)</option>
              <option value="Finova-Yield-Optimizer-3.9">Finova Sovereign Yield Optimizer 3.9 (Quantitative)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[#D4A017] font-bold">
                Determinism / Temperature ({temperature})
              </label>
              <span className="text-[#6B7280]">0.0 (Deterministic) to 1.0 (Creative)</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-[#F5C542]"
            />
          </div>

          <div>
            <label className="text-[#D4A017] font-bold block mb-1">
              Target Max Latency SLA ({latencySla} ms)
            </label>
            <input
              type="number"
              value={latencySla}
              onChange={(e) => setLatencySla(parseInt(e.target.value) || 200)}
              className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542]"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-[#111111] rounded-xl border border-[#301B05]">
            <div>
              <span className="font-bold text-[#FFF8E7] block">FINMA / Basel III Hallucination Guardrail</span>
              <span className="text-[11px] text-[#6B7280]">
                Strict numerical verification preventing speculative advice on sovereign assets.
              </span>
            </div>
            <input
              type="checkbox"
              checked={hallucinationFilter}
              onChange={(e) => setHallucinationFilter(e.target.checked)}
              className="w-4 h-4 accent-[#F5C542]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
