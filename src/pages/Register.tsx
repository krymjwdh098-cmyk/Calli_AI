import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ShieldAlert } from 'lucide-react';
import { Button } from '../components/ui';

export function RegisterPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
          <Brain size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">CalliQ AI</h1>
        
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-slate-800 space-y-4 text-center">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-lg font-bold">التسجيل المباشر مغلق</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            إنشاء الحسابات وتعيين الصلاحيات يتم حصرياً بواسطة مسؤول النظام (Admin). يرجى التواصل مع الإدارة لإضافة حسابك ومنحك كلمات المرور.
          </p>
          <Button className="w-full justify-center mt-4" onClick={() => navigate('/login')}>
            العودة لتسجيل الدخول
          </Button>
        </div>
      </div>
    </div>
  );
}
