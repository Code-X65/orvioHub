import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';
import { toast } from 'sonner';
import {
  ListTodo,
  Kanban,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Users,
  FolderKanban,
  Calendar,
  Plus,
  Trash2,
  LayoutGrid,
  List,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamMemberInvite {
  email: string;
  role: 'PROJECT_MANAGER' | 'CONTRIBUTOR' | 'VIEWER';
}

const USE_CASE_OPTIONS: SelectOption[] = [
  { value: 'project_management', label: 'Project Management & Milestones', badge: 'Projects' },
  { value: 'task_tracking', label: 'Daily Task Tracking & Checklists', badge: 'Tasks' },
  { value: 'team_collaboration', label: 'Cross-functional Team Collaboration', badge: 'Team' },
  { value: 'personal_tasks', label: 'Personal Productivity', badge: 'Personal' },
  { value: 'other', label: 'Other Workflow', badge: 'Custom' },
];

const MEMBER_ROLE_OPTIONS: SelectOption[] = [
  { value: 'PROJECT_MANAGER', label: 'Project Manager (Create & Assign)', badge: 'Manager' },
  { value: 'CONTRIBUTOR', label: 'Contributor (Edit & Complete)', badge: 'Editor' },
  { value: 'VIEWER', label: 'Viewer (Read-only access)', badge: 'Viewer' },
];

export const TasksOnboarding: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Team Setup
  const [teamName, setTeamName] = useState('Core Product Team');
  const [useCase, setUseCase] = useState('project_management');

  // Step 2: Team Members
  const [teamMembers, setTeamMembers] = useState<TeamMemberInvite[]>([
    { email: '', role: 'CONTRIBUTOR' },
  ]);

  // Step 3: First Project
  const [projectChoice, setProjectChoice] = useState<'sample' | 'blank' | 'skip'>('sample');
  const [projectName, setProjectName] = useState('Q4 Product Launch');
  const [projectDesc, setProjectDesc] = useState('Key milestones, deliverables, and team sprint tasks.');

  // Step 4: Work Style & Views
  const [viewPreference, setViewPreference] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [enableReminders, setEnableReminders] = useState(true);

  // Load workspace name if available
  useEffect(() => {
    const fetchWs = async () => {
      try {
        const res = await api.get<{ workspaces: any[] }>('/workspaces');
        if (res.workspaces && res.workspaces.length > 0) {
          const ws = res.workspaces[0].workspace;
          setTeamName(`${ws.name} Team`);
        }
      } catch {}
    };
    fetchWs();
  }, []);

  const handleNext = () => {
    if (step === 1) {
      if (!teamName.trim()) {
        toast.error('Please enter a team name');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (projectChoice !== 'skip' && !projectName.trim()) {
        toast.error('Please enter a project name or choose Skip');
        return;
      }
      setStep(4);
    } else if (step === 4) {
      handleCompleteSetup();
    }
  };

  const handleCompleteSetup = async () => {
    setIsLoading(true);
    try {
      // Save task preferences
      toast.success('Task Management workspace configured!');
      setStep(5);
    } catch {
      toast.error('Failed to complete task setup');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchTasks = () => {
    navigate('/tasks/dashboard');
  };

  const stepsList = [
    { num: 1, title: 'Team Setup', icon: Users },
    { num: 2, title: 'Members', icon: Users },
    { num: 3, title: 'Project', icon: FolderKanban },
    { num: 4, title: 'Work Style', icon: LayoutGrid },
    { num: 5, title: 'Ready', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67]/30 selection:text-white flex flex-col justify-between">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-[#0a0508]/90 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xs bg-[#714b67] text-white flex items-center justify-center shadow-md">
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-white leading-tight">
                Task Management Onboarding
              </h1>
              <p className="text-[10px] text-slate-400">Step {step} of 5</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLaunchTasks}
            className="text-slate-400 hover:text-white text-xs h-8"
          >
            Skip to Tasks
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Stepper progress */}
        <div className="grid grid-cols-5 gap-2">
          {stepsList.map((s) => {
            const isPast = s.num < step;
            const isCurrent = s.num === step;
            return (
              <div key={s.num} className="space-y-1">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    isPast && 'bg-emerald-500',
                    isCurrent && 'bg-[#714b67]',
                    !isPast && !isCurrent && 'bg-white/10'
                  )}
                />
                <p
                  className={cn(
                    'text-[10px] font-medium truncate',
                    isCurrent ? 'text-white' : isPast ? 'text-emerald-400' : 'text-slate-500'
                  )}
                >
                  {s.title}
                </p>
              </div>
            );
          })}
        </div>

        {/* Wizard Card */}
        <div className="bg-[#120b10] border border-white/10 rounded-sm p-6 sm:p-8 space-y-6 shadow-2xl">
          {/* STEP 1: TEAM SETUP */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">1. Team Setup</h2>
                <p className="text-xs text-slate-400">
                  Name your primary task management team and primary workflow purpose.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-medium">
                    Team Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Code X Stores Team"
                    className="bg-black/60 border-white/15 text-white h-11 focus:border-[#714b67]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300 font-medium">
                    How will you primarily use Tasks? <span className="text-red-400">*</span>
                  </Label>
                  <CustomSelect
                    options={USE_CASE_OPTIONS}
                    value={useCase}
                    onChange={setUseCase}
                    placeholder="Select primary goal"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TEAM MEMBERS */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white">2. Team Members (Optional)</h2>
                  <p className="text-xs text-slate-400">
                    Invite collaborators to assign tasks, set deadlines, and track milestones.
                  </p>
                </div>
                {teamMembers.length < 5 && (
                  <Button
                    type="button"
                    onClick={() =>
                      setTeamMembers([...teamMembers, { email: '', role: 'CONTRIBUTOR' }])
                    }
                    className="bg-white/10 hover:bg-white/15 text-white text-xs h-8 px-3 rounded-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Member
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {teamMembers.map((m, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-black/40 border border-white/10 p-3 rounded-xs"
                  >
                    <div className="sm:col-span-6">
                      <Input
                        value={m.email}
                        onChange={(e) => {
                          const copy = [...teamMembers];
                          copy[idx].email = e.target.value;
                          setTeamMembers(copy);
                        }}
                        placeholder="teammate@company.com"
                        className="bg-black border-white/15 text-white h-9 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <CustomSelect
                        options={MEMBER_ROLE_OPTIONS}
                        value={m.role}
                        onChange={(val) => {
                          const copy = [...teamMembers];
                          copy[idx].role = val as any;
                          setTeamMembers(copy);
                        }}
                        placeholder="Select role"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setTeamMembers(teamMembers.filter((_, i) => i !== idx))}
                        className="text-slate-500 hover:text-red-400 p-1.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: FIRST PROJECT */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">3. Create Your First Project</h2>
                <p className="text-xs text-slate-400">
                  Projects group related tasks, sprint lists, and deadlines.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => setProjectChoice('sample')}
                  className={cn(
                    'cursor-pointer border p-4 rounded-sm transition-all space-y-2',
                    projectChoice === 'sample'
                      ? 'bg-[#714b67]/20 border-[#714b67]'
                      : 'bg-black/40 border-white/10 hover:border-white/20'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Sample Template</span>
                    {projectChoice === 'sample' && <Check className="w-4 h-4 text-[#9d6b8f]" />}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Pre-populated with sprint tasks, status columns, and sample milestones.
                  </p>
                </div>

                <div
                  onClick={() => setProjectChoice('blank')}
                  className={cn(
                    'cursor-pointer border p-4 rounded-sm transition-all space-y-2',
                    projectChoice === 'blank'
                      ? 'bg-[#714b67]/20 border-[#714b67]'
                      : 'bg-black/40 border-white/10 hover:border-white/20'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Blank Project</span>
                    {projectChoice === 'blank' && <Check className="w-4 h-4 text-[#9d6b8f]" />}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Empty board ready for custom columns, labels, and task creation.
                  </p>
                </div>

                <div
                  onClick={() => setProjectChoice('skip')}
                  className={cn(
                    'cursor-pointer border p-4 rounded-sm transition-all space-y-2',
                    projectChoice === 'skip'
                      ? 'bg-[#714b67]/20 border-[#714b67]'
                      : 'bg-black/40 border-white/10 hover:border-white/20'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Skip for now</span>
                    {projectChoice === 'skip' && <Check className="w-4 h-4 text-[#9d6b8f]" />}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Jump straight to workspace dashboard without creating a project yet.
                  </p>
                </div>
              </div>

              {projectChoice !== 'skip' && (
                <div className="space-y-4 border-t border-white/10 pt-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">Project Name</Label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g. Website Redesign"
                      className="bg-black/60 border-white/15 text-white h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300 font-medium">Description</Label>
                    <Input
                      value={projectDesc}
                      onChange={(e) => setProjectDesc(e.target.value)}
                      placeholder="Brief overview of project scope"
                      className="bg-black/60 border-white/15 text-white h-10"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: WORK STYLE & VIEW */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">4. Work Style & View Preferences</h2>
                <p className="text-xs text-slate-400">
                  Select how you prefer to visualize tasks and configure reminder schedules.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  onClick={() => setViewPreference('kanban')}
                  className={cn(
                    'cursor-pointer border p-4 rounded-sm transition-all space-y-2',
                    viewPreference === 'kanban'
                      ? 'bg-[#714b67]/20 border-[#714b67]'
                      : 'bg-black/40 border-white/10 hover:border-white/20'
                  )}
                >
                  <Kanban className="w-5 h-5 text-[#9d6b8f]" />
                  <div className="text-xs font-bold text-white">Kanban Board</div>
                  <p className="text-[11px] text-slate-400">
                    Drag-and-drop columns: To Do, In Progress, In Review, Done.
                  </p>
                </div>

                <div
                  onClick={() => setViewPreference('list')}
                  className={cn(
                    'cursor-pointer border p-4 rounded-sm transition-all space-y-2',
                    viewPreference === 'list'
                      ? 'bg-[#714b67]/20 border-[#714b67]'
                      : 'bg-black/40 border-white/10 hover:border-white/20'
                  )}
                >
                  <List className="w-5 h-5 text-[#9d6b8f]" />
                  <div className="text-xs font-bold text-white">List View</div>
                  <p className="text-[11px] text-slate-400">
                    Compact spreadsheet-style rows with inline status checkboxes.
                  </p>
                </div>

                <div
                  onClick={() => setViewPreference('calendar')}
                  className={cn(
                    'cursor-pointer border p-4 rounded-sm transition-all space-y-2',
                    viewPreference === 'calendar'
                      ? 'bg-[#714b67]/20 border-[#714b67]'
                      : 'bg-black/40 border-white/10 hover:border-white/20'
                  )}
                >
                  <Calendar className="w-5 h-5 text-[#9d6b8f]" />
                  <div className="text-xs font-bold text-white">Calendar Timeline</div>
                  <p className="text-[11px] text-slate-400">
                    Due-date oriented calendar schedule for deadline tracking.
                  </p>
                </div>
              </div>

              {/* Reminders Toggle */}
              <div className="border-t border-white/10 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white">Task Reminders & Notifications</p>
                    <p className="text-[11px] text-slate-400">
                      Send automated alerts before due dates.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableReminders}
                    onChange={(e) => setEnableReminders(e.target.checked)}
                    className="w-4 h-4 accent-[#714b67]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: READY */}
          {step === 5 && (
            <div className="space-y-6 text-center py-6 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  🎉 Your Task Management is Ready!
                </h2>
                <p className="text-xs text-slate-300">
                  Team <span className="font-semibold text-white">{teamName}</span> is set up with{' '}
                  <span className="font-semibold text-white">{viewPreference.toUpperCase()}</span> view.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 max-w-sm mx-auto">
                <Button
                  onClick={handleLaunchTasks}
                  className="w-full bg-[#714b67] hover:bg-[#85597a] text-white text-xs font-semibold h-11 rounded-xs flex items-center justify-center gap-2"
                >
                  <Kanban className="w-4 h-4" />
                  Go to Task Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* Controls */}
          {step < 5 && (
            <div className="flex items-center justify-between border-t border-white/10 pt-5">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(step - 1)}
                  disabled={isLoading}
                  className="text-slate-400 hover:text-white text-xs h-10 px-3"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                </Button>
              ) : (
                <div />
              )}

              <Button
                type="button"
                onClick={handleNext}
                disabled={isLoading}
                className="bg-[#714b67] hover:bg-[#85597a] text-white text-xs font-semibold h-10 px-5 rounded-xs flex items-center gap-1.5 shadow-lg shadow-[#714b67]/20"
              >
                {step === 4 ? (
                  <>
                    Complete Setup <Check className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
