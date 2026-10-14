import React from 'react';
import { ChevronRight, Home, Shield } from 'lucide-react';
import { RouteMeta } from '../../routes/routesConfig';

interface BreadcrumbsProps {
  routeMeta: RouteMeta;
  onNavigateHome?: () => void;
  onNavigateCrumb?: (crumbIndex: number) => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  routeMeta,
  onNavigateHome,
}) => {
  const crumbs = routeMeta.breadcrumb || ['Finova AI', 'Dashboard'];

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#262626]/90 border border-[#3A3A3A] backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-1.5 text-[#D4A017] hover:text-[#E6C78B] transition-colors group"
        >
          <Home size={13} className="text-[#D4A017] group-hover:scale-110 transition-transform" />
          <span className="font-semibold tracking-wider">{crumbs[0] || 'Finova AI'}</span>
        </button>

        {crumbs.slice(1).map((crumb, idx) => {
          const isLast = idx === crumbs.length - 2;
          return (
            <React.Fragment key={idx}>
              <ChevronRight size={12} className="text-[#9CA3AF]/60" />
              <span
                className={`${
                  isLast
                    ? 'text-[#E6C78B] font-bold bg-[#121212] px-2.5 py-0.5 rounded-md border border-[#3A3A3A] shadow-[0_0_8px_rgba(212,160,23,0.15)]'
                    : 'text-[#9CA3AF]'
                }`}
              >
                {crumb}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px] font-mono text-[#9CA3AF]">
        <Shield size={12} className="text-[#D4A017]" />
        <span className="hidden sm:inline">Active Route:</span>
        <code className="text-[#E6C78B] bg-[#121212] px-2 py-0.5 rounded border border-[#3A3A3A] text-[10px]">
          {routeMeta.path}
        </code>
      </div>
    </nav>
  );
};
