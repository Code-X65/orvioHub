import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import { initObservability } from './lib/observability';
import App from './App';
import './index.css';

initObservability();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

const FallbackComponent = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 text-center">
    <div className="max-w-md space-y-4">
      <h2 className="text-2xl font-bold text-red-400">Application Error</h2>
      <p className="text-sm text-slate-400">An unexpected exception occurred. The error has been captured and reported.</p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-medium text-sm transition-all cursor-pointer"
      >
        Reload Application
      </button>
    </div>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<FallbackComponent />}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
);
