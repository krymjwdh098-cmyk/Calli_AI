import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail, Send, Sparkles, Copy, Check, ExternalLink,
  FileText, Clock, AlertCircle, RefreshCw, X, UserCheck,
  Eye, CheckCircle2, ArrowRight
} from 'lucide-react';
import { emailsApi } from '../api';
import { useAuthStore } from '../store/auth';
import { Button, Modal, Input, Textarea, Badge, useToast, ScoreRing } from './ui';
import { initials, avatarColor, getStatusBadge } from '../utils';
import type { Candidate } from '../types';

interface SendEmailModalProps {
  candidate: Candidate | null;
  open: boolean;
  onClose: () => void;
  defaultType?: 'followup' | 'interview' | 'shortlist' | 'offer' | 'rejection';
}

// ── Candidate Email Preview Component ───────────────────────────────────────
export function CandidateEmailPreviewCard({
  candidateName,
  recipientEmail,
  subject,
  body,
  senderName,
  date = 'الآن',
}: {
  candidateName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  senderName?: string;
  date?: string;
}) {
  const { user } = useAuthStore();
  const companyLogo = user?.company_logo;
  const companyName = user?.org_name || 'CalliQ ATS';
  const companyTagline = user?.company_tagline || 'Talent Acquisition Platform';
  const companyWebsite = user?.company_website || 'https://calliq.ai';
  const displaySender = senderName || `فريق التوظيف - ${companyName}`;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white text-slate-800 text-xs">
      {/* Email Client Header Bar */}
      <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-medium text-slate-500 mr-2">صندوق الوارد للمرشح (Candidate Inbox View)</span>
        </div>
        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
          معاينة حية لما يظهر للمرشح
        </span>
      </div>

      {/* Meta headers */}
      <div className="p-3.5 bg-slate-50/70 border-b border-slate-100 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-900 leading-snug">
            {subject || '(بدون عنوان)'}
          </h4>
          <span className="text-[11px] text-slate-400 whitespace-nowrap">{date}</span>
        </div>

        <div className="text-[11px] space-y-1 text-slate-600">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-semibold min-w-8">من:</span>
            <span className="font-semibold text-slate-800">{displaySender}</span>
            <span className="text-slate-400 text-[10px] font-mono">&lt;careers@{companyName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com&gt;</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-semibold min-w-8">إلى:</span>
            <span className="font-medium text-slate-700">{candidateName}</span>
            <span className="text-slate-400 text-[10px] font-mono">&lt;{recipientEmail || 'candidate@example.com'}&gt;</span>
          </div>
        </div>
      </div>

      {/* Actual Formatted Email Content as Candidate Sees It */}
      <div className="p-5 space-y-4 bg-white">
        {/* Company Branded Header Banner */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={companyName}
                className="w-9 h-9 rounded-lg object-contain bg-slate-50 p-1 border border-slate-200 shadow-xs"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                {companyName.charAt(0) || 'C'}
              </div>
            )}
            <div>
              <span className="font-bold text-slate-800 block text-xs tracking-tight">{companyName}</span>
              <span className="text-[10px] text-slate-400 block">{companyTagline}</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">إشعار توظيف رسمي</span>
        </div>

        {/* Rendered Body with formatted paragraphs */}
        <div className="text-slate-700 leading-relaxed whitespace-pre-line text-xs font-sans min-h-[100px] p-3 bg-slate-50/40 rounded-lg border border-slate-100">
          {body || 'لا يوجد محتوى في الرسالة...'}
        </div>

        {/* Company Signature */}
        <div className="pt-3 border-t border-slate-100 flex items-start gap-3 bg-slate-50/70 p-3 rounded-lg">
          {companyLogo ? (
            <img
              src={companyLogo}
              alt=""
              className="w-8 h-8 rounded-full object-contain bg-white p-0.5 border border-slate-200 flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
              HR
            </div>
          )}
          <div className="text-[11px] leading-snug">
            <p className="font-semibold text-slate-800">{companyName} Recruitment Team</p>
            <p className="text-slate-500 text-[10px]">قسم الموارد البشرية وإدارة الكفاءات</p>
            <p className="text-slate-400 text-[10px] mt-0.5">{companyWebsite} • careers@{companyName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com</p>
          </div>
        </div>

        {/* Email Footer Disclaimer */}
        <div className="text-[10px] text-slate-400 text-center pt-2">
          تم إرسال هذا البريد تلقائياً عبر منصة {companyName} لإدارة التوظيف. يمكنك الرد مباشرة على هذه الرسالة عبر بريدك الإلكتروني.
        </div>
      </div>
    </div>
  );
}

// ── Main Send Email Modal ──────────────────────────────────────────────────
export function SendEmailModal({ candidate, open, onClose, defaultType = 'followup' }: SendEmailModalProps) {
  const qc = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'compose' | 'preview'>('compose');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [copied, setCopied] = useState(false);
  const [sentSuccessLog, setSentSuccessLog] = useState<any>(null);

  // AI draft state
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiType, setAiType] = useState<string>(defaultType);
  const [aiLanguage, setAiLanguage] = useState<'ar' | 'en'>('ar');
  const [aiInstructions, setAiInstructions] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  // Fetch email templates
  const { data: templates } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => emailsApi.getTemplates(),
    enabled: open,
  });

  // Initialize or reset when candidate changes
  useEffect(() => {
    if (candidate && open) {
      setSentSuccessLog(null);
      setActiveTab('compose');
      setRecipientEmail(candidate.email || '');
      setSelectedTemplateId('');
      setAiType(defaultType);
      
      // Default initial follow-up text
      if (candidate.email) {
        setSubject(`متابعة بخصوص طلب التوظيف - ${candidate.full_name}`);
        setBody(`مرحباً ${candidate.full_name}،\n\nنود المتابعة معك بخصوص طلب التوظيف ومناقشة الخطوات القادمة.\n\nيسعدنا التنسيق معك والرد على أي استفسارات تخص الدور الوظيفي.\n\nمع التحية والتقدير،\nفريق التوظيف والموارد البشرية`);
      } else {
        setSubject(`طلب توظيف - ${candidate.full_name}`);
        setBody(`مرحباً ${candidate.full_name}،\n\nنود التواصل معك بخصوص مراجعة سيرتك الذاتية وتحديث بيانات الاتصال الخاصة بك.`);
      }
    }
  }, [candidate, open, defaultType]);

  const sendMutation = useMutation({
    mutationFn: (payload: {
      candidate_id?: number;
      recipient_email: string;
      recipient_name: string;
      subject: string;
      body: string;
      trigger_event: string;
    }) => emailsApi.send(payload),
    onSuccess: (log) => {
      qc.invalidateQueries({ queryKey: ['candidate-emails', candidate?.id] });
      qc.invalidateQueries({ queryKey: ['candidate', candidate?.id] });
      qc.invalidateQueries({ queryKey: ['candidates'] });
      setSentSuccessLog(log);
      toast('تم إرسال الرسالة بنجاح وتوثيقها في سجل المرشح!', 'success');
    },
    onError: (err: any) => {
      toast(err?.response?.data?.detail || 'فشل إرسال البريد الإلكتروني', 'error');
    },
  });

  const handleTemplateSelect = (tplId: string) => {
    setSelectedTemplateId(tplId);
    if (!tplId) return;
    const tpl = templates?.find(t => t.id === tplId);
    if (tpl && candidate) {
      const replacedSubject = tpl.subject
        .replace(/\{\{candidate_name\}\}/g, candidate.full_name || 'Candidate')
        .replace(/\{\{job_title\}\}/g, candidate.current_position || 'Position')
        .replace(/\{\{company_name\}\}/g, 'CalliQ');

      const replacedBody = tpl.body
        .replace(/\{\{candidate_name\}\}/g, candidate.full_name || 'Candidate')
        .replace(/\{\{job_title\}\}/g, candidate.current_position || 'Position')
        .replace(/\{\{company_name\}\}/g, 'CalliQ')
        .replace(/\{\{interview_date\}\}/g, 'الموعد المحدد')
        .replace(/\{\{interview_link\}\}/g, 'رابط الاجتماع')
        .replace(/\{\{offer_amount\}\}/g, String(candidate.salary_expectation || ''))
        .replace(/\{\{offer_currency\}\}/g, 'USD');

      setSubject(replacedSubject);
      setBody(replacedBody);
    }
  };

  const handleGenerateAiDraft = async () => {
    if (!candidate) return;
    setGeneratingAi(true);
    try {
      const res = await emailsApi.draft({
        candidate_id: candidate.id,
        type: aiType,
        language: aiLanguage,
        instructions: aiInstructions.trim(),
      });
      if (res && res.subject && res.body) {
        setSubject(res.subject);
        setBody(res.body);
        toast('تم توليد نص الرسالة بالذكاء الاصطناعي بنجاح!', 'success');
        setAiExpanded(false);
      }
    } catch {
      toast('تعذر توليد المسودة، تم استخدام النموذج المقترح', 'error');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleCopy = (customText?: string) => {
    const fullText = customText || `الموضوع: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast('تم نسخ نص الرسالة إلى الحافظة!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenGmail = () => {
    if (!recipientEmail) return toast('يرجى تحديد البريد الإلكتروني للمستلم', 'error');
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  const handleOpenMailClient = () => {
    if (!recipientEmail) return toast('يرجى تحديد البريد الإلكتروني للمستلم', 'error');
    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) {
      return toast('يرجى إدخال بريد إلكتروني صحيح للمرشح', 'error');
    }
    if (!subject.trim() || !body.trim()) {
      return toast('يرجى كتابة عنوان الرسالة ونص المحتوى', 'error');
    }

    sendMutation.mutate({
      candidate_id: candidate?.id,
      recipient_email: recipientEmail.trim(),
      recipient_name: candidate?.full_name || 'Candidate',
      subject: subject.trim(),
      body: body.trim(),
      trigger_event: `recruiter_${aiType || 'followup'}`,
    });
  };

  if (!candidate) return null;

  return (
    <Modal open={open} onClose={onClose} title="" width="max-w-2xl">
      <div className="p-1 sm:p-2 space-y-4">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Mail size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                مراسلة ومتابعة المرشح عبر البريد
              </h2>
              <p className="text-xs text-slate-500">
                إرسال رسالة رسمية، دعوة مقابلة، أو متابعة دورية وتوثيقها في سجل المرشح
              </p>
            </div>
          </div>

          {/* Mode Switcher (Compose vs Preview) if not yet sent */}
          {!sentSuccessLog && (
            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('compose')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'compose' ? 'bg-white text-blue-600 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تحرير الرسالة
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  activeTab === 'preview' ? 'bg-white text-blue-600 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye size={13} />
                معاينة ما يراه المرشح
              </button>
            </div>
          )}
        </div>

        {/* Candidate Info Banner */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(candidate.full_name)}`}>
              {initials(candidate.full_name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 text-sm truncate">{candidate.full_name}</span>
                <Badge className={getStatusBadge(candidate.status || 'New')}>{candidate.status || 'New'}</Badge>
              </div>
              <p className="text-xs text-slate-500 truncate">
                {candidate.current_position || 'مرشح'} {candidate.location ? `• ${candidate.location}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">توافق الـ AI</span>
              <span className="text-xs font-bold text-slate-700">{candidate.match_score}%</span>
            </div>
            <ScoreRing score={candidate.match_score} size={36} />
          </div>
        </div>

        {/* ── SUCCESS & CONFIRMATION SCREEN (When email is sent) ────────── */}
        {sentSuccessLog ? (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <span>تم إرسال الرسالة وتوثيقها بنجاح في سجل المرشح!</span>
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                تم حفظ هذه المراسلة في قاعدة البيانات وسجل المتابعة للمرشح <strong>{candidate.full_name}</strong>، وتم تحديد الحالة: <strong>تم الإرسال (Sent)</strong>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-2 border-t border-emerald-200/60 text-emerald-800">
                <div><strong>المستلم:</strong> {sentSuccessLog.candidate_email}</div>
                <div><strong>التوقيت:</strong> {new Date(sentSuccessLog.sent_at).toLocaleTimeString('ar-EG')}</div>
              </div>
            </div>

            {/* Candidate View of what was sent */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Eye size={14} className="text-blue-600" />
                  الشكل الذي يظهر للمرشح في صندوق بريده:
                </span>
                <span className="text-[11px] text-slate-400">تنسيق بريد احترافي</span>
              </div>
              <CandidateEmailPreviewCard
                candidateName={candidate.full_name}
                recipientEmail={sentSuccessLog.candidate_email}
                subject={sentSuccessLog.subject}
                body={sentSuccessLog.body}
                date="الآن"
              />
            </div>

            {/* Direct Delivery Actions Bar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">
                خيارات إضافية للإرسال الفوري المباشر:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleOpenGmail}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  title="فتح نافذة إنشاء الرسالة مباشرة في Gmail مع تعبئة المحتوى والعنوان"
                >
                  <Mail size={13} />
                  <span>إرسال فوري عبر Gmail المباشر</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenMailClient}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span>فتح في تطبيق البريد (Outlook / Mail)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy()}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copied ? 'تم النسخ' : 'نسخ نص الإيميل'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSentSuccessLog(null);
                  setActiveTab('compose');
                }}
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <ArrowRight size={13} />
                <span>إرسال رسالة أخرى</span>
              </button>
              <Button
                size="sm"
                className="bg-slate-800 hover:bg-slate-900 text-white font-semibold"
                onClick={onClose}
              >
                تم والعودة
              </Button>
            </div>
          </div>
        ) : activeTab === 'preview' ? (
          /* ── PREVIEW TAB (Before sending) ────────────────────────────── */
          <div className="space-y-4 animate-in fade-in duration-150">
            <CandidateEmailPreviewCard
              candidateName={candidate.full_name}
              recipientEmail={recipientEmail}
              subject={subject}
              body={body}
              date="الآن (معاينة)"
            />

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setActiveTab('compose')}
              >
                العودة للتحرير
              </Button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenGmail}
                  className="px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="فتح في Gmail"
                >
                  <Mail size={13} />
                  <span>إرسال عبر Gmail</span>
                </button>
                <Button
                  size="sm"
                  icon={<Send size={14} />}
                  onClick={handleSubmit}
                  loading={sendMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  إرسال وتوثيق الآن
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ── COMPOSE TAB ─────────────────────────────────────────────── */
          <>
            {/* Quick Toolbar (Templates & AI Draft) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {/* Preset templates selector */}
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <FileText size={14} className="text-slate-400 flex-shrink-0" />
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">اختيار قالب جاهز (Template)...</option>
                  {templates?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* AI Draft Button */}
              <button
                type="button"
                onClick={() => setAiExpanded(!aiExpanded)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  aiExpanded
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                }`}
              >
                <Sparkles size={13} className={generatingAi ? 'animate-spin' : ''} />
                {aiExpanded ? 'إغلاق صياغة الـ AI' : 'صياغة ذكية بالـ AI'}
              </button>
            </div>

            {/* Expanded AI Drafting Panel */}
            {aiExpanded && (
              <div className="p-3.5 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 rounded-xl border border-purple-200/80 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-600" />
                    توليد نص المتابعة تلقائياً بواسطة الذكاء الاصطناعي
                  </span>
                  <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-purple-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAiLanguage('ar')}
                      className={`px-2 py-0.5 rounded font-medium ${aiLanguage === 'ar' ? 'bg-purple-600 text-white' : 'text-slate-600'}`}
                    >
                      العربية
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiLanguage('en')}
                      className={`px-2 py-0.5 rounded font-medium ${aiLanguage === 'en' ? 'bg-purple-600 text-white' : 'text-slate-600'}`}
                    >
                      English
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 mb-1 block">نوع وهدف الرسالة</label>
                    <select
                      value={aiType}
                      onChange={(e) => setAiType(e.target.value as any)}
                      className="w-full text-xs border border-purple-200 bg-white rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="followup">متابعة واستفسار (Follow-up Check-in)</option>
                      <option value="interview">دعوة لمقابلة عمل (Interview Invitation)</option>
                      <option value="shortlist">إشعار بالقبول المبدئي (Shortlisted)</option>
                      <option value="offer">تقديم عرض عمل رسمي (Job Offer)</option>
                      <option value="rejection">اعتذار مهني مع شكر (Polite Rejection)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 mb-1 block">ملاحظات أو تفاصيل إضافية (اختياري)</label>
                    <input
                      type="text"
                      placeholder="مثال: نرجو الحضور يوم الثلاثاء الساعة 2 ظهراً"
                      value={aiInstructions}
                      onChange={(e) => setAiInstructions(e.target.value)}
                      className="w-full text-xs border border-purple-200 bg-white rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                    icon={<Sparkles size={13} />}
                    onClick={handleGenerateAiDraft}
                    loading={generatingAi}
                  >
                    {generatingAi ? 'جاري الصياغة...' : 'توليد الرسالة الآن'}
                  </Button>
                </div>
              </div>
            )}

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Recipient email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  البريد الإلكتروني للمستلم
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  {!candidate.email && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-600 mt-1">
                      <AlertCircle size={12} />
                      <span>لم يتم العثور على بريد في السيرة الذاتية، يرجى كتابة بريد المرشح يدوياً.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  عنوان الموضوع (Subject)
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: متابعة بخصوص طلب التوظيف..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    نص الرسالة (Message Body)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy()}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    {copied ? 'تم النسخ!' : 'نسخ النص'}
                  </button>
                </div>
                <textarea
                  required
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="اكتب تفاصيل الرسالة هنا..."
                  className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed font-sans"
                />
              </div>

              {/* Footer actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenGmail}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="فتح في Gmail مباشرة"
                  >
                    <Mail size={13} />
                    <span>إرسال عبر Gmail</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenMailClient}
                    className="text-xs text-slate-600 hover:text-blue-600 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="فتح في تطبيق البريد الخارجي الافتراضي (Outlook / Mail)"
                  >
                    <ExternalLink size={13} />
                    <span>تطبيق البريد</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>معاينة الإيميل</span>
                  </button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onClose}
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    icon={<Send size={14} />}
                    loading={sendMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {sendMutation.isPending ? 'جاري الإرسال والتوثيق...' : 'إرسال وتوثيق في السجل'}
                  </Button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}
