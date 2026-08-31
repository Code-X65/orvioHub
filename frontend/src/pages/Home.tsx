import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  ShieldCheck, 
  ArrowRight, 
  Database,
  Terminal,
  Sparkles
} from 'lucide-react';

const techStack = [
  { name: 'React 19', category: 'UI Library', desc: 'Latest concurrent features & server actions support', color: 'from-cyan-500 to-blue-500' },
  { name: 'Vite', category: 'Build Tool', desc: 'Instant HMR and lightning fast ESM bundling', color: 'from-purple-500 to-pink-500' },
  { name: 'TypeScript', category: 'Language', desc: 'End-to-end type safety & rich IDE autocomplete', color: 'from-blue-600 to-indigo-600' },
  { name: 'Tailwind CSS v4', category: 'Styling', desc: 'Utility-first CSS framework with dynamic design tokens', color: 'from-teal-400 to-emerald-500' },
  { name: 'shadcn/ui', category: 'Design System', desc: 'Accessible, customizable component primitives', color: 'from-slate-400 to-slate-200' },
  { name: 'TanStack Query', category: 'Data Fetching', desc: 'Powerful asynchronous state management & caching', color: 'from-red-500 to-amber-500' },
  { name: 'Zustand', category: 'State', desc: 'Fast, scalable, unopinionated state management', color: 'from-amber-600 to-orange-500' },
  { name: 'React Hook Form + Zod', category: 'Forms', desc: 'Performant, flexible forms with type-safe schema validation', color: 'from-emerald-500 to-green-600' },
  { name: 'Convex DB', category: 'Database', desc: 'Reactive TypeScript database & serverless functions', color: 'from-indigo-400 to-purple-500' }
];

export const Home: React.FC = () => {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-4xl mx-auto pt-6">
        <Badge variant="default" className="px-4 py-1.5 text-sm gap-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          Fullstack Workspace Ready
        </Badge>
        
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
          orvio<span className="gradient-text">Hub</span> Ecosystem
        </h1>
        
        <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
          High-performance web architecture powered by React 19, Fastify backend, Convex reactive database, and shadcn/ui.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link to="/dashboard">
            <Button variant="gradient" size="lg" className="gap-2">
              Launch Dashboard <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <a href="http://localhost:3000/health" target="_blank" rel="noreferrer">
            <Button variant="outline" size="lg" className="gap-2">
              <Terminal className="w-5 h-5 text-indigo-400" /> Check Fastify API
            </Button>
          </a>
        </div>
      </section>

      {/* Tech Stack Matrix */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-white">Integrated Technology Stack</h2>
          <p className="text-slate-400">Pre-configured with industry standard tooling for modern web engineering.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {techStack.map((tech) => (
            <Card key={tech.name} className="glass-card border border-slate-800/80 hover:border-indigo-500/50 transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="text-xs text-slate-400 border-slate-700">
                    {tech.category}
                  </Badge>
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${tech.color}`} />
                </div>
                <CardTitle className="text-xl pt-2">{tech.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-slate-300 text-sm leading-normal">
                  {tech.desc}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* System Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
        <Card className="glass-panel p-6 space-y-3 border border-slate-800">
          <Zap className="w-10 h-10 text-amber-400" />
          <h3 className="text-xl font-bold text-white">Lightning Fast</h3>
          <p className="text-sm text-slate-400">Vite ESM bundling and Fastify low-overhead request routing deliver sub-millisecond response times.</p>
        </Card>

        <Card className="glass-panel p-6 space-y-3 border border-slate-800">
          <ShieldCheck className="w-10 h-10 text-emerald-400" />
          <h3 className="text-xl font-bold text-white">Strict Type Safety</h3>
          <p className="text-sm text-slate-400">End-to-end TypeScript definitions across React components, Zod schemas, and Convex models.</p>
        </Card>

        <Card className="glass-panel p-6 space-y-3 border border-slate-800">
          <Database className="w-10 h-10 text-indigo-400" />
          <h3 className="text-xl font-bold text-white">Reactive Backend</h3>
          <p className="text-sm text-slate-400">Convex DB reactive subscription model seamlessly synchronized with frontend query states.</p>
        </Card>
      </section>
    </div>
  );
};
