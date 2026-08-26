import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, Eye, EyeOff, AlertCircle, ShieldCheck, KeyRound, Sparkles, Lock, Mail, ArrowRight } from 'lucide-react';
import { authApi } from '../api';
import { useAuthStore } from '../store/auth';
import { Button } from '../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { access_token } = await authApi.login(email, password);
      setToken(access_token);
      const user = await authApi.me();
      setUser(user);
      navigate('/dashboard');
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || 
                          err?.message || 
                          'بيانات الدخول غير صحيحة. يرجي التأكد من البريد وكلمة المرور.';
      setError(typeof errorMessage === 'string' ? errorMessage : 'بيانات الدخول غير صحيحة.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-neutral-900 flex flex-col justify-center relative selection:bg-neutral-900 selection:text-white overflow-hidden">
      {/* Soft Zen Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-60" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] opacity-60" />

      {/* Minimalist Header */}
      <header className="absolute top-0 w-full px-8 py-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center shadow-sm">
            <Brain size={18} className="text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-neutral-900">CalliQ</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-sm mx-auto px-6 py-12 relative z-10">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-medium tracking-tight text-neutral-900 mb-2">مرحباً بك</h1>
          <p className="text-sm text-neutral-500">
            سجل دخولك للمتابعة إلى لوحة التحكم
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-6 border border-red-100">
            <AlertCircle size={16} className="shrink-0" />
            <span>{String(error)}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700 block">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              autoComplete="off"
              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-all shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-700 block">كلمة المرور</label>
              <Link to="/forgot-password" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
                نسيت الكلمة؟
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="off"
                className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-all shadow-sm dir-ltr text-left"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white font-medium py-3 rounded-lg transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>تسجيل الدخول</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-neutral-500">
            ليس لديك حساب؟{' '}
            <span className="text-neutral-900 font-medium cursor-help" title="يرجى التواصل مع مسؤول النظام لإنشاء حسابك">
              تواصل مع الإدارة
            </span>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-8 w-full text-center">
        <p className="text-xs text-neutral-400">© {new Date().getFullYear()} CalliQ AI. All rights reserved.</p>
      </footer>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-neutral-900 flex flex-col justify-center relative selection:bg-neutral-900 selection:text-white overflow-hidden">
      {/* Soft Zen Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-60" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-50 rounded-full blur-[120px] opacity-60" />
      
      {/* Minimalist Header */}
      <header className="absolute top-0 w-full px-8 py-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center shadow-sm">
            <Brain size={18} className="text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-neutral-900">CalliQ</span>
        </div>
      </header>

      <main className="w-full max-w-sm mx-auto px-6 py-12 relative z-10">
        <div className="mb-6">
          <Link to="/login" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1">
            ← العودة لصفحة الدخول
          </Link>
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight text-neutral-900 mb-2">استعادة كلمة المرور</h1>
          <p className="text-sm text-neutral-500">
            أدخل بريدك الإلكتروني وسيتم إرسال رابط إعادة الضبط إذا كان الحساب مسجلاً.
          </p>
        </div>
        
        {sent ? (
          <div className="text-center py-8 bg-green-50 border border-green-100 rounded-lg">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Brain size={24} />
            </div>
            <p className="text-green-700 text-sm font-medium">تم الإرسال بنجاح!</p>
            <p className="text-green-600 text-xs mt-1">يرجى مراجعة بريدك الإلكتروني.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700 block">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-all shadow-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white font-medium py-3 rounded-lg transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                'إرسال رابط الضبط'
              )}
            </button>
          </form>
        )}
      </main>
      
      {/* Footer */}
      <footer className="absolute bottom-8 w-full text-center">
        <p className="text-xs text-neutral-400">© {new Date().getFullYear()} CalliQ AI. All rights reserved.</p>
      </footer>
    </div>
  );
}

