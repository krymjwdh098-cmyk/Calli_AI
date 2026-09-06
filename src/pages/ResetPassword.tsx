import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Brain, AlertCircle, CheckCircle } from 'lucide-react';
import { authApi } from '../api';
import { Button, Input } from '../components/ui';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('هذا الرابط غير صالح أو لا يحتوي على رمز التأكيد.');
      return;
    }
    if (password.length < 8) {
      setError('يجب أن تكون كلمة المرور 8 أحرف على الأقل');
      return;
    }
    if (password !== confirm) {
      setError('كلمتي المرور غير متطابقتين');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'هذا الرابط غير صالح أو منتهي الصلاحية.');
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
        {done ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} />
            </div>
            <h2 className="text-2xl font-medium tracking-tight text-neutral-900 mb-2">تم التغيير بنجاح</h2>
            <p className="text-neutral-500 text-sm mb-6">يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-white font-medium py-3 rounded-lg transition-all"
            >
              الذهاب لتسجيل الدخول
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-medium tracking-tight text-neutral-900 mb-2">تعيين كلمة مرور جديدة</h1>
              <p className="text-sm text-neutral-500">
                يرجى إدخال كلمة المرور الجديدة الخاصة بك.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-6 border border-red-100">
                <AlertCircle size={16} className="shrink-0" />
                <span>{String(error)}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 block">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="8 أحرف كحد أدنى"
                  required
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-base sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-all shadow-sm dir-ltr text-left"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 block">تأكيد كلمة المرور</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  required
                  className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-base sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition-all shadow-sm dir-ltr text-left"
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
                  'تغيير كلمة المرور'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors flex items-center justify-center gap-1">
                ← العودة لصفحة الدخول
              </Link>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="absolute bottom-8 w-full text-center">
        <p className="text-xs text-neutral-400">© {new Date().getFullYear()} CalliQ AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
