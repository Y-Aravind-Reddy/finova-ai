import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const isNonRetryableError = (error: unknown): boolean => {
  if (!error) return false;
  const anyErr = error as Record<string, any>;
  const code = String(anyErr?.code || '').toUpperCase();
  const status = Number(anyErr?.status || 0);
  const msg = String(anyErr?.message || (typeof error === 'string' ? error : '')).toLowerCase();
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    status === 401 ||
    status === 403 ||
    msg.includes('permission denied') ||
    msg.includes('access denied') ||
    msg.includes('unauthorized') ||
    msg.includes('row-level security')
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error) => !isNonRetryableError(error) && failureCount < 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
