import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Brain, CheckCircle, Upload, FileText, XCircle, AlertCircle, ShieldCheck, Sparkles, Building2
} from 'lucide-react';
import { applyApi } from '../api';
import { Button, Input, Spinner } from '../components/ui';

interface JobInfo {
  id: number;
  title: string;
  company?: string;
  description: string;
}

export function ApplyPage() {
  const { token = '' } = useParams();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState<{ candidate_id: number; message: string } | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: job, isLoading, isError } = useQuery<JobInfo>({
    queryKey: ['apply-job', token],
    queryFn: () => applyApi.getJob(token),
    retry: false,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError('');
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('full_name', form.full_name);
      fd.append('email', form.email);
      if (form.phone) fd.append('phone', form.phone);
      if (file) {
        fd.append('file', file);
        fd.append('cv_file', file);
      }
      return applyApi.submit(token, fd);
    },
    onSuccess: (res: any) => {
      setSubmitted({
        candidate_id: res?.candidate_id || Math.floor(1000 + Math.random() * 9000),
        message: res?.message || 'تم تقديم الطلب بنجاح! تم استلام سيرتك الذاتية وسيتم مراجعتها.',
      });
    },
    onError: (err: any) => {
      console.error('Apply submission error:', err);
      setError(err?.response?.data?.detail || err?.message || 'حدث خطأ أثناء التقديم. يرجى المحاولة مرة أخرى.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.full_name.trim()) {
      setError('يرجى إدخال الاسم الكامل');
      return;
    }
    if (!form.email.trim()) {
      setError('يرجى إدخال عنوان البريد الإلكتروني');
      return;
    }
    if (!file) {
      setError('يرجى إرفاق ملف السيرة الذاتية (CV)');
      return;
    }
    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3 dir-rtl text-right">
        <Spinner size={32} className="text-blue-600" />
        <p className="text-sm font-medium text-slate-500">جاري تحميل بيانات الوظيفة...</p>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center max-w-md w-full">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertCircle size={26} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">رابط التقديم غير متاح</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            قد يكون هذا الرابط غير صالحة، أو تم إغلاق باب التقديم لهذه الوظيفة.
          </p>
          <div className="text-xs text-slate-400 border-t border-slate-100 pt-4 flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-slate-400" /> CalliQ ATS
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      {/* Clean Header - No Admin / Dashboard Links */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-md">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">CalliQ</span>
              <span className="text-xs bg-blue-500/20 text-blue-300 font-semibold px-2.5 py-0.5 rounded-full mr-2 border border-blue-400/20">
                بوابة التقديم
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8">
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-10 text-center my-4">
            <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-emerald-600 shadow-sm">
              <CheckCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">تم تقديم الطلب بنجاح!</h1>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              {submitted.message || 'شكراً لتقديمك. تم استلام طلبك وسيرتك الذاتية بنجاح وسيتم مراجعتها بواسطة فريق التوظيف.'}
            </p>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-right mb-6 text-xs text-slate-600 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">رقم مرجع الطلب:</span>
                <span className="font-mono font-bold text-slate-800">#{submitted.candidate_id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">الوظيفة:</span>
                <span className="font-semibold text-slate-800">{job?.title || 'الوظيفة المعلنة'}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">يمكنك إغلاق هذه الصفحة الآن.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-6 sm:p-8">
            {/* Header section with Job Title */}
            <div className="text-center mb-6 pb-5 border-b border-slate-100">
              {job?.company && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 mb-2">
                  <Building2 size={13} /> {job.company}
                </span>
              )}
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{job?.title}</h1>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center justify-center gap-1">
                <Sparkles size={14} className="text-blue-500" />
                قدم الآن وسيتم فحص سيرتك الذاتية بواسطة نظام الذكاء الاصطناعي
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl mb-5">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-right">
              <Input
                label="الاسم الكامل *"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="مثال: أحمد محمد"
                required
              />

              <Input
                label="عنوان البريد الإلكتروني *"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="example@email.com"
                required
              />

              <Input
                label="رقم الهاتف (اختياري)"
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+20 100 000 0000"
              />

              {/* Mobile-Friendly File Upload Field */}
              <div>
                <span className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  إرفاق السيرة الذاتية (CV) *
                </span>

                {/* Native hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="sr-only"
                  id="cv-file-input"
                />

                {file ? (
                  <div className="flex items-center justify-between gap-3 p-3.5 border border-blue-200 rounded-xl bg-blue-50/60 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-xs font-bold text-slate-800 truncate dir-ltr">{file.name}</p>
                        <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(0)} كيلوبايت</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors flex-shrink-0"
                      title="حذف الملف"
                    >
                      <XCircle size={18} />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="cv-file-input"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className="block border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/30 active:bg-blue-50/60 rounded-2xl p-6 text-center cursor-pointer transition-all active:scale-[0.98] touch-manipulation select-none"
                  >
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100 shadow-sm pointer-events-none">
                      <Upload size={22} />
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-1 pointer-events-none">
                      اضغط هنا لاختيار السيرة الذاتية (CV) من جهازك أو هاتفك
                    </p>
                    <p className="text-xs text-slate-500 mb-2 pointer-events-none">
                      أو اسحب الملف وأسقطه هنا
                    </p>
                    <span className="inline-block px-3 py-1 bg-white text-[11px] text-slate-400 font-medium rounded-lg border border-slate-200 shadow-2xs pointer-events-none">
                      يدعم ملفات PDF و DOC و DOCX و TXT (حتى 10 ميجابايت)
                    </span>
                  </label>
                )}
              </div>

              <div className="pt-3">
                <Button
                  type="submit"
                  className="w-full justify-center shadow-md bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 text-base rounded-xl"
                  loading={submitMutation.isPending}
                  size="lg"
                >
                  {submitMutation.isPending ? 'جاري إرسال وتدقيق الطلب...' : 'إرسال طلب التقديم'}
                </Button>
              </div>

              <p className="text-[11px] text-center text-slate-400 pt-2">
                سيتم معالجة سيرتك الذاتية وتحليلها بشكل آمن بفضل نظام CalliQ ATS.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}


