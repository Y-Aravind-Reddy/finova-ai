import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  Sliders,
  Zap,
  ShieldAlert,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Lock,
  Clock,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import {
  fetchAiConfigurationResultFromDb,
  saveAiConfigurationToDb,
  AiConfiguration,
  DEFAULT_AI_CONFIGURATION,
} from '../../services/finovaDatabase';
import { getStoredSession } from '../../data/authStore';

interface SuperAdminAiConfigPageProps {
  currentUser?: {
    role?: string;
    name?: string;
    email?: string;
  };
}

export const SuperAdminAiConfigPage: React.FC<SuperAdminAiConfigPageProps> = ({ currentUser }) => {
  const [model, setModel] = useState<string>(DEFAULT_AI_CONFIGURATION.model);
  const [temperature, setTemperature] = useState<number>(DEFAULT_AI_CONFIGURATION.temperature);
  const [latencySla, setLatencySla] = useState<number>(DEFAULT_AI_CONFIGURATION.latencySla);
  const [guardrailActive, setGuardrailActive] = useState<boolean>(DEFAULT_AI_CONFIGURATION.guardrailActive);
  const [hallucinationFilter, setHallucinationFilter] = useState<boolean>(DEFAULT_AI_CONFIGURATION.hallucinationFilter);

  // Risk & Sentinel Autonomous Controls
  const [sentinelConfidenceThreshold, setSentinelConfidenceThreshold] = useState<number>(
    DEFAULT_AI_CONFIGURATION.sentinelConfidenceThreshold
  );
  const [autoFreezeThreshold, setAutoFreezeThreshold] = useState<number>(
    DEFAULT_AI_CONFIGURATION.autoFreezeThreshold
  );
  const [maxDailyWireVelocity, setMaxDailyWireVelocity] = useState<number>(
    DEFAULT_AI_CONFIGURATION.maxDailyWireVelocity
  );
  const [dualKeySignoffEnabled, setDualKeySignoffEnabled] = useState<boolean>(
    DEFAULT_AI_CONFIGURATION.dualKeySignoffEnabled
  );
  const [realTimeAuditLogging, setRealTimeAuditLogging] = useState<boolean>(
    DEFAULT_AI_CONFIGURATION.realTimeAuditLogging
  );

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [successDetails, setSuccessDetails] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  // Determine active user (prop, stored session, or default)
  const activeUser = currentUser || getStoredSession()?.user || {
    role: 'SUPER_ADMIN',
    name: 'Alexander Vance',
    email: 'superadmin@finova.ai',
  };

  const loadConfiguration = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchAiConfigurationResultFromDb();
      setModel(result.config.model);
      setTemperature(result.config.temperature);
      setLatencySla(result.config.latencySla);
      setGuardrailActive(result.config.guardrailActive);
      setHallucinationFilter(result.config.hallucinationFilter);
      setSentinelConfidenceThreshold(result.config.sentinelConfidenceThreshold);
      setAutoFreezeThreshold(result.config.autoFreezeThreshold);
      setMaxDailyWireVelocity(result.config.maxDailyWireVelocity);
      setDualKeySignoffEnabled(result.config.dualKeySignoffEnabled);
      setRealTimeAuditLogging(result.config.realTimeAuditLogging);

      setIsDbConnected(result.isDbConnected);
      setLastUpdated(result.config.updatedAt || null);
      setUpdatedBy(result.config.updatedBy || null);

      if (result.error && !result.isDbConnected) {
        setErrorMessage(result.error);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reload AI configuration from Supabase storage.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);
    setSuccessDetails(null);

    const configToSave: AiConfiguration = {
      model,
      temperature,
      latencySla,
      guardrailActive,
      hallucinationFilter,
      sentinelConfidenceThreshold,
      autoFreezeThreshold,
      maxDailyWireVelocity,
      dualKeySignoffEnabled,
      realTimeAuditLogging,
    };

    try {
      const result = await saveAiConfigurationToDb(configToSave, activeUser);

      if (!result.success) {
        // Explicitly report failed operations - never show false success!
        setErrorMessage(result.error || 'Failed to persist AI parameters to database.');
        setSaveSuccess(false);
      } else {
        setSaveSuccess(true);
        setLastUpdated(result.config.updatedAt || new Date().toISOString());
        setUpdatedBy(result.config.updatedBy || activeUser.name || 'Super Admin');
        setSuccessDetails(
          result.auditLogged
            ? 'Parameters persisted to Supabase and immutable audit event recorded in public.audit_logs.'
            : 'Parameters saved to persistent configuration cache.'
        );

        setTimeout(() => {
          setSaveSuccess(false);
        }, 5000);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unexpected exception saving configuration.');
      setSaveSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner */}
      <div className="rounded-2xl p-6 bg-gradient-to-r from-[#1E1E1E] via-[#352008] to-[#1E1E1E] border border-[#D4A017]/40 shadow-[0_12px_36px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A017] text-[#111111] uppercase tracking-wider">
              AI Governance
            </span>
            <span className="text-xs text-[#D4A017]">Sentinel Tuning Engine</span>
            <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-[#111111]/80 border border-[#D4A017]/30 text-[10px]">
              <Database size={11} className={isDbConnected ? 'text-[#10B981]' : 'text-[#F59E0B]'} />
              <span className={isDbConnected ? 'text-[#10B981]' : 'text-[#F59E0B]'}>
                {isDbConnected ? 'Supabase Sync Active' : 'Local / Cache Storage'}
              </span>
            </div>
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFF8E7] via-[#F5C542] to-[#D4A017] mt-1">
            AI Engine Configuration
          </h1>
          <p className="text-xs text-[#FFF8E7]/80 max-w-2xl mt-1">
            Tune neural inference parameters, AML anomaly confidence, autonomous escrow freeze triggers, and dual-key signoff enforcement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadConfiguration}
            disabled={loading || saving}
            className="px-3.5 py-2.5 rounded-xl bg-[#141414] border border-[#D4A017]/40 text-[#FAF7F0] hover:bg-[#1E1E1E] text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            title="Reload from Supabase"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#D4A017]' : 'text-[#D4A017]'} />
            <span className="hidden sm:inline">Reload</span>
          </button>

          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4A017] via-[#F5C542] to-[#D4A017] text-[#111111] font-bold text-xs hover:brightness-110 shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Deploying...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 size={14} />
                <span>Parameters Saved!</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Deploy Parameters</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccess && (
        <div className="rounded-xl p-4 bg-[#052814] border border-[#10B981]/50 text-[#FAF7F0] flex items-start gap-3 shadow-lg">
          <CheckCircle2 size={18} className="text-[#10B981] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#10B981] text-xs">AI Parameters Successfully Deployed</p>
            <p className="text-[11px] text-[#A7F3D0] mt-0.5">
              {successDetails || 'Updated configuration persisted and synchronized with production engines.'}
            </p>
            {lastUpdated && (
              <p className="text-[10px] text-[#6EE7B7] mt-1 flex items-center gap-1.5">
                <Clock size={11} />
                <span>Timestamp: {new Date(lastUpdated).toUTCString()} • Operator: {updatedBy || 'Super Admin'}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Explicit Error Notification Banner - prevents false success */}
      {errorMessage && (
        <div className="rounded-xl p-4 bg-[#2D0A0A] border border-[#EF4444]/60 text-[#FAF7F0] flex items-start gap-3 shadow-lg">
          <AlertTriangle size={18} className="text-[#EF4444] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-[#EF4444] text-xs">AI Configuration Update Failed</p>
            <p className="text-[11px] text-[#FCA5A5] mt-0.5">{errorMessage}</p>
            <button
              onClick={loadConfiguration}
              className="mt-2 text-[10px] underline text-[#F87171] hover:text-[#EF4444]"
            >
              Reload current saved settings from database
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Foundation Model & Neural Parameters */}
        <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#D4A017]/20">
            <div className="flex items-center gap-2 text-xs font-bold text-[#FAF7F0]">
              <Cpu size={15} className="text-[#D4A017]" />
              <span>Foundation Model & Neural Bounds</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
              <Lock size={12} className="text-[#D4A017]" />
              <span>SUPER_ADMIN</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Active Model Selection */}
            <div>
              <label className="text-[#D4A017] font-bold block mb-1">
                Active Production Foundation Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={loading || saving}
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542] disabled:opacity-50"
              >
                <option value="Finova-Sentinel-Ultra-4.2">Finova Sentinel Ultra 4.2 (Zero-Hallucination Tier)</option>
                <option value="Finova-Forensic-Vision-6.1">Finova Forensic Vision 6.1 (Document & MRZ OCR)</option>
                <option value="Finova-Yield-Optimizer-3.9">Finova Sovereign Yield Optimizer 3.9 (Quantitative)</option>
              </select>
            </div>

            {/* Temperature Slider */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-[#D4A017] font-bold">
                  Determinism / Temperature ({temperature.toFixed(2)})
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
                disabled={loading || saving}
                className="w-full accent-[#F5C542] disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-[#6B7280] mt-1">
                <span>0.00 — Zero-Variance</span>
                <span>0.20 — Standard</span>
                <span>1.00 — High Entropy</span>
              </div>
            </div>

            {/* Target SLA */}
            <div>
              <label className="text-[#D4A017] font-bold block mb-1">
                Target Max Latency SLA ({latencySla} ms)
              </label>
              <input
                type="number"
                min="50"
                max="2000"
                step="10"
                value={latencySla}
                onChange={(e) => setLatencySla(parseInt(e.target.value, 10) || 200)}
                disabled={loading || saving}
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2.5 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542] disabled:opacity-50"
              />
            </div>

            {/* Hallucination Filter */}
            <div className="flex items-center justify-between p-3.5 bg-[#111111] rounded-xl border border-[#301B05]">
              <div className="pr-3">
                <span className="font-bold text-[#FFF8E7] block text-[11px]">FINMA / Basel III Hallucination Guardrail</span>
                <span className="text-[10px] text-[#6B7280]">Strict numerical verification on sovereign transactions.</span>
              </div>
              <input
                type="checkbox"
                checked={hallucinationFilter}
                onChange={(e) => setHallucinationFilter(e.target.checked)}
                disabled={loading || saving}
                className="w-4 h-4 accent-[#F5C542] disabled:opacity-50 shrink-0"
              />
            </div>

            {/* SOC-2 Scrubber */}
            <div className="flex items-center justify-between p-3.5 bg-[#111111] rounded-xl border border-[#301B05]">
              <div className="pr-3">
                <span className="font-bold text-[#FFF8E7] block text-[11px]">SOC-2 Type II PII Scrubber</span>
                <span className="text-[10px] text-[#6B7280]">Mask routing codes and addresses before tokenization.</span>
              </div>
              <input
                type="checkbox"
                checked={guardrailActive}
                onChange={(e) => setGuardrailActive(e.target.checked)}
                disabled={loading || saving}
                className="w-4 h-4 accent-[#F5C542] disabled:opacity-50 shrink-0"
              />
            </div>
          </div>
        </div>

        {/* Panel 2: Sentinel AML & Escrow Freeze Policy Controls */}
        <div className="rounded-2xl bg-[#1E1E1E]/95 border border-[#D4A017]/30 p-6 shadow-lg space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#D4A017]/20">
            <div className="flex items-center gap-2 text-xs font-bold text-[#FAF7F0]">
              <ShieldCheck size={15} className="text-[#D4A017]" />
              <span>Sentinel AML & Autonomous Freeze Controls</span>
            </div>
            <span className="text-[10px] text-[#D4A017] font-mono">Persisted in Supabase</span>
          </div>

          <div className="space-y-4">
            {/* AML Anomaly Confidence Threshold */}
            <div>
              <div className="flex justify-between text-[#FAF7F0] mb-1">
                <label className="text-[#D4A017] font-bold">AML Anomaly Confidence Threshold</label>
                <span className="font-bold text-[#F5C542]">{sentinelConfidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min="70"
                max="99"
                value={sentinelConfidenceThreshold}
                onChange={(e) => setSentinelConfidenceThreshold(Number(e.target.value))}
                disabled={loading || saving}
                className="w-full accent-[#F5C542] disabled:opacity-50"
              />
              <span className="text-[10px] text-[#6B7280] block mt-0.5">
                Minimum statistical certainty required before flagging structuring or sanction anomalies.
              </span>
            </div>

            {/* Autonomous Escrow Freeze Threshold */}
            <div>
              <div className="flex justify-between text-[#FAF7F0] mb-1">
                <label className="text-[#D4A017] font-bold">Autonomous Escrow Freeze Risk Score</label>
                <span className="font-bold text-[#F5C542]">{autoFreezeThreshold} / 100</span>
              </div>
              <input
                type="range"
                min="60"
                max="95"
                value={autoFreezeThreshold}
                onChange={(e) => setAutoFreezeThreshold(Number(e.target.value))}
                disabled={loading || saving}
                className="w-full accent-[#F5C542] disabled:opacity-50"
              />
              <span className="text-[10px] text-[#6B7280] block mt-0.5">
                Transactions scoring above this threshold trigger an immediate autonomous escrow lock.
              </span>
            </div>

            {/* Max Daily Wire Velocity */}
            <div>
              <label className="text-[#D4A017] font-bold block mb-1">
                Max Daily Wire Velocity Limit (USD)
              </label>
              <input
                type="number"
                min="500000"
                max="100000000"
                step="500000"
                value={maxDailyWireVelocity}
                onChange={(e) => setMaxDailyWireVelocity(Number(e.target.value) || 5000000)}
                disabled={loading || saving}
                className="w-full bg-[#111111] border border-[#D4A017]/40 rounded-xl px-4 py-2 text-xs text-[#FAF7F0] focus:outline-none focus:border-[#F5C542] disabled:opacity-50"
              />
            </div>

            {/* Dual Key Signoff */}
            <div className="flex items-center justify-between p-3.5 bg-[#111111] rounded-xl border border-[#301B05]">
              <div className="pr-3">
                <span className="font-bold text-[#FFF8E7] block text-[11px]">Enforce Dual-Key Approval</span>
                <span className="text-[10px] text-[#6B7280]">Require secondary Super Admin signoff for transfers &gt; $5,000,000.</span>
              </div>
              <input
                type="checkbox"
                checked={dualKeySignoffEnabled}
                onChange={(e) => setDualKeySignoffEnabled(e.target.checked)}
                disabled={loading || saving}
                className="w-4 h-4 accent-[#F5C542] disabled:opacity-50 shrink-0"
              />
            </div>

            {/* Real-Time Cryptographic Audit Trail */}
            <div className="flex items-center justify-between p-3.5 bg-[#111111] rounded-xl border border-[#301B05]">
              <div className="pr-3">
                <span className="font-bold text-[#FFF8E7] block text-[11px]">Real-Time Cryptographic Audit Trail</span>
                <span className="text-[10px] text-[#6B7280]">Stream sealed audit records directly to public.audit_logs.</span>
              </div>
              <input
                type="checkbox"
                checked={realTimeAuditLogging}
                onChange={(e) => setRealTimeAuditLogging(e.target.checked)}
                disabled={loading || saving}
                className="w-4 h-4 accent-[#F5C542] disabled:opacity-50 shrink-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Operator Info */}
      <div className="p-3 bg-[#1E1E1E]/60 rounded-xl border border-[#D4A017]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[10px] text-[#6B7280] gap-2">
        <span>Active Operator: {activeUser.name} ({activeUser.role})</span>
        {lastUpdated && (
          <span>Last Synchronized: {new Date(lastUpdated).toLocaleString()} • Persistence Rail: public.tenant_workspaces (platform_root)</span>
        )}
      </div>
    </div>
  );
};
