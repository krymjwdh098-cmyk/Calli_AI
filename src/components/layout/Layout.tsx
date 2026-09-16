import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users, BarChart3, Settings,
  LogOut, Menu, X, ChevronLeft, ChevronRight, Brain, MessageSquare, FolderHeart
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { Chatbot } from '../Chatbot';

const NAV = [
  { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'لوحة التحكم' },
  { to: '/jobs', icon: <Briefcase size={18} />, label: 'الوظائف' },
  { to: '/candidates', icon: <Users size={18} />, label: 'المرشحون' },
  { to: '/talent-crm', icon: <FolderHeart size={18} />, label: 'مجمع المواهب CRM' },
  { to: '/inquiries', icon: <MessageSquare size={18} />, label: 'الاستفسارات' },
  { to: '/settings', icon: <Settings size={18} />, label: 'الإعدادات' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" dir="rtl">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 right-0 z-50 h-full bg-slate-900 flex flex-col transition-transform duration-200 ease-in-out flex-shrink-0
          lg:relative lg:inset-auto lg:top-auto lg:bottom-auto lg:right-auto lg:z-auto
          ${collapsed ? 'w-16' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo & Mobile Close */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {user?.company_logo ? (
              <img
                src={user.company_logo}
                alt={user.org_name || 'Company Logo'}
                className="w-8 h-8 rounded-lg object-contain bg-white p-1 border border-slate-700 shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 text-white shadow-sm shadow-blue-500/30">
                <Brain size={18} />
              </div>
            )}
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-white font-bold text-base tracking-wide truncate">
                  {user?.org_name || 'CalliQ AI'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  {user?.company_tagline || 'منصة التوظيف الذكية'}
                </span>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="إغلاق القائمة"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav list */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto scrollbar-thin space-y-1">
          {NAV.map(item => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 font-medium text-sm
                  ${active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'}`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {!collapsed && active && <ChevronLeft size={14} className="text-blue-200" />}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-800 p-3 bg-slate-900/50">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border border-blue-400/30">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{user?.name || 'المستخدم'}</p>
                <p className="text-slate-400 text-[11px] truncate capitalize">{user?.role || 'مسؤول التوظيف'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="hidden lg:flex absolute -left-3 top-7 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full items-center justify-center text-slate-300 hover:text-white transition-colors z-20 shadow-md"
          title={collapsed ? 'توسيع القائمة' : 'طوي القائمة'}
        >
          <ChevronRight size={12} className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* Main content viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 border border-slate-200/80 bg-slate-50 cursor-pointer"
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة الرئيسية"
            >
              <Menu size={20} className="text-blue-600" />
              <span className="text-xs font-bold text-slate-800">القائمة</span>
            </button>

            <div className="flex lg:hidden items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Brain size={15} />
              </div>
              <span className="font-bold text-slate-800 text-sm">CalliQ AI</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs bg-slate-100/90 text-slate-700 px-3 py-1.5 rounded-full border border-slate-200/80 font-medium shadow-xs">
              {user?.company_logo ? (
                <img
                  src={user.company_logo}
                  alt=""
                  className="w-4 h-4 rounded object-contain bg-white border border-slate-200"
                />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
              <span className="truncate max-w-[150px] sm:max-w-none font-semibold text-slate-800">
                {user?.org_name || 'CalliQ HR Workspace'}
              </span>
            </div>
          </div>
        </header>

        {/* Page content scroll container */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 pb-20 sm:pb-6">
          {children}
        </main>
      </div>

      <Chatbot />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
