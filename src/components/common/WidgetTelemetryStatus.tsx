import React from 'react';
import { Clock, AlertTriangle, ShieldAlert, WifiOff, CheckCircle2, RotateCw } from 'lucide-react';
import { TelemetryNodeStatus } from '../../services/finovaDatabase';

interface WidgetStatusBadgeProps {
  status: TelemetryNodeStatus | 'LOADING';
  label?: string;
}

export const WidgetStatusBadge: React.FC<WidgetStatusBadgeProps> = ({ status, label }) => {
  const styles: Record<TelemetryNodeStatus | 'LOADING', string> = {
    OPERATIONAL: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300',
    TIMEOUT: 'bg-orange-950/80 border-orange-500/50 text-orange-300',
    DEGRADED: 'bg-amber-950/80 border-amber-500/50 text-amber-300',
    RESTRICTED: 'bg-blue-950/80 border-blue-500/40 text-blue-300',
    UNAVAILABLE: 'bg-red-950/80 border-red-500/50 text-red-300',
    LOADING: 'bg-zinc-900 border-zinc-700 text-zinc-300',
  };

  const icons: Record<TelemetryNodeStatus | 'LOADING', React.ReactNode> = {
    OPERATIONAL: <CheckCircle2 size={10} />,
    TIMEOUT: <Clock size={10} />,
    DEGRADED: <AlertTriangle size={10} />,
    RESTRICTED: <ShieldAlert size={10} />,
    UNAVAILABLE: <WifiOff size={10} />,
    LOADING: <RotateCw size={10} className="animate-spin" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${styles[status]}`}
    >
      {icons[status]}
      {label ? `${label}: ${status}` : status}
    </span>
  );
};

interface WidgetFailureNoticeProps {
  widgetName: string;
  status: TelemetryNodeStatus;
  error?: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  compact?: boolean;
}

export const WidgetFailureNotice: React.FC<WidgetFailureNoticeProps> = ({
  widgetName,
  status,
  error,
  onRetry,
  isRetrying = false,
  compact = false,
}) => {
  if (status === 'OPERATIONAL') return null;

  const isTimeout = status === 'TIMEOUT';
  const isRestricted = status === 'RESTRICTED';
  const isUnavailable = status === 'UNAVAILABLE';

  const containerStyle = isTimeout
    ? 'bg-orange-950/50 border-orange-500/50 text-orange-200'
    : isRestricted
    ? 'bg-blue-950/40 border-blue-500/40 text-blue-200'
    : isUnavailable
    ? 'bg-red-950/50 border-red-500/50 text-red-200'
    : 'bg-amber-950/50 border-amber-500/40 text-amber-200';

  const title = isTimeout
    ? `${widgetName}: Statement Timeout (57014)`
    : isRestricted
    ? `${widgetName}: Access Restricted`
    : isUnavailable
    ? `${widgetName}: Telemetry Unavailable`
    : `${widgetName}: Telemetry Degraded`;

  const hint = isTimeout
    ? 'Database canceled the query to protect server latency. Narrow the date window or retry this widget.'
    : error || 'Live telemetry did not complete cleanly.';

  return (
    <div
      className={`rounded-xl border flex items-center justify-between gap-3 font-mono ${
        compact ? 'px-3 py-2 text-[10px]' : 'px-4 py-3 text-xs'
      } ${containerStyle}`}
    >
      <div className="flex items-start gap-2 min-w-0">
        {isTimeout ? (
          <Clock size={compact ? 13 : 15} className="text-orange-400 shrink-0 mt-0.5" />
        ) : isRestricted ? (
          <ShieldAlert size={compact ? 13 : 15} className="text-blue-400 shrink-0 mt-0.5" />
        ) : isUnavailable ? (
          <WifiOff size={compact ? 13 : 15} className="text-red-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle size={compact ? 13 : 15} className="text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{title}</span>
            <WidgetStatusBadge status={status} />
          </div>
          <p className="opacity-85 mt-0.5 break-words">{hint}</p>
          {isTimeout && error && (
            <p className="mt-1 text-[10px] opacity-75 break-all border-t border-orange-500/20 pt-1">
              {error}
            </p>
          )}
        </div>
      </div>

      {onRetry && !isRestricted && !isUnavailable && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="px-2.5 py-1 rounded-lg bg-[#121212] border border-current/40 hover:bg-[#1E1E1E] text-[10px] font-bold flex items-center gap-1 shrink-0 disabled:opacity-50"
        >
          <RotateCw size={11} className={isRetrying ? 'animate-spin' : ''} />
          Retry
        </button>
      )}
    </div>
  );
};
