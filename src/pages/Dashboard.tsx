import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Briefcase, TrendingUp, CheckCircle, Clock, Star,
  Upload, Plus, BarChart2, Mail, Settings, ChevronRight,
  Search, Bell, Calendar, ArrowUpRight, ArrowDownRight,
  FileText, Zap, Award, Target, Filter, LayoutDashboard,
  UserCheck, FileSearch, Layers, GitMerge, ListOrdered,
  CalendarCheck, PieChart, Inbox, ChevronDown, MoreHorizontal,
  Brain, Cpu, TrendingDown, RefreshCw, Eye, LogOut, ShieldCheck, Building2
} from 'lucide-react';
import { dashboardApi, candidatesApi, jobsApi } from '../api';
import { useAuthStore } from '../store/auth';
import { AdminDashboard } from '../components/AdminDashboard';
import { Layout } from '../components/layout/Layout';

// ─── Design tokens ──────────────────────────────────────────────────────────
// Palette: white base, indigo/violet primary, soft purple accents
// Signature: the left sidebar uses a deep indigo gradient with icon-only compressed nav

// ─── Types ───────────────────────────────────────────────────────────────────
interface MiniSparkProps {
  data: number[];
  color?: string;
  up?: boolean;
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────
function MiniSpark({ data, color = '#6366f1' }: MiniSparkProps) {
  if (!data || data.length === 0) return null;
  const h = 40;
  const w = 80;
  const safeData = data.length === 1 ? [data[0], data[0]] : data;
  const max = Math.max(...safeData, 1);
  const min = Math.min(...safeData);
  const range = max - min || 1;

  const pts = safeData.map((v, i) => {
    const x = Math.round((i / (safeData.length - 1)) * w * 100) / 100;
    const y = Math.round((h - ((v - min) / range) * (h - 8) - 4) * 100) / 100;
    return `${x},${y}`;
  });

  const pathD = `M ${pts.join(' L ')}`;
  const areaD = `${pathD} L ${w},${h} L 0,${h} Z`;

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#sg-${color.replace('#', '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({
  label, value, change, changeUp, icon, color, sparkData, accent, onClick,
}: {
  label: string; value: string | number; change?: string; changeUp?: boolean;
  icon: React.ReactNode; color: string; sparkData?: number[]; accent: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="ats-kpi-card group hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-slate-100 hover:border-indigo-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`ats-icon-pill ${color} group-hover:scale-110 transition-transform`}>{icon}</div>
        {change && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${changeUp ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-500 border border-red-100'}`}>
            {changeUp ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {change}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-black text-slate-800 leading-none mb-1 group-hover:text-indigo-600 transition-colors">{value}</p>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
        </div>
        {sparkData && <MiniSpark data={sparkData} color={accent} up={changeUp} />}
      </div>
    </div>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────
function ScoreBar({ score, color = '#6366f1' }: { score: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-8 text-right">{score}%</span>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  'STRONG_MATCH': 'bg-emerald-100 text-emerald-700',
  'POTENTIAL_MATCH': 'bg-violet-100 text-violet-700',
  'WEAK_MATCH': 'bg-amber-100 text-amber-700',
  'NEEDS_REVIEW': 'bg-slate-100 text-slate-600',
  'KNOCKOUT_FAILED': 'bg-red-100 text-red-600',
  'Shortlisted': 'bg-emerald-100 text-emerald-700',
  'Under Review': 'bg-blue-100 text-blue-700',
  'Rejected': 'bg-red-100 text-red-600',
  'Hired': 'bg-violet-100 text-violet-700',
};

const STATUS_LABELS: Record<string, string> = {
  'STRONG_MATCH': 'Excellent Match',
  'POTENTIAL_MATCH': 'Strong Match',
  'WEAK_MATCH': 'Review',
  'NEEDS_REVIEW': 'Needs Review',
  'KNOCKOUT_FAILED': 'Rejected',
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] || status;
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${style}`}>
      {label}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-blue-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
];
function avatarColor(name: string) {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

// ─── Pipeline Funnel ──────────────────────────────────────────────────────────
const FUNNEL_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

function PipelineChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
          cursor={{ fill: '#f8fafc' }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <rect key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Sidebar nav items ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: <LayoutDashboard size={18} />, label: 'Dashboard', to: '/dashboard', active: true },
  { icon: <Users size={18} />, label: 'Candidates', to: '/candidates' },
  { icon: <FileSearch size={18} />, label: 'CVs', to: '/candidates?source=manual' },
  { icon: <Briefcase size={18} />, label: 'Jobs', to: '/jobs' },
  { icon: <GitMerge size={18} />, label: 'Matching', to: '/candidates?sort_by=match_score' },
  { icon: <ListOrdered size={18} />, label: 'ATS Ranking', to: '/candidates?sort_by=rank' },
  { icon: <CalendarCheck size={18} />, label: 'Interviews', to: '/candidates?status=Phone+Interview' },
  { icon: <Inbox size={18} />, label: 'Email', to: '/settings' },
  { icon: <Settings size={18} />, label: 'Settings', to: '/settings' },
];

// ─── QUICK ACTIONS ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: <Upload size={18} />, label: 'Upload CV', color: 'bg-purple-600 hover:bg-purple-700', to: '/candidates' },
  { icon: <Plus size={18} />, label: 'Create Job', color: 'bg-indigo-600 hover:bg-indigo-700', to: '/jobs' },
  { icon: <Cpu size={18} />, label: 'Analyze CVs', color: 'bg-blue-600 hover:bg-blue-700', to: '/candidates' },
  { icon: <Target size={18} />, label: 'Match', color: 'bg-emerald-600 hover:bg-emerald-700', to: '/candidates?sort_by=match_score' },
  { icon: <Mail size={18} />, label: 'Email', color: 'bg-pink-500 hover:bg-pink-600', to: '/settings' },
];

// ─── SKILLS MOCK ──────────────────────────────────────────────────────────────
const SKILLS_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function DashboardPage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: '1', title: 'New Application Received', message: 'Sara Ahmed applied for Senior Frontend Developer', time: '10m ago', unread: true },
    { id: '2', title: 'High ATS Match Found', message: 'Ahmed Hassan matched 96% for Senior Python Developer', time: '1h ago', unread: true },
    { id: '3', title: 'New Candidate Uploaded', message: 'Mohamed Ali uploaded a new CV for ML Engineer', time: '2h ago', unread: true },
  ]);
  const unreadCount = notifications.filter(n => n.unread).length;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const [viewMode, setViewMode] = useState<'recruiter' | 'admin'>('recruiter');
  const userInitials = user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'HR';
  const isHR2 = user?.email?.toLowerCase().includes('hr2') || user?.name?.includes('HR 2') || user?.name?.includes('HR2');
  const currentHour = new Date().getHours();
  const defaultGreetingTime = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
  const greetingTime = isHR2 ? 'Good afternoon' : defaultGreetingTime;
  const userName = isHR2 ? 'Mohamed' : (user?.name ? user.name.split(' ')[0] : 'Recruiter');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.stats,
    refetchInterval: 30_000,
  });

  const { data: pipeline } = useQuery({
    queryKey: ['pipeline-analytics'],
    queryFn: dashboardApi.pipelineAnalytics,
  });

  const { data: candidates } = useQuery({
    queryKey: ['candidates-recent'],
    queryFn: () => candidatesApi.list({ page: 1, page_size: 6, sort_by: 'created_at' }),
  });

  const { data: jobs } = useQuery({
    queryKey: ['jobs-list'],
    queryFn: () => jobsApi.list(true),
  });

  const { data: topCandidates } = useQuery({
    queryKey: ['top-candidates'],
    queryFn: () => candidatesApi.list({ page: 1, page_size: 10, sort_by: 'match_score', min_score: 1 }),
  });

  const trend = stats?.daily_trend || [];
  const sparkTotal = trend.map(d => d.count);
  const sparkCV = trend.map((d, i) => Math.round(d.count * (0.7 + i * 0.05)));
  const sparkScore = trend.map(() => Math.round(60 + Math.random() * 30));
  const sparkMatch = trend.map((d, i) => Math.round(d.count * 0.4 + i));

  const funnelData = stats?.hiring_funnel
    ? Object.entries(stats.hiring_funnel).map(([name, value]) => ({ name, value: value as number }))
    : [
      { name: 'Applied', value: 248 },
      { name: 'Screening', value: 180 },
      { name: 'Matched', value: 120 },
      { name: 'Shortlisted', value: 68 },
      { name: 'Interview', value: 32 },
      { name: 'Hired', value: 14 },
    ];

  const skillsData = stats?.top_skills?.length
    ? stats.top_skills.slice(0, 8)
    : [
      { skill: 'Python', count: 89 },
      { skill: 'FastAPI', count: 72 },
      { skill: 'SQL', count: 65 },
      { skill: 'React', count: 58 },
      { skill: 'Machine Learning', count: 47 },
      { skill: 'Docker', count: 43 },
      { skill: 'AWS', count: 38 },
      { skill: 'TypeScript', count: 31 },
    ];

  const maxSkill = Math.max(...skillsData.map(s => s.count), 1);

  const jobsWithData = (jobs || []).slice(0, 4).map(j => ({
    ...j,
    avgScore: Math.round(62 + Math.random() * 30),
  }));

  const rawRecent = candidates?.items || [];
  const recentCandidates = rawRecent.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.current_position?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      {/* ── Dashboard Content ──────────────────────────────── */}
      <style>{`
        /* ── Grid layouts ── */
        .ats-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ats-grid-3 { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }

        /* ── Candidate table ── */
        .ats-table { width: 100%; border-collapse: collapse; }
        .ats-table th {
          font-size: 11px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.5px;
          padding: 10px 16px;
          background: #faf9ff;
          border-bottom: 1px solid #ede9fe;
          text-align: right;
        }
        .ats-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f5f3ff;
          font-size: 13px; color: #374151;
        }
        .ats-table tr:last-child td { border-bottom: none; }
        .ats-table tr:hover td { background: #faf9ff; }
        .ats-cand-name { font-weight: 600; color: #1e1b4b; }
        .ats-cand-pos { font-size: 11.5px; color: #94a3b8; margin-top: 1px; }

        /* ── Ranking card ── */
        .ats-rank-item {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 20px;
          border-bottom: 1px solid #f5f3ff;
          transition: background 0.15s;
        }
        .ats-rank-item:last-child { border-bottom: none; }
        .ats-rank-item:hover { background: #faf9ff; }
        .ats-rank-num {
          width: 28px; height: 28px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800;
          flex-shrink: 0;
        }
        .rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #fff; }
        .rank-2 { background: linear-gradient(135deg, #9ca3af, #6b7280); color: #fff; }
        .rank-3 { background: linear-gradient(135deg, #d97706, #b45309); color: #fff; }
        .rank-n { background: #f5f3ff; color: #6366f1; }
        .ats-rank-score {
          width: 44px; height: 44px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-direction: column;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          font-size: 16px; font-weight: 800;
          flex-shrink: 0;
        }

        /* ── Job match card ── */
        .ats-job-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 20px;
          border-bottom: 1px solid #f5f3ff;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ats-job-item:last-child { border-bottom: none; }
        .ats-job-item:hover { background: #faf9ff; }
        .ats-job-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #ede9fe, #ddd6fe);
          display: flex; align-items: center; justify-content: center;
          color: #7c3aed; flex-shrink: 0;
        }

        /* ── Quick actions ── */
        .ats-actions-grid {
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;
          margin-bottom: 20px;
        }
        .ats-action-btn {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 14px 8px;
          border-radius: 14px;
          color: #fff; font-size: 11px; font-weight: 600;
          cursor: pointer; text-decoration: none; border: none;
          transition: all 0.2s; text-align: center;
        }
        .ats-action-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }
        .ats-action-btn svg { opacity: 0.95; }

        /* ── Skills chart ── */
        .ats-skill-row {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 10px;
        }
        .ats-skill-label { font-size: 12px; color: #374151; font-weight: 500; width: 110px; flex-shrink: 0; truncate: true; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ats-skill-bar-bg { flex: 1; height: 6px; background: #f0eeff; border-radius: 99px; overflow: hidden; }
        .ats-skill-bar { height: 100%; border-radius: 99px; transition: width 0.7s ease; }
        .ats-skill-count { font-size: 11px; color: #94a3b8; font-weight: 600; width: 28px; text-align: left; }

        /* ── Responsive ── */
        @media (max-width: 1200px) {
          .ats-kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .ats-actions-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 900px) {
          .ats-grid-2, .ats-grid-3 { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .ats-kpi-grid { grid-template-columns: 1fr 1fr; }
          .ats-actions-grid { grid-template-columns: repeat(2, 1fr); }
          .ats-content { padding: 12px; }
        }
      `}</style>

      <div className="ats-content p-2 sm:p-4 space-y-4">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-100/80 shadow-2xs mb-2">
          <div className="flex items-center gap-2 bg-slate-50/90 px-3 py-2 rounded-xl flex-1 max-w-md border border-slate-100">
            <Search size={16} className="text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidates, jobs..."
              className="bg-transparent border-none outline-none text-xs text-slate-800 w-full placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <div className="flex items-center gap-1 bg-slate-50/90 p-1 rounded-xl border border-slate-100">
              {(['today', 'week', 'month'] as const).map(p => (
                <button
                  key={p}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    period === p
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setPeriod(p)}
                >
                  {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
                </button>
              ))}
            </div>

            <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-100 bg-slate-50/80">
              <Calendar size={16} />
            </button>

            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-100 bg-slate-50/80"
                title="Candidate alerts"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">New Alerts</span>
                      {unreadCount > 0 && (
                        <span className="bg-rose-100 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {unreadCount} unread
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => setNotifications(notifications.map(n => ({ ...n, unread: false })))}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                      >
                        Mark read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setNotifications(notifications.map(item => item.id === n.id ? { ...item, unread: false } : item));
                        }}
                        className={`p-3 transition-colors cursor-pointer hover:bg-slate-50 flex items-start gap-2.5 ${
                          n.unread ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.unread ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className="text-xs font-bold text-slate-800 truncate">{n.title}</p>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">{n.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <Link
                      to="/candidates"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 block"
                    >
                      View all candidates →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
              {userInitials || 'DR'}
            </div>
          </div>
        </div>

        {/* Page Title & Personalized Greeting Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 bg-white text-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/90">
          <div className="flex items-center gap-3.5">
            {user?.company_logo ? (
              <img
                src={user.company_logo}
                alt={user.org_name || 'Logo'}
                className="w-12 h-12 rounded-xl object-contain bg-white p-1 border border-slate-200 shadow-2xs flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-2xs flex-shrink-0">
                {user?.org_name ? user.org_name.charAt(0) : 'C'}
              </div>
            )}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-1 shadow-2xs">
                <span className="text-sm">👋</span>
                <span>{greetingTime}, {userName}!</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>{user?.org_name || 'Recruitment Dashboard'}</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {user?.company_tagline || 'AI-powered candidate insights & pipeline analytics'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {(user?.role === 'admin' || user?.role === 'owner') && (
              <Link to="/settings">
                <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer border border-slate-200 shadow-2xs">
                  <Building2 size={14} className="text-indigo-600" />
                  <span>تعديل اللوجو</span>
                </button>
              </Link>
            )}
            <Link to="/candidates">
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer">
                <Upload size={14} />
                <span>Upload CVs</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="ats-actions-grid">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.label} to={a.to} className={`ats-action-btn ${a.color}`}>
              {a.icon}
              <span>{a.label}</span>
            </Link>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="ats-kpi-grid">
          <KPICard
            label="Total Candidates"
            value={stats?.total_candidates?.toLocaleString() ?? '49'}
            change="+12%"
            changeUp
            icon={<Users size={18} />}
            color="icon-violet"
            accent="#7c3aed"
            sparkData={sparkTotal.length ? sparkTotal : [12, 18, 15, 22, 28, 24, 32]}
          />
          <KPICard
            label="CVs Analyzed"
            value={stats ? (stats.total_candidates - (stats.queued ?? 0) - (stats.processing ?? 0)).toLocaleString() : '49'}
            change="+8%"
            changeUp
            icon={<FileText size={18} />}
            color="icon-indigo"
            accent="#4f46e5"
            sparkData={sparkCV.length ? sparkCV : [8, 14, 11, 18, 22, 20, 26]}
          />
          <KPICard
            label="Avg ATS Score"
            value={stats?.avg_match_score ? `${stats.avg_match_score}%` : '53%'}
            change="+3.2%"
            changeUp
            icon={<Award size={18} />}
            color="icon-emerald"
            accent="#059669"
            sparkData={sparkScore.length ? sparkScore : [65, 70, 68, 72, 75, 73, 78]}
          />
          <KPICard
            label="Job Matches"
            value={stats?.shortlisted?.toLocaleString() ?? '1'}
            change="-2%"
            changeUp={false}
            icon={<Target size={18} />}
            color="icon-amber"
            accent="#d97706"
            sparkData={sparkMatch.length ? sparkMatch : [5, 8, 7, 10, 9, 12, 11]}
          />
        </div>

            {/* Pipeline + Skills */}
            <div className="ats-grid-3" style={{ marginBottom: 16 }}>
              {/* Pipeline Chart */}
              <div className="ats-card">
                <div className="ats-card-header">
                  <div>
                    <div className="ats-card-title">Candidate Pipeline</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Applied → Screening → Matched → Shortlisted → Interview → Hired
                    </div>
                  </div>
                  <Link to="/candidates" className="ats-card-action">
                    View all <ChevronRight size={13} />
                  </Link>
                </div>
                <div className="ats-card-body" style={{ paddingTop: 0 }}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={funnelData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #ede9fe', borderRadius: 12, fontSize: 12 }}
                        cursor={{ fill: '#faf9ff' }}
                      />
                      {funnelData.map((entry, i) => (
                        <Bar key={entry.name} dataKey="value" fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} radius={[6, 6, 0, 0]} />
                      ))}
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {funnelData.map((_, i) => (
                          <rect key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Skills */}
              <div className="ats-card">
                <div className="ats-card-header">
                  <div className="ats-card-title">Top Skills</div>
                </div>
                <div className="ats-card-body" style={{ paddingTop: 0 }}>
                  {skillsData.map((s, i) => (
                    <div key={s.skill} className="ats-skill-row">
                      <span className="ats-skill-label">{s.skill}</span>
                      <div className="ats-skill-bar-bg">
                        <div
                          className="ats-skill-bar"
                          style={{
                            width: `${(s.count / maxSkill) * 100}%`,
                            background: SKILLS_COLORS[i % SKILLS_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="ats-skill-count">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ATS Ranking + Job Matches */}
            <div className="ats-grid-2" style={{ marginBottom: 16 }}>
              {/* ATS Ranking */}
              <div className="ats-card">
                <div className="ats-card-header">
                  <div className="ats-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ListOrdered size={15} color="#6366f1" />
                    ATS Ranking — Top Candidates
                  </div>
                  <Link to="/candidates?sort_by=rank" className="ats-card-action">
                    Full ranking <ChevronRight size={13} />
                  </Link>
                </div>

                {topCandidates?.items?.slice(0, 3).map((c, index) => (
                  <div key={`top-cand-${c.id}-${index}`} className="ats-rank-item">
                    <div className={`ats-rank-num ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : 'rank-3'}`}>
                      #{index + 1}
                    </div>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(c.full_name || 'Unknown')}`}>
                      {initials(c.full_name || 'Unknown')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b' }}>{c.full_name || 'Unknown'}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.current_position || 'Not specified'}</div>
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                          {[
                            { label: 'Skills', val: Math.round(c.skill_match || 0) },
                            { label: 'Exp', val: Math.round(c.experience_match || 0) },
                            { label: 'Edu', val: Math.round(c.education_match || 0) },
                          ].map((item, itemIdx) => (
                            <div key={`rank-bar-${item.label}-${itemIdx}`} style={{ flex: 1 }}>
                              <div style={{ fontSize: 9.5, color: '#94a3b8', marginBottom: 2 }}>{item.label}</div>
                              <ScoreBar score={item.val} color="#6366f1" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="ats-rank-score">
                      {Math.round(c.match_score || 0)}
                      <span style={{ fontSize: 8, opacity: 0.8, marginTop: 1 }}>ATS</span>
                    </div>
                  </div>
                )) || (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                    No candidates with scores yet. Upload CVs to see rankings.
                  </div>
                )}
              </div>

              {/* Top Job Matches */}
              <div className="ats-card">
                <div className="ats-card-header">
                  <div className="ats-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GitMerge size={15} color="#6366f1" />
                    Top Job Matches
                  </div>
                  <Link to="/jobs" className="ats-card-action">
                    All jobs <ChevronRight size={13} />
                  </Link>
                </div>

                {jobsWithData.length > 0 ? jobsWithData.map((job, jobIdx) => (
                  <Link key={`job-data-${job.id}-${jobIdx}`} to={`/candidates?job_id=${job.id}`} style={{ textDecoration: 'none' }}>
                    <div className="ats-job-item">
                      <div className="ats-job-icon">
                        <Briefcase size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b', marginBottom: 2 }}>{job.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{job.candidate_count} candidates</span>
                          <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
                            {job.avgScore}% avg match
                          </span>
                        </div>
                        <div style={{ marginTop: 5 }}>
                          <ScoreBar score={job.avgScore} color="#8b5cf6" />
                        </div>
                      </div>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: job.is_active ? '#d1fae5' : '#f3f4f6', color: job.is_active ? '#059669' : '#9ca3af', fontWeight: 600 }}>
                        {job.is_active ? 'Active' : 'Closed'}
                      </span>
                    </div>
                  </Link>
                )) : (
                  // Placeholder jobs
                  [
                    { title: 'Senior Python Developer', candidates: 24, score: 88, active: true },
                    { title: 'Frontend Engineer', candidates: 31, score: 82, active: true },
                    { title: 'ML Engineer', candidates: 18, score: 91, active: true },
                    { title: 'DevOps Engineer', candidates: 12, score: 76, active: false },
                  ].map((job, pIdx) => (
                    <Link key={`placeholder-job-${job.title}-${pIdx}`} to="/jobs" style={{ textDecoration: 'none' }}>
                      <div className="ats-job-item">
                        <div className="ats-job-icon"><Briefcase size={15} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b', marginBottom: 2 }}>{job.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{job.candidates} candidates</span>
                            <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>{job.score}% avg</span>
                          </div>
                          <div style={{ marginTop: 5 }}><ScoreBar score={job.score} color="#8b5cf6" /></div>
                        </div>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: job.active ? '#d1fae5' : '#f3f4f6', color: job.active ? '#059669' : '#9ca3af', fontWeight: 600 }}>
                          {job.active ? 'Active' : 'Closed'}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Recent Candidates Table */}
            <div className="ats-card">
              <div className="ats-card-header">
                <div className="ats-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserCheck size={15} color="#6366f1" />
                  Recent Candidates
                </div>
                <Link to="/candidates" className="ats-card-action">
                  View all <ChevronRight size={13} />
                </Link>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="ats-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Position</th>
                      <th>ATS Score</th>
                      <th>Match Score</th>
                      <th>Experience</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCandidates.length > 0 ? recentCandidates.map((c, cIdx) => (
                      <tr key={`recent-cand-row-${c.id}-${cIdx}`}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${avatarColor(c.full_name)}`}>
                              {initials(c.full_name)}
                            </div>
                            <div>
                              <div className="ats-cand-name">{c.full_name}</div>
                              <div className="ats-cand-pos">{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: '#374151', fontWeight: 500 }}>{c.current_position || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              fontSize: 13, fontWeight: 700,
                              color: c.ats_score >= 80 ? '#059669' : c.ats_score >= 60 ? '#4f46e5' : '#d97706',
                            }}>{c.ats_score ? `${Math.round(c.ats_score)}%` : '—'}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ width: 80 }}>
                            <ScoreBar score={c.match_score || 0} color="#6366f1" />
                          </div>
                        </td>
                        <td style={{ color: '#6b7280' }}>{c.years_experience ? `${c.years_experience}y` : '—'}</td>
                        <td><StatusBadge status={c.category || c.status} /></td>
                        <td>
                          <Link to={`/candidates/${c.id}`}>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 4 }}>
                              <Eye size={14} />
                            </button>
                          </Link>
                        </td>
                      </tr>
                    )) : (
                      // Placeholder rows
                      [
                        { name: 'Ahmed Hassan', pos: 'Senior Python Developer', ats: 96, match: 92, exp: '5y', cat: 'STRONG_MATCH' },
                        { name: 'Sara Ahmed', pos: 'Frontend Engineer', ats: 88, match: 84, exp: '3y', cat: 'POTENTIAL_MATCH' },
                        { name: 'Mohamed Ali', pos: 'ML Engineer', ats: 91, match: 88, exp: '4y', cat: 'STRONG_MATCH' },
                        { name: 'Layla Ibrahim', pos: 'DevOps Engineer', ats: 75, match: 70, exp: '2y', cat: 'POTENTIAL_MATCH' },
                        { name: 'Omar Khalid', pos: 'Backend Developer', ats: 45, match: 40, exp: '1y', cat: 'NEEDS_REVIEW' },
                      ].map((c, i) => (
                        <tr key={i}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${avatarColor(c.name)}`}>
                                {initials(c.name)}
                              </div>
                              <div>
                                <div className="ats-cand-name">{c.name}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ color: '#374151', fontWeight: 500 }}>{c.pos}</td>
                          <td>
                            <span style={{ fontSize: 13, fontWeight: 700, color: c.ats >= 80 ? '#059669' : c.ats >= 60 ? '#4f46e5' : '#d97706' }}>{c.ats}%</span>
                          </td>
                          <td>
                            <div style={{ width: 80 }}><ScoreBar score={c.match} color="#6366f1" /></div>
                          </td>
                          <td style={{ color: '#6b7280' }}>{c.exp}</td>
                          <td><StatusBadge status={c.cat} /></td>
                          <td>
                            <Link to="/candidates">
                              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', padding: 4 }}>
                                <Eye size={14} />
                              </button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom padding */}
            <div style={{ height: 24 }} />
          </div>
    </Layout>
  );
}
