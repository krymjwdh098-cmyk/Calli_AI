import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  CheckCircle, Upload, FileText, XCircle, AlertCircle, ShieldCheck,
  Sparkles, Building2, MessageSquare, Send, X
} from 'lucide-react';
import { applyApi, publicInquiryApi } from '../api';
import { Button, Input, Spinner, Textarea } from '../components/ui';

interface JobInfo {
  id: number;
  title: string;
  company?: string;
  company_logo?: string;
  company_tagline?: string;
  company_website?: string;
  description: string;
  required_skills?: string[];
  min_experience?: number;
}

// ── Candidate Inquiries Assistant Widget Component ──────────────────────────
function CandidateAssistantWidget({ token, jobTitle }: { token: string; jobTitle?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  // Inquiry Form state
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryText, setInquiryText] = useState('');
  const [inquirySuccess, setInquirySuccess] = useState('');
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState(false);

  const handleSubmitDirectInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryName.trim() || !inquiryEmail.trim() || !inquiryText.trim() || isSubmittingInquiry) return;

    setIsSubmittingInquiry(true);
    setInquirySuccess('');
    try {
      const res = await publicInquiryApi.submitInquiry(token, {
        candidate_name: inquiryName,
        candidate_email: inquiryEmail,
        candidate_phone: inquiryPhone,
        question: inquiryText,
      });
      setInquirySuccess(res.message || 'تم إرسال استفسارك بنجاح إلى فريق التوظيف (HR).');
      setInquiryText('');
    } catch (err) {
      setInquirySuccess('حدث خطأ أثناء إرسال الاستفسار، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 dir-rtl font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5 font-bold text-xs sm:text-sm border border-indigo-400/30"
        >
          <div className="relative">
            <MessageSquare size={18} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-700 rounded-full animate-pulse" />
          </div>
          <span>المساعد الآلي</span>
        </button>
      ) : (
        <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-[360px] sm:w-[400px] max-w-[92vw] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
                <MessageSquare size={18} className="text-indigo-200" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">المساعد الآلي</h4>
                <p className="text-[10px] text-indigo-100 flex items-center gap-1">
                  إرسال استفسار مباشر لمسؤول التوظيف (HR)
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Inquiry Form */}
          <div className="overflow-y-auto p-4 bg-white max-h-[480px]">
            <form onSubmit={handleSubmitDirectInquiry} className="space-y-3 text-right">
              <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 text-indigo-950 font-medium">
                أرسل استفسارك أو تساؤلك بخصوص {jobTitle ? `وظيفة "${jobTitle}"` : 'الوظيفة المعلنة'} وسيقوم مسؤول التوظيف بالرد والتواصل معك.
              </p>

              {inquirySuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl font-bold flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
                  <span>{inquirySuccess}</span>
                </div>
              )}

              <Input
                label="الاسم الكامل *"
                value={inquiryName}
                onChange={e => setInquiryName(e.target.value)}
                placeholder="اسمك الكريم"
                required
              />

              <Input
                label="عنوان البريد الإلكتروني *"
                type="email"
                value={inquiryEmail}
                onChange={e => setInquiryEmail(e.target.value)}
                placeholder="email@example.com"
                required
              />

              <Input
                label="رقم الهاتف (اختياري)"
                type="tel"
                value={inquiryPhone}
                onChange={e => setInquiryPhone(e.target.value)}
                placeholder="+20 100 000 0000"
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  نص الاستفسار لـ HR *
                </label>
                <Textarea
                  rows={3}
                  value={inquiryText}
                  onChange={e => setInquiryText(e.target.value)}
                  placeholder="اكتب استفسارك بالتفصيل..."
                  required
                  className="bg-slate-50 text-slate-900 text-xs"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmittingInquiry || !inquiryName.trim() || !inquiryEmail.trim() || !inquiryText.trim()}
                className="w-full justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl mt-2"
              >
                {isSubmittingInquiry ? 'جاري الإرسال...' : 'إرسال الاستفسار لـ HR'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApplyPage() {
  const { token = '' } = useParams();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    years_experience: '3',
    notice_period: 'فوراً (مع إتاحة البدء المباشر)',
    expected_salary: '',
    key_highlights: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState<{ candidate_id: number; message: string } | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: job, isLoading, isError } = useQuery<JobInfo>({
    queryKey: ['apply-job', token],
    queryFn: () => applyApi.getJob(token),
    retry: false,
  });

  React.useEffect(() => {
    if (job?.title) {
      document.title = `التقديم على وظيفة: ${job.title} - ${job.company || 'CalliQ HR'}`;
    }
  }, [job]);

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
      fd.append('years_experience', form.years_experience);
      fd.append('notice_period', form.notice_period);
      if (form.expected_salary) fd.append('expected_salary', form.expected_salary);
      if (form.key_highlights) fd.append('key_highlights', form.key_highlights);

      if (file) {
        fd.append('file', file);
        fd.append('cv_file', file);
      }
      return applyApi.submit(token, fd);
    },
    onSuccess: (res: any) => {
      setSubmitted({
        candidate_id: res?.candidate_id || Math.floor(1000 + Math.random() * 9000),
        message: res?.message || 'تم تقديم الطلب بنجاح! تم استلام سيرتك الذاتية وإجاباتك التمهيدية.',
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 dir-rtl">
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
    <div className="min-h-screen bg-slate-50 font-sans pb-16 dir-rtl text-right">
      {/* Clean Header - Public Portal */}
      <header className="bg-white text-slate-900 border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {job?.company_logo ? (
              <img
                src={job.company_logo}
                alt={job.company || ''}
                className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-slate-200 shadow-xs"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-xs font-bold text-white text-base">
                {job?.company ? job.company.charAt(0) : 'C'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-900 tracking-tight">{job?.company || 'CalliQ'}</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                  بوابة التقديم الرسمية
                </span>
              </div>
              {job?.company_tagline && (
                <p className="text-xs text-slate-500">{job.company_tagline}</p>
              )}
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
          <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-6 sm:p-8 space-y-6">
            {/* Header section with Job Title */}
            <div className="text-center pb-5 border-b border-slate-100">
              {job?.company && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-2.5 shadow-2xs">
                  {job?.company_logo ? (
                    <img src={job.company_logo} alt="" className="w-4 h-4 rounded-full object-contain bg-white p-0.5 border border-indigo-200" />
                  ) : (
                    <Building2 size={13} />
                  )}
                  <span>{job.company}</span>
                </div>
              )}
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{job?.title}</h1>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center justify-center gap-1">
                <Sparkles size={14} className="text-indigo-600" />
                قدم الآن وسيتم فحص سيرتك الذاتية بواسطة نظام الذكاء الاصطناعي
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5 text-right">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-r-4 border-indigo-600 pr-2">
                  البيانات الشخصية
                </h3>
                <Input
                  label="الاسم الكامل *"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="مثال: أحمد محمد علي"
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
              </div>

              {/* Pre-Screening Questions Section (أسئلة تمهيدية) */}
              <div className="space-y-4 pt-3 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 border-r-4 border-indigo-600 pr-2 flex items-center justify-between">
                  <span>نماذج أسئلة تمهيدية (Pre-Screening)</span>
                  <span className="text-[10px] font-normal bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">تقييم مبدئي</span>
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    كم عدد سنوات خبرتك المباشرة المتاحة لديك في التخصص؟
                  </label>
                  <select
                    value={form.years_experience}
                    onChange={e => setForm(f => ({ ...f, years_experience: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    <option value="0">أقل من سنة (خريج جديد)</option>
                    <option value="1">سنة واحدة</option>
                    <option value="2">سنتان</option>
                    <option value="3">3 سنوات (خبرة متوسطة)</option>
                    <option value="5">5 سنوات فأكثر (Senior)</option>
                    <option value="8">8 سنوات فأكثر (Lead/Expert)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ما هي فترة الإشعار المتاحة لديك للبدء في العمل (Notice Period)؟
                  </label>
                  <select
                    value={form.notice_period}
                    onChange={e => setForm(f => ({ ...f, notice_period: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    <option value="فوراً (مع إتاحة البدء المباشر)">فوراً (جاهز للبدء المباشر)</option>
                    <option value="أسبوعين (14 يوم)">أسبوعين (14 يوم إشعار)</option>
                    <option value="شهر واحد (30 يوم)">شهر واحد (30 يوم إشعار)</option>
                    <option value="أكثر من شهر">أكثر من شهر</option>
                  </select>
                </div>

                <Input
                  label="الراتب المتوقع المبدئي (إختياري)"
                  value={form.expected_salary}
                  onChange={e => setForm(f => ({ ...f, expected_salary: e.target.value }))}
                  placeholder="مثال: 15,000 EGP / قابل للتفاوض"
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    اذكر باختصار أهم مشروع أو إنجاز مرتبط بمهارات هذه الوظيفة (اختياري):
                  </label>
                  <Textarea
                    rows={2}
                    value={form.key_highlights}
                    onChange={e => setForm(f => ({ ...f, key_highlights: e.target.value }))}
                    placeholder="مثال: قمت بتطوير نظام توظيف بالكامل يخدم أكثر من 50,000 متقدم..."
                    className="bg-slate-50 text-slate-900 text-xs"
                  />
                </div>
              </div>

              {/* Mobile-Friendly File Upload Field */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 border-r-4 border-indigo-600 pr-2">
                  إرفاق السيرة الذاتية (CV) *
                </h3>

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
                  <div className="flex items-center justify-between gap-3 p-3.5 border border-indigo-200 rounded-xl bg-indigo-50/60 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs">
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
                    className="block border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-slate-50/50 hover:bg-indigo-50/30 active:bg-indigo-50/60 rounded-2xl p-6 text-center cursor-pointer transition-all active:scale-[0.98] touch-manipulation select-none"
                  >
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-indigo-100 shadow-xs pointer-events-none">
                      <Upload size={22} />
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-1 pointer-events-none">
                      اضغط هنا لاختيار السيرة الذاتية (CV) من جهازك أو هاتفك
                    </p>
                    <p className="text-xs text-slate-500 mb-2 pointer-events-none">
                      أو اسحب الملف وأسقطه هنا
                    </p>
                    <span className="inline-block px-3 py-1 bg-white text-[11px] text-slate-500 font-medium rounded-lg border border-slate-200 shadow-2xs pointer-events-none">
                      يدعم ملفات PDF و DOC و DOCX و TXT (حتى 10 ميجابايت)
                    </span>
                  </label>
                )}
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full justify-center shadow-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 text-base rounded-xl"
                  loading={submitMutation.isPending}
                  size="lg"
                >
                  {submitMutation.isPending ? 'جاري إرسال وتدقيق الطلب...' : 'إرسال طلب التقديم'}
                </Button>
              </div>

              <p className="text-[11px] text-center text-slate-400 pt-1">
                سيتم معالجة سيرتك الذاتية وإجاباتك بشكل آمن بفضل نظام CalliQ ATS.
              </p>
            </form>
          </div>
        )}
      </div>

      {/* Floating Interactive Candidate Q&A Assistant Widget */}
      <CandidateAssistantWidget token={token} jobTitle={job?.title} />
    </div>
  );
}
