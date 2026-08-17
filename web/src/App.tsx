import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { LayoutDashboard, Home as HomeIcon, Server } from 'lucide-react';

export const App: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform">
              <Server className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              orvio<span className="gradient-text">Hub</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2">
            <Link to="/">
              <Button 
                variant={location.pathname === '/' ? 'secondary' : 'ghost'} 
                size="sm"
                className="gap-2"
              >
                <HomeIcon className="w-4 h-4" /> Home
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button 
                variant={location.pathname === '/dashboard' ? 'secondary' : 'ghost'} 
                size="sm"
                className="gap-2"
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Button>
            </Link>
          </nav>

          {/* Status Badge & External Actions */}
          <div className="hidden sm:flex items-center gap-3">
            <Badge variant="success" className="gap-1 py-1 px-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              API Connected
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} orvioHub Ecosystem. Built with React 19, Fastify & Convex.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>React 19</span> • <span>Tailwind v4</span> • <span>shadcn/ui</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
