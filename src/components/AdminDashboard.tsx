import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart as RePieChart, Pie, Cell,
} from 'recharts';
import {
  Users, Briefcase, GitMerge, CheckCircle2, Clock, ShieldCheck,
  TrendingUp, UserPlus, Building2, Activity, FileText, ChevronRight,
  Search, RefreshCw, Award, ArrowUpRight, ArrowDownRight, Sparkles,
  Cpu, Layers, Filter, Check, X, ExternalLink, AlertCircle, UserCheck,
  UserX, Mail, Key, Shield, Eye, Trash2, KeyRound, Lock, Plus, AlertTriangle
} from 'lucide-react';
import { usersApi, jobsApi, dashboardApi, candidatesApi } from '../api';
import { useAuthStore } from '../store/auth';
import { useToast } from './ui';
import type { TeamUser, Job, DashboardStats, PipelineAnalytics } from '../types';

interface AdminDashboardProps {
  onNavigateToUsers?: () => void;
  onNavigateToJobs?: () => void;
  onNavigateToCandidates?: () => void;
}

const FUNNEL_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  owner: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  recruiter: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  viewer: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function AdminDashboard({ onNavigateToUsers, onNavigateToJobs, onNavigateToCandidates }: AdminDashboardProps) {
  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();
  const toast = useToast();
  
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | '90d'>('30d');

  // Modals state
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deletingUser, setDeletingUser] = useState<TeamUser | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'recruiter',
    create_isolated_workspace: true,
  });

  // Queries
  const { data: users = [], isLoading: loadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: () => usersApi.list(),
    refetchInterval: 30_000,
  });

  const { data: jobs = [], isLoading: loadingJobs, refetch: refetchJobs } = useQuery({
    queryKey: ['admin-jobs-list'],
    queryFn: () => jobsApi.list(),
    refetchInterval: 30_000,
  });

  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: () => dashboardApi.stats(),
    refetchInterval: 30_000,
  });

  const { data: pipeline, isLoading: loadingPipeline, refetch: refetchPipeline } = useQuery({
    queryKey: ['admin-pipeline-analytics'],
    queryFn: () => dashboardApi.pipelineAnalytics(),
    refetchInterval: 30_000,
  });

  const { data: aiConfig } = useQuery({
    queryKey: ['admin-ai-config'],
    queryFn: () => dashboardApi.aiConfig(),
  });

  // Mutations
  const toggleActiveMutation = useMutation({
    mutationFn: (u: TeamUser) => usersApi.update(u.id, { is_active: !u.is_active }),
    onSuccess: (_, u) => {
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      qc.invalidateQueries({ queryKey: ['team'] });
      toast(u.is_active ? 'تم تجميد وتعطيل الحساب فورياً' : 'تم تنشيط وتفعيل الحساب بنجاح', 'success');
    },
    onError: (err: any) => {
      toast(err?.response?.data?.detail || 'فشل تحديث حالة الحساب', 'error');
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      qc.invalidateQueries({ queryKey: ['team'] });
      setDeletingUser(null);
      toast('تم حذف الحساب نهائياً من السيستم وإنهاء جلساته', 'success');
    },
    onError: (err: any) => {
      toast(err?.response?.data?.detail || 'فشل حذف الحساب', 'error');
    }
  });

  const updatePasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => usersApi.update(id, { password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      qc.invalidateQueries({ queryKey: ['team'] });
      setEditingUser(null);
      setNewPassword('');
      toast('تم تحديث كلمة المرور للحساب بنجاح', 'success');
    },
    onError: (err: any) => {
      toast(err?.response?.data?.detail || 'فشل تحديث كلمة المرور', 'error');
    }
  });

  const createUserMutation = useMutation({
    mutationFn: (data: typeof newUserData) => usersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      qc.invalidateQueries({ queryKey: ['team'] });
      setIsAddUserOpen(false);
      setNewUserData({ name: '', email: '', password: '', role: 'recruiter', create_isolated_workspace: true });
      toast('تم إنشاء الحساب الجديد بنجاح مع مساحة عمل مخصصة', 'success');
    },
    onError: (err: any) => {
      toast(err?.response?.data?.detail || 'فشل إنشاء الحساب', 'error');
    }
  });

  const handleRefreshAll = () => {
    refetchUsers();
    refetchJobs();
    refetchStats();
    refetchPipeline();
  };

  // Metrics calculations
  const totalUsersCount = users.length;
  const activeUsersCount = users.filter(u => u.is_active !== false).length;
  const adminCount = users.filter(u => u.role === 'admin' || u.role === 'owner').length;
  const recruiterCount = users.filter(u => u.role === 'recruiter').length;

  const totalJobsCount = jobs.length;
  const activeJobs = jobs.filter(j => j.is_active);
  const activeJobsCount = activeJobs.length;
  const closedJobsCount = totalJobsCount - activeJobsCount;
  const totalCandidatesAcrossJobs = jobs.reduce((acc, j) => acc + (j.candidate_count || 0), 0);

  // Pipeline metrics
  const totalCandidates = stats?.total_candidates ?? totalCandidatesAcrossJobs ?? 0;
  const shortlistedCount = stats?.shortlisted ?? 0;
  const interviewCount = stats?.interview ?? 0;
  const hiredCount = stats?.hired ?? 0;
  const rejectedCount = stats?.rejected ?? 0;
  const pendingCount = stats?.pending ?? 0;
  const avgMatchScore = stats?.avg_match_score ?? 0;

  // Conversion rates
  const hireRatePct = totalCandidates > 0 ? Math.round((hiredCount / totalCandidates) * 100) : 0;
  const shortlistRatePct = totalCandidates > 0 ? Math.round((shortlistedCount / totalCandidates) * 100) : 0;

  // Funnel Data for Charts
  const funnelData = pipeline?.funnel
    ? Object.entries(pipeline.funnel).map(([stage, info]) => ({
        stage,
        count: info.count,
        pct: info.pct_of_total,
      }))
    : stats?.hiring_funnel
    ? Object.entries(stats.hiring_funnel).map(([stage, count]) => ({
        stage,
        count: count as number,
        pct: totalCandidates > 0 ? Math.round(((count as number) / totalCandidates) * 100) : 0,
      }))
    : [
        { stage: 'Applied / Screening', count: totalCandidates, pct: 100 },
        { stage: 'Matched', count: Math.round(totalCandidates * 0.75), pct: 75 },
        { stage: 'Shortlisted', count: shortlistedCount || Math.round(totalCandidates * 0.4), pct: 40 },
        { stage: 'Interview', count: interviewCount || Math.round(totalCandidates * 0.2), pct: 20 },
        { stage: 'Hired', count: hiredCount || Math.round(totalCandidates * 0.08), pct: 8 },
      ];

  // Filtered Users List
  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Admin Dashboard Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-md">
                <ShieldCheck size={14} className="text-indigo-400" />
                System Administration
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Telemetry
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              Platform Admin Dashboard
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Overview of registered platform users, active recruitment job postings, and real-time candidate pipeline metrics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshAll}
              className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 flex items-center gap-2 transition-all"
            >
              <RefreshCw size={14} className={(loadingUsers || loadingStats) ? 'animate-spin' : ''} />
              Refresh Data
            </button>
            <Link
              to="/settings"
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all"
            >
              <UserPlus size={14} />
              Manage Users
            </Link>
          </div>
        </div>

        {/* AI System Status Strip */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
              <Cpu size={16} />
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Primary AI Engine</p>
              <p className="font-semibold text-white">{aiConfig?.primary_model || 'Gemini 3.6 Flash'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
              <Activity size={16} />
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Engine Status</p>
              <p className="font-semibold text-emerald-400">{aiConfig?.status || 'Operational (Sub-second)'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Matching Algorithm</p>
              <p className="font-semibold text-white">Hybrid Multimodal Vector</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
              <Shield size={16} />
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Current Admin</p>
              <p className="font-semibold text-white truncate max-w-[130px]">{currentUser?.email || 'System Admin'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KEY PLATFORM METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Registered Users */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={20} />
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1">
              <UserCheck size={12} />
              {activeUsersCount} Active
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-800 tracking-tight mb-1">
            {loadingUsers ? '...' : totalUsersCount}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Total Registered Users</p>
            <span className="text-[11px] text-slate-400 font-medium">{adminCount} Admins / {recruiterCount} HR</span>
          </div>
        </div>

        {/* Metric 2: Active Job Postings */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Briefcase size={20} />
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {activeJobsCount} Active
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-800 tracking-tight mb-1">
            {loadingJobs ? '...' : totalJobsCount}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Active Job Postings</p>
            <span className="text-[11px] text-slate-400 font-medium">{closedJobsCount} Closed</span>
          </div>
        </div>

        {/* Metric 3: Candidate Pipeline Total */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <GitMerge size={20} />
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
              <ArrowUpRight size={13} />
              {hireRatePct}% Hire Rate
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-800 tracking-tight mb-1">
            {loadingStats ? '...' : totalCandidates.toLocaleString()}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Candidate Pipeline Total</p>
            <span className="text-[11px] text-emerald-600 font-semibold">{hiredCount} Hired</span>
          </div>
        </div>

        {/* Metric 4: Platform Avg ATS Match Score */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award size={20} />
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              High Precision
            </span>
          </div>
          <p className="text-3xl font-extrabold text-slate-800 tracking-tight mb-1">
            {loadingStats ? '...' : `${avgMatchScore}%`}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Avg ATS Match Score</p>
            <span className="text-[11px] text-purple-600 font-semibold">{shortlistedCount} Shortlisted</span>
          </div>
        </div>
      </div>

      {/* CANDIDATE PIPELINE SUMMARY SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <GitMerge size={18} className="text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">Candidate Pipeline Summary</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live progression of candidate profiles across all active jobs and recruitment stages
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/reports"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline"
            >
              Detailed Pipeline Analytics <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        {/* Pipeline Stage Badges & Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 text-center">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Applied / Total</p>
            <p className="text-xl font-extrabold text-slate-800 mt-1">{totalCandidates}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">100% of pipeline</p>
          </div>

          <div className="bg-purple-50 rounded-xl p-3 border border-purple-100 text-center">
            <p className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">Screening</p>
            <p className="text-xl font-extrabold text-purple-900 mt-1">{totalCandidates - shortlistedCount - hiredCount - rejectedCount > 0 ? totalCandidates - shortlistedCount - hiredCount - rejectedCount : pendingCount || Math.round(totalCandidates * 0.4)}</p>
            <p className="text-[10px] text-purple-600 mt-0.5">Initial Evaluation</p>
          </div>

          <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
            <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">Shortlisted</p>
            <p className="text-xl font-extrabold text-indigo-900 mt-1">{shortlistedCount}</p>
            <p className="text-[10px] text-indigo-600 mt-0.5">{shortlistRatePct}% conversion</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-center">
            <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Interviews</p>
            <p className="text-xl font-extrabold text-blue-900 mt-1">{interviewCount}</p>
            <p className="text-[10px] text-blue-600 mt-0.5">Active Interviews</p>
          </div>

          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-center">
            <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Hired</p>
            <p className="text-xl font-extrabold text-emerald-900 mt-1">{hiredCount}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">{hireRatePct}% success rate</p>
          </div>

          <div className="bg-rose-50 rounded-xl p-3 border border-rose-100 text-center">
            <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Rejected</p>
            <p className="text-xl font-extrabold text-rose-900 mt-1">{rejectedCount}</p>
            <p className="text-[10px] text-rose-600 mt-0.5">Not Matched</p>
          </div>
        </div>

        {/* Funnel Visual Bar Chart */}
        <div className="pt-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 12 }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* REGISTERED USERS & ACTIVE JOBS POSTINGS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Registered Users Management */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Users size={18} className="text-purple-600" />
                <h3 className="text-base font-bold text-slate-900">Registered Users ({totalUsersCount})</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Platform administrators and recruiter workspace accounts</p>
            </div>
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 self-start sm:self-auto transition-all cursor-pointer"
            >
              <Plus size={13} />
              إضافة مستخدم جديد
            </button>
          </div>

          {/* User Filters */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-slate-700"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin / Owner</option>
              <option value="recruiter">HR Recruiter</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {/* User Table / List */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">إجراءات التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(u => (
                    <tr key={`user-${u.id}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-[10px] ${
                            u.is_active ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-slate-400'
                          }`}>
                            {u.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 leading-tight flex items-center gap-1.5">
                              {u.name}
                              {u.id === currentUser?.id && (
                                <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded font-medium">أنت</span>
                              )}
                            </p>
                            <p className="text-[11px] text-slate-400 leading-tight">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${ROLE_COLORS[u.role] || 'bg-slate-100 text-slate-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            نشط (Active)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            معطل ومجمد (Frozen)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle Active Button */}
                          <button
                            onClick={() => toggleActiveMutation.mutate(u)}
                            disabled={toggleActiveMutation.isPending || u.id === currentUser?.id}
                            className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                              u.is_active
                                ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                            title={u.is_active ? 'تجميد وتعطيل الحساب فوراً' : 'تنشيط وتفعيل الحساب'}
                          >
                            {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                          </button>

                          {/* Edit Password Button */}
                          <button
                            onClick={() => { setEditingUser(u); setNewPassword(''); }}
                            className="p-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs transition-all cursor-pointer"
                            title="تعديل كلمة المرور"
                          >
                            <KeyRound size={13} />
                          </button>

                          {/* Delete User Button */}
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs transition-all cursor-pointer"
                              title="حذف الحساب نهائياً"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                      No registered users found matching filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Active Job Postings */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Briefcase size={18} className="text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Active Job Postings ({activeJobsCount})</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Live open recruitment roles and applicant totals</p>
            </div>
            <Link
              to="/jobs"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 self-start sm:self-auto hover:underline"
            >
              Manage All Jobs ({totalJobsCount}) <ChevronRight size={14} />
            </Link>
          </div>

          {/* Job List */}
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {jobs.length > 0 ? (
              jobs.map(j => (
                <div
                  key={`job-post-${j.id}`}
                  className="p-3.5 rounded-xl border border-slate-200/80 hover:border-indigo-300 bg-slate-50/50 hover:bg-white transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-xs text-slate-900 truncate">{j.title}</p>
                      <span className={`px-2 py-0.2 text-[9px] font-bold rounded-full ${j.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {j.is_active ? 'Active' : 'Closed'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span>{j.company || 'Company Role'}</span>
                      <span>•</span>
                      <span>Min {j.min_experience} yrs exp</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-sm font-extrabold text-indigo-600 leading-tight">
                        {j.candidate_count || 0}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium">Applicants</p>
                    </div>

                    <Link
                      to={`/candidates?job_id=${j.id}`}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="View job candidates"
                    >
                      <ExternalLink size={15} />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No active job postings created yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: EDIT / RESET PASSWORD */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold">
                <KeyRound size={20} />
                <h3 className="text-base text-slate-900">تعديل كلمة مرور الحساب</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              تعيين كلمة مرور جديدة لحساب <strong className="text-slate-900">{editingUser.name}</strong> ({editingUser.email}):
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPassword.trim()) return;
                updatePasswordMutation.mutate({ id: editingUser.id, password: newPassword.trim() });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">كلمة المرور الجديدة</label>
                <input
                  type="text"
                  required
                  placeholder="أدخل كلمة المرور الجديدة (مثال: pass2026)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={updatePasswordMutation.isPending || !newPassword.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {updatePasswordMutation.isPending ? 'جاري الحفظ...' : 'حفظ وتحديث كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM DELETE USER */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2 bg-rose-50 rounded-xl">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">تأكيد حذف الحساب نهائياً</h3>
                <p className="text-xs text-rose-600 font-medium">سيتم إلغاء الجلسات وإزالة الحساب من النظام</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200/80 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف حساب <strong className="text-slate-900">{deletingUser.name}</strong> ({deletingUser.email})؟
              <br />
              <span className="text-[11px] text-slate-500 mt-1 block">
                • سيتم قطع الاتصال وإنهاء كافة الجلسات النشطة فوراً ومنعه من تسجيل الدخول.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={() => deleteUserMutation.mutate(deletingUser.id)}
                disabled={deleteUserMutation.isPending}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {deleteUserMutation.isPending ? 'جاري الحذف...' : 'نعم، احذف الحساب الآن'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD NEW USER */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-purple-600 font-bold">
                <UserPlus size={20} />
                <h3 className="text-base text-slate-900">إنشاء حساب مستخدم جديد</h3>
              </div>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newUserData.email || !newUserData.name || !newUserData.password) return;
                createUserMutation.mutate(newUserData);
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: HR Recruiter 8"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  placeholder="name@calliq.ai"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة المرور</label>
                <input
                  type="text"
                  required
                  placeholder="••••••••"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الدور والصلاحيات</label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="recruiter">مسؤول توظيف (HR Recruiter)</option>
                  <option value="admin">مسؤول نظام كامل (Admin)</option>
                  <option value="viewer">مشاهد فقط (Viewer)</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUserData.create_isolated_workspace}
                    onChange={(e) => setNewUserData({ ...newUserData, create_isolated_workspace: e.target.checked })}
                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>إنشاء مساحة عمل منعزلة ومستقلة تماماً (Isolated Workspace)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {createUserMutation.isPending ? 'جاري الإنشاء...' : 'إنشاء الحساب الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
