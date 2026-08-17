import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppStore } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  PlusCircle, 
  Bell, 
  User, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Sliders
} from 'lucide-react';

// Form schema with Zod
const noteSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters long' }),
  category: z.string().min(2, { message: 'Category is required' }),
});

type NoteFormData = z.infer<typeof noteSchema>;

export const Dashboard: React.FC = () => {
  // Zustand Store
  const { counter, incrementCounter, decrementCounter, notifications, addNotification, user } = useAppStore();

  // React Hook Form + Zod
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      title: '',
      category: 'General',
    },
  });

  // TanStack Query fetching backend Fastify health status
  const { data: healthData, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['fastify-health'],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:3000/health');
        if (!res.ok) throw new Error('API server returned non-200');
        return await res.json();
      } catch {
        // Mock fallback if API dev server isn't actively listening on 3000
        return {
          status: 'ok (simulated)',
          timestamp: new Date().toISOString(),
          uptime: 120.45,
          note: 'Start Fastify backend with "npm run dev" in /api folder',
        };
      }
    },
    refetchInterval: 10000,
  });

  const onSubmit = (data: NoteFormData) => {
    addNotification(`New note added: "${data.title}" [${data.category}]`);
    reset();
  };

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">System Dashboard</h1>
          <p className="text-sm text-slate-400">Live inspection of state stores, forms, and API queries.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-2 py-1 px-3 border-indigo-500/30 text-indigo-300">
            <User className="w-3.5 h-3.5" /> {user.name} ({user.role})
          </Badge>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card 1: TanStack Query API Health */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg font-bold">Fastify API Health</CardTitle>
            <Activity className="w-5 h-5 text-indigo-400" />
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Status</span>
              {isLoading ? (
                <Badge variant="secondary">Loading...</Badge>
              ) : isError ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" /> Error
                </Badge>
              ) : (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {healthData?.status}
                </Badge>
              )}
            </div>

            <div className="space-y-1 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Timestamp:</span>
                <span className="text-slate-200">{healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Uptime:</span>
                <span className="text-slate-200">{healthData?.uptime ? `${Math.round(healthData.uptime)}s` : 'N/A'}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()} 
              disabled={isRefetching}
              className="w-full gap-2 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} /> Refetch API Status
            </Button>
          </CardFooter>
        </Card>

        {/* Card 2: Zustand Store State Controls */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg font-bold">Zustand Reactive Store</CardTitle>
            <Sliders className="w-5 h-5 text-purple-400" />
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="text-center py-2">
              <span className="text-xs uppercase tracking-wider text-slate-400 block mb-1">State Counter Value</span>
              <span className="text-5xl font-extrabold text-white gradient-text">{counter}</span>
            </div>
            <div className="flex gap-3">
              <Button onClick={decrementCounter} variant="outline" className="flex-1 font-bold">- 1</Button>
              <Button onClick={incrementCounter} variant="default" className="flex-1 font-bold">+ 1</Button>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-slate-400 border-t border-slate-800/60 pt-3">
            State updates reflect globally across all subscribed components.
          </CardFooter>
        </Card>

        {/* Card 3: React Hook Form + Zod Validation */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg font-bold">React Hook Form + Zod</CardTitle>
            <PlusCircle className="w-5 h-5 text-emerald-400" />
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Note Title</label>
                <Input 
                  placeholder="e.g. Implement Convex auth" 
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-xs text-red-400">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Category</label>
                <Input 
                  placeholder="e.g. Feature" 
                  {...register('category')}
                />
                {errors.category && (
                  <p className="text-xs text-red-400">{errors.category.message}</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" variant="gradient" disabled={isSubmitting} className="w-full gap-2 text-xs">
                Submit Validated Item
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>

      {/* Notifications Feed from Zustand */}
      <Card className="glass-panel">
        <CardHeader className="flex flex-row items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          <div>
            <CardTitle className="text-xl">Notification Stream</CardTitle>
            <CardDescription>Live events recorded in Zustand state store.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {notifications.map((note, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-200"
              >
                <span>{note}</span>
                <Badge variant="secondary" className="text-[10px]">Just Now</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
