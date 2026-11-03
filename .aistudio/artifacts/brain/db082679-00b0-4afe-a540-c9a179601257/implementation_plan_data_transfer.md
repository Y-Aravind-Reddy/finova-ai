# Implementation Plan - Finova AI Data & Transfer Intelligence

This plan outlines the architecture and steps for integrating the new **Data & Transfer Intelligence** section into the Finova AI platform.

## 1. Routing & Access Control
- **Target Roles**: `SUPER_ADMIN`, `ADMIN`.
- **New Routes**:
  - `/super-admin/data-transfer/overview` | `/admin/data-transfer/overview`
  - `/super-admin/data-transfer/settlements` | `/admin/data-transfer/settlements`
  - `/super-admin/data-transfer/transactions` | `/admin/data-transfer/transactions`
  - `/super-admin/data-transfer/reconciliation` | `/admin/data-transfer/reconciliation`
  - `/super-admin/data-transfer/exceptions` | `/admin/data-transfer/exceptions`
- **Metadata**: Add to `ROUTES` and `isRouteAllowed` in `src/routes/routesConfig.ts`.

## 2. Sidebar Integration
- **Component**: `src/components/RoleSidebar.tsx`.
- **New Section**: "DATA & TRANSFER INTELLIGENCE" as an expandable group below "Platform Engines".
- **Interaction**: Toggle state for collapse/expand, active route highlighting.

## 3. Data Architecture (Supabase)
- **Source**: Unified `transactions` table for all 5 pages.
- **Service Layer**: Create `src/services/transferIntelligenceService.ts` to handle specific aggregations:
    - `fetchTransferOverviewAggregates`: Total volume, status distribution, category mix.
    - `fetchSettlementMetrics`: Success/Pending/Failed settlement counts.
    - `fetchPaginatedTransactions`: Detailed surveillance records with filters.
    - `fetchReconciliationData`: Comparing expected vs actual amounts (if fields exist).
    - `fetchTransferExceptions`: Filtering for 'Failed' status and error codes.
- **Performance**: Heavy use of React Query for caching and progressive loading.

## 4. UI/UX Development
- **Visuals**: Maintain "Finova Gold" aesthetic (black background, metallic gold accents, Serif headings).
- **3D Components**:
    - `TransferFlowRibbon`: 3D Ribbon chart for settlement velocity.
    - `StatusDonut3D`: Distribution of success/pending/failed.
    - `IsometricPerformanceBars`: Channel and currency performance.
- **Table Components**: High-density 2D financial tables with search, filters, and pagination.
- **Detail Views**: Side drawers for transaction deep-dives.

## 5. Implementation Phases
1.  **Phase 1**: Configure routes and sidebar UI.
2.  **Phase 2**: Implement `transferIntelligenceService` for base aggregations.
3.  **Phase 3**: Build "Transfer Overview" with 3D visualizations.
4.  **Phase 4**: Build "Settlement Monitoring" and "Transaction Records".
5.  **Phase 5**: Build "Reconciliation" and "Exceptions" monitoring.
6.  **Phase 6**: Optimization (progressive loading, skeletons, caching).
