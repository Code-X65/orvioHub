import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Contact, 
  TrendingUp, 
  Package, 
  FileText, 
  Users2, 
  FolderKanban, 
  BarChart2, 
  Settings, 
  Search, 
  Bell, 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronDown, 
  CheckCircle2, 
  Boxes, 
  UserPlus, 
  Maximize2, 
  CreditCard,
  Sparkles
} from 'lucide-react';

interface ChartPoint {
  month: string;
  value: number;
  label: string;
  x: number;
  y: number;
}

export const ProductShowcase: React.FC = () => {
  const [activeSidebarItem, setActiveSidebarItem] = useState('Dashboard');
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const [timeframe, setTimeframe] = useState('Monthly');

  // Chart data points for Revenue Overview (Jan - Jul)
  const chartPoints: ChartPoint[] = [
    { month: 'Jan', value: 12.4, label: '₦12.4M', x: 40, y: 155 },
    { month: 'Feb', value: 18.2, label: '₦18.2M', x: 130, y: 105 },
    { month: 'Mar', value: 15.6, label: '₦15.6M', x: 220, y: 128 },
    { month: 'Apr', value: 21.0, label: '₦21.0M', x: 310, y: 80 },
    { month: 'May', value: 19.4, label: '₦19.4M', x: 400, y: 95 },
    { month: 'Jun', value: 24.6, label: '₦24.6M', x: 490, y: 48 },
    { month: 'Jul', value: 26.8, label: '₦26.8M', x: 580, y: 32 },
  ];

  // SVG path generation
  const svgPath = `M ${chartPoints.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const svgAreaPath = `${svgPath} L 580,180 L 40,180 Z`;

  const sidebarItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'CRM', icon: Contact },
    { name: 'Sales', icon: TrendingUp },
    { name: 'Inventory', icon: Package },
    { name: 'Accounting', icon: FileText },
    { name: 'HR', icon: Users2 },
    { name: 'Projects', icon: FolderKanban },
    { name: 'Reports', icon: BarChart2 },
    { name: 'Settings', icon: Settings },
  ];

  const quickAccessApps = [
    { name: 'CRM', icon: Contact },
    { name: 'Sales', icon: TrendingUp },
    { name: 'Inventory', icon: Package },
    { name: 'HR', icon: Users2 },
    { name: 'Accounting', icon: FileText },
    { name: 'Projects', icon: FolderKanban },
  ];

  return (
    <div id="showcase" className="relative w-full max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16">
      
      {/* Background Ambient Radial Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[550px] bg-gradient-to-tr from-blue-400/15 via-sky-300/10 to-indigo-400/10 blur-3xl -z-10 rounded-full pointer-events-none" />

      {/* 3D Decorative Floating Assets */}
      
      {/* Left: 3D Translucent Blue Frosted Cube */}
      <div className="hidden xl:block absolute -left-6 top-[38%] -translate-y-1/2 z-20 pointer-events-none animate-float-slow">
        <div className="relative w-36 h-36">
          <img 
            src="/cube-3d.jpg" 
            alt="Translucent Cube 3D" 
            className="w-full h-full object-contain mix-blend-multiply drop-shadow-2xl opacity-95" 
          />
        </div>
      </div>

      {/* Right: 3D Vibrant Blue Torus Loop */}
      <div className="hidden xl:block absolute -right-6 top-[32%] -translate-y-1/2 z-20 pointer-events-none animate-float-reverse">
        <div className="relative w-40 h-40">
          <img 
            src="/loop-3d.jpg" 
            alt="Blue 3D Torus Loop" 
            className="w-full h-full object-contain mix-blend-multiply drop-shadow-2xl opacity-95" 
          />
        </div>
      </div>

      {/* TOP SHOWCASE CARD: "All your tools. One platform." with OrvioHub Logo & Connection Network */}
      <div className="relative mb-6 rounded-3xl bg-gradient-to-b from-white/95 to-blue-50/40 p-6 sm:p-8 md:p-10 border border-slate-200/90 shadow-xl shadow-blue-500/5 backdrop-blur-xl overflow-hidden text-center">
        
        {/* Subtle decorative grid/network lines background */}
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

        {/* Small header text */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/60 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>All your tools. One platform.</span>
        </div>

        {/* Central Logo Node with Visual Connection Lines */}
        <div className="relative flex items-center justify-center py-2 max-w-2xl mx-auto">
          
          {/* Left Connection Line with glowing node */}
          <div className="hidden sm:flex flex-1 items-center justify-end pr-6">
            <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-blue-300 to-blue-500 relative">
              <span className="absolute -top-1 left-1/4 w-2 h-2 rounded-full bg-blue-500 animate-ping opacity-60" />
              <span className="absolute -top-1 left-3/4 w-2 h-2 rounded-full bg-blue-600" />
            </div>
          </div>

          {/* Main Logo Container */}
          <div className="relative z-10 px-6 py-2.5 rounded-2xl bg-white/90 shadow-md shadow-blue-500/10 border border-blue-100 flex items-center justify-center">
            <img 
              src="/orvio-logo.png" 
              alt="OrvioHub" 
              className="h-10 sm:h-12 w-auto object-contain" 
            />
          </div>

          {/* Right Connection Line with glowing node */}
          <div className="hidden sm:flex flex-1 items-center justify-start pl-6">
            <div className="w-full h-[2px] bg-gradient-to-r from-blue-500 via-blue-300 to-transparent relative">
              <span className="absolute -top-1 left-1/4 w-2 h-2 rounded-full bg-blue-600" />
              <span className="absolute -top-1 left-3/4 w-2 h-2 rounded-full bg-blue-500 animate-ping opacity-60" />
            </div>
          </div>

        </div>
      </div>

      {/* MAIN DASHBOARD MOCKUP CONTAINER */}
      <div className="relative w-full rounded-3xl bg-white border border-slate-200/90 shadow-2xl shadow-slate-900/8 overflow-hidden">
        
        {/* Top Browser Bar Decoration */}
        <div className="h-10 bg-slate-50/90 border-b border-slate-200/70 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-amber-400/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-slate-200/60 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>app.orviohub.com/dashboard</span>
          </div>
          <div className="w-12" />
        </div>

        {/* Dashboard Body with Sidebar & Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
          
          {/* LEFT SIDEBAR (lg:col-span-2) */}
          <aside className="hidden lg:flex lg:col-span-2 flex-col justify-between p-4 bg-slate-50/50 border-r border-slate-100">
            <div className="space-y-6">
              
              {/* Mini Brand Logo */}
              <div className="px-3 py-2 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-sm bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-500/30">
                  O
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 leading-tight">OrvioHub</span>
                  <span className="text-[10px] text-slate-500 font-medium">Enterprise Hub</span>
                </div>
              </div>

              {/* Navigation Menu List */}
              <nav className="space-y-1">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSidebarItem === item.name;
                  return (
                    <button
                      key={item.name}
                      onClick={() => setActiveSidebarItem(item.name)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-sm text-xs font-semibold transition-all duration-200 ${
                        isActive
                          ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/25'
                          : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                        <span>{item.name}</span>
                      </div>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Support / Upgrade Card */}
            <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-100 text-left">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs mb-1">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Connected Plan</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">All 8 core modules synced in real-time.</p>
            </div>
          </aside>

          {/* MAIN DASHBOARD CONTENT AREA (lg:col-span-10) */}
          <main className="lg:col-span-10 p-5 sm:p-7 md:p-8 bg-[#FCFDFF] relative">
            
            {/* Top Bar Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                  <span>Overview</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                    Live System
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Real-time enterprise metrics and active streams</p>
              </div>

              {/* Search & Actions */}
              <div className="flex items-center gap-3">
                <div className="relative hidden sm:block w-56 md:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search apps, records..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
                    readOnly
                    value=""
                  />
                </div>

                <button className="relative p-2 rounded-sm bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-2xs">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600" />
                </button>

                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-semibold text-xs flex items-center justify-center shadow-xs">
                    AO
                  </div>
                  <div className="hidden md:block text-left text-xs">
                    <div className="font-bold text-slate-800 leading-tight">Alex O.</div>
                    <div className="text-[10px] text-slate-400">Admin</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 METRIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 my-6">
              
              {/* Metric 1: Total Revenue */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-200 transition-all duration-200 group">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Total Revenue</span>
                  <div className="w-8 h-8 rounded-sm bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  ₦24.6M
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>+12.5%</span>
                  </div>
                  <span className="text-[10px] text-slate-400">vs last month</span>
                </div>
              </div>

              {/* Metric 2: New Customers */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-200 transition-all duration-200 group">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">New Customers</span>
                  <div className="w-8 h-8 rounded-sm bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Users2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  1,245
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>+8.2%</span>
                  </div>
                  <span className="text-[10px] text-slate-400">vs last month</span>
                </div>
              </div>

              {/* Metric 3: Total Orders */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-200 transition-all duration-200 group">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Total Orders</span>
                  <div className="w-8 h-8 rounded-sm bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  2,456
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>+15.3%</span>
                  </div>
                  <span className="text-[10px] text-slate-400">vs last month</span>
                </div>
              </div>

              {/* Metric 4: Expenses */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-200 transition-all duration-200 group">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold">Expenses</span>
                  <div className="w-8 h-8 rounded-sm bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  ₦8.95M
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                    <ArrowDownRight className="w-3 h-3" />
                    <span>-3.6%</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Optimized</span>
                </div>
              </div>

            </div>

            {/* LOWER CONTENT: REVENUE OVERVIEW CHART & RECENT ACTIVITIES */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* REVENUE OVERVIEW CHART (lg:col-span-7) */}
              <div className="lg:col-span-7 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                
                {/* Chart Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Revenue Overview</h3>
                    <p className="text-[11px] text-slate-500">Consolidated cashflow across CRM, Sales & Invoicing</p>
                  </div>

                  {/* Filter dropdown */}
                  <div className="relative">
                    <button 
                      onClick={() => setTimeframe(timeframe === 'Monthly' ? 'Quarterly' : 'Monthly')}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus:outline-none"
                    >
                      <span>Time: {timeframe}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                </div>

                {/* SVG Line Graph */}
                <div className="relative w-full h-[220px] pt-4">
                  
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                    <div className="border-b border-slate-100 w-full flex justify-between text-[10px] text-slate-400 pr-2"><span>₦30M</span></div>
                    <div className="border-b border-slate-100 w-full flex justify-between text-[10px] text-slate-400 pr-2"><span>₦20M</span></div>
                    <div className="border-b border-slate-100 w-full flex justify-between text-[10px] text-slate-400 pr-2"><span>₦10M</span></div>
                    <div className="border-b border-slate-200 w-full flex justify-between text-[10px] text-slate-400 pr-2"><span>₦0</span></div>
                  </div>

                  {/* Chart SVG */}
                  <svg className="w-full h-[180px] overflow-visible" viewBox="0 0 620 180">
                    <defs>
                      <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0066FF" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#0066FF" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Area fill */}
                    <path
                      d={svgAreaPath}
                      fill="url(#blueGradient)"
                    />

                    {/* Blue line */}
                    <path
                      d={svgPath}
                      fill="none"
                      stroke="#0066FF"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive Points */}
                    {chartPoints.map((point) => (
                      <g key={point.month}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={hoveredPoint?.month === point.month ? "6" : "4"}
                          className={`cursor-pointer transition-all duration-150 ${
                            hoveredPoint?.month === point.month 
                              ? 'fill-[#0066FF] stroke-white stroke-2' 
                              : 'fill-white stroke-[#0066FF] stroke-2 hover:fill-[#0066FF]'
                          }`}
                          onMouseEnter={() => setHoveredPoint(point)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      </g>
                    ))}
                  </svg>

                  {/* Tooltip */}
                  {hoveredPoint && (
                    <div 
                      className="absolute bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full mb-2 z-30 transition-all duration-150"
                      style={{
                        left: `${(hoveredPoint.x / 620) * 100}%`,
                        top: `${hoveredPoint.y}px`
                      }}
                    >
                      {hoveredPoint.month}: {hoveredPoint.label}
                    </div>
                  )}

                  {/* Month X-Axis Labels */}
                  <div className="flex justify-between px-4 mt-2 text-[11px] font-semibold text-slate-400">
                    {chartPoints.map((p) => (
                      <span key={p.month} className={hoveredPoint?.month === p.month ? 'text-blue-600 font-bold' : ''}>
                        {p.month}
                      </span>
                    ))}
                  </div>

                </div>

              </div>

              {/* RECENT ACTIVITIES PANEL (lg:col-span-5) */}
              <div className="lg:col-span-5 p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900">Recent Activities</h3>
                  <span className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer">
                    View all
                  </span>
                </div>

                <div className="space-y-3">
                  
                  {/* Activity 1 */}
                  <div className="flex items-center justify-between p-2.5 rounded-sm hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">New order #ORD-3842</div>
                        <div className="text-[10px] text-slate-500">Sales • Lagos Storefront</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">2m ago</span>
                  </div>

                  {/* Activity 2 */}
                  <div className="flex items-center justify-between p-2.5 rounded-sm hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Payroll processed</div>
                        <div className="text-[10px] text-slate-500">HR • 48 Employees</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">1h ago</span>
                  </div>

                  {/* Activity 3 */}
                  <div className="flex items-center justify-between p-2.5 rounded-sm hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Stock updated</div>
                        <div className="text-[10px] text-slate-500">Inventory • +150 Units</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">3h ago</span>
                  </div>

                  {/* Activity 4 */}
                  <div className="flex items-center justify-between p-2.5 rounded-sm hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">Invoice sent</div>
                        <div className="text-[10px] text-slate-500">Accounting • #INV-9201</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">5h ago</span>
                  </div>

                  {/* Activity 5 */}
                  <div className="flex items-center justify-between p-2.5 rounded-sm hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">New employee added</div>
                        <div className="text-[10px] text-slate-500">HR • Engineering Dept</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">1d ago</span>
                  </div>

                </div>
              </div>

            </div>

          </main>

        </div>

      </div>

      {/* FLOATING QUICK ACCESS PANEL (Mobile-Style Card overlapping right side) */}
      <div className="hidden lg:block absolute right-8 bottom-6 w-80 rounded-3xl orvio-floating-panel p-5 z-30 animate-float-slow shadow-2xl">
        
        {/* Floating Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              O
            </div>
            <span className="text-xs font-bold text-slate-900">OrvioHub</span>
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-600">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Access Grid */}
        <div className="mt-3.5">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5">
            Quick Access
          </div>

          <div className="grid grid-cols-3 gap-2">
            {quickAccessApps.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  key={app.name}
                  className="flex flex-col items-center justify-center p-2 rounded-sm bg-slate-50/90 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 transition-all duration-150 group"
                >
                  <div className="w-7 h-7 rounded-lg bg-white shadow-2xs flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 group-hover:text-blue-600 mt-1">
                    {app.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Unread Notifications in Floating Card */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
            <span>Unread Notifications</span>
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center font-bold">2</span>
          </div>

          <div className="space-y-2">
            
            {/* Notification 1 */}
            <div className="flex items-start gap-2.5 p-2 rounded-sm bg-amber-50/60 border border-amber-200/60">
              <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
              <div className="text-left">
                <div className="text-[11px] font-bold text-slate-800 leading-tight">Low stock alert</div>
                <div className="text-[9px] text-slate-500">Inventory • 1h ago</div>
              </div>
            </div>

            {/* Notification 2 */}
            <div className="flex items-start gap-2.5 p-2 rounded-sm bg-blue-50/60 border border-blue-200/60">
              <span className="w-2 h-2 rounded-full bg-blue-600 mt-1 shrink-0" />
              <div className="text-left">
                <div className="text-[11px] font-bold text-slate-800 leading-tight">Leave request</div>
                <div className="text-[9px] text-slate-500">HR • 2h ago</div>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
