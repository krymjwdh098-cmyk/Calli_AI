import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Mail, Phone, MapPin, Linkedin, Github, Globe,
  Briefcase, GraduationCap, Award, Languages as LanguagesIcon,
  CheckCircle, XCircle, Flag, Download, RefreshCw, Send,
  AlertTriangle, Clock, Calendar, DollarSign, MessageSquare,
  ThumbsUp, ThumbsDown, ChevronRight, Sparkles, Target, TrendingUp,
  Trash2, ExternalLink, Copy, Check, FileText, Eye, HelpCircle, FolderGit2, FolderHeart, Play
} from 'lucide-react';
import { candidatesApi, emailsApi, inquiriesApi, talentPoolsApi, sequencesApi } from '../api';
import { Layout } from '../components/layout/Layout';
import { SendEmailModal, CandidateEmailPreviewCard } from '../components/SendEmailModal';
import {
  Button, Badge, Card, Modal, Skeleton, useToast, Select,
  Textarea, Tabs, ScoreRing, ProgressBar, Input,
} from '../components/ui';
import {
  getScoreColor, getCategoryBadge, getCategoryLabel, getStatusBadge,
  getRecommendationBadge, initials, avatarColor, formatDate, formatDateTime,
  formatSalary, PIPELINE_STAGES, TERMINAL_STAGES,
} from '../utils';
import type { Candidate } from '../types';

// ── Score breakdown row ─────────────────────────────────────────────
function ScoreRow({ label, value, weight }: { label: string; value: number; weight?: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">{label}{weight ? ` (${Math.round(weight * 100)}%)` : ''}</span>
        <span className={`text-xs font-semibold ${getScoreColor(value)}`}>{Math.round(value)}</span>
      </div>
      <ProgressBar value={value} color={value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-blue-500' : value >= 40 ? 'bg-amber-500' : 'bg-slate-400'} />
    </div>
  );
}

// ── Decision Modal ───────────────────────────────────────────────────
function DecisionModal({ candidate, decision, open, onClose }: {
  candidate: Candidate; decision: 'APPROVED' | 'REJECTED'; open: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () => candidatesApi.decide(candidate.id, decision, notes || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', candidate.id] });
      toast(decision === 'APPROVED' ? 'Candidate shortlisted' : 'Candidate rejected', 'success');
      setNotes('');
      onClose();
    },
    onError: () => toast('Failed to record decision', 'error'),
  });

  return (
    <Modal open={open} onClose={onClose} title={decision === 'APPROVED' ? 'Shortlist candidate' : 'Reject candidate'}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {decision === 'APPROVED'
            ? `Move ${candidate.full_name} to the shortlist. They'll be notified automatically.`
            : `${candidate.full_name} will be notified their application was not successful.`}
        </p>
        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add context for your team..."
          rows={3}
        />
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
          <Button
            variant={decision === 'APPROVED' ? 'primary' : 'danger'}
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            className="flex-1 justify-center"
          >
            Confirm
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Schedule Interview Modal ─────────────────────────────────────────
function InterviewModal({ candidate, open, onClose }: { candidate: Candidate; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    scheduled_at: '', interview_type: 'video', location: '', link: '', duration_mins: 60, notes: '',
  });

  const mutation = useMutation({
    mutationFn: () => candidatesApi.scheduleInterview(candidate.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', candidate.id] });
      toast('Interview scheduled and candidate notified', 'success');
      onClose();
    },
    onError: () => toast('Failed to schedule interview', 'error'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Schedule interview">
      <div className="space-y-4">
        <Input
          label="Date & time"
          type="datetime-local"
          value={form.scheduled_at}
          onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
          required
        />
        <Select
          label="Type"
          value={form.interview_type}
          onChange={e => setForm(f => ({ ...f, interview_type: e.target.value }))}
          options={[
            { value: 'video', label: 'Video call' },
            { value: 'phone', label: 'Phone' },
            { value: 'technical', label: 'Technical' },
            { value: 'onsite', label: 'Onsite / Final' },
          ]}
        />
        <Input
          label="Meeting link (optional)"
          value={form.link}
          onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
          placeholder="https://meet.google.com/..."
        />
        <Input
          label="Location (optional)"
          value={form.location}
          onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
          placeholder="Office address"
        />
        <Input
          label="Duration (minutes)"
          type="number"
          value={form.duration_mins}
          onChange={e => setForm(f => ({ ...f, duration_mins: +e.target.value }))}
        />
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={2}
        />
        <Button
          className="w-full justify-center"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!form.scheduled_at}
        >
          Schedule & notify candidate
        </Button>
      </div>
    </Modal>
  );
}

// ── Send Offer Modal ──────────────────────────────────────────────────
function OfferModal({ candidate, open, onClose }: { candidate: Candidate; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ amount: candidate.salary_expectation || 0, currency: 'EGP', deadline_days: 7, notes: '' });

  const mutation = useMutation({
    mutationFn: () => candidatesApi.sendOffer(candidate.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', candidate.id] });
      toast('Offer sent to candidate', 'success');
      onClose();
    },
    onError: () => toast('Failed to send offer', 'error'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Send offer">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Amount"
            type="number"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))}
          />
          <Select
            label="Currency"
            value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            options={[{ value: 'EGP', label: 'EGP' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]}
          />
        </div>
        <Input
          label="Response deadline (days)"
          type="number"
          value={form.deadline_days}
          onChange={e => setForm(f => ({ ...f, deadline_days: +e.target.value }))}
        />
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          rows={2}
        />
        <Button
          className="w-full justify-center"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!form.amount}
        >
          Send offer & notify candidate
        </Button>
      </div>
    </Modal>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────
function ChatPanel({ candidate }: { candidate: Candidate }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (msg: string) => candidatesApi.chat(candidate.id, msg),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', candidate.id] });
      setMessage('');
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [candidate.chat_history.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    mutation.mutate(message.trim());
  };

  return (
    <Card padding={false} className="flex flex-col h-[520px]">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Sparkles size={15} className="text-blue-600" />
        <span className="text-sm font-semibold text-slate-700">Ask the AI about this candidate</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {candidate.chat_history.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            Ask things like "What are their strengths?" or "How does their experience match this role?"
          </p>
        )}
        {candidate.chat_history.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-400">Thinking…</div>
          </div>
        )}
      </div>
      <form onSubmit={handleSend} className="p-3 border-t border-slate-100 flex gap-2">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button type="submit" size="sm" loading={mutation.isPending} disabled={!message.trim()}>
          <Send size={14} />
        </Button>
      </form>
    </Card>
  );
}

// ── Email Log & Communication Panel ─────────────────────────────────
function EmailLogPanel({ candidate }: { candidate: Candidate }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [recipientEmail, setRecipientEmail] = useState(candidate.email || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [aiExpanded, setAiExpanded] = useState(false);
  const [aiType, setAiType] = useState('followup');
  const [aiLanguage, setAiLanguage] = useState<'ar' | 'en'>('ar');
  const [aiInstructions, setAiInstructions] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewComposerOpen, setPreviewComposerOpen] = useState(false);
  const [selectedLogForPreview, setSelectedLogForPreview] = useState<any>(null);

  useEffect(() => {
    setRecipientEmail(candidate.email || '');
  }, [candidate.email]);

  const { data: emailLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['candidate-emails', candidate.id],
    queryFn: () => emailsApi.list({ candidate_id: candidate.id }),
  });

  const { data: templates } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => emailsApi.getTemplates(),
  });

  const handleTemplateSelect = (tplId: string) => {
    setSelectedTemplate(tplId);
    const tpl = templates?.find(t => t.id === tplId);
    if (tpl) {
      setSubject(
        tpl.subject
          .replace(/\{\{candidate_name\}\}/g, candidate.full_name || 'Candidate')
          .replace(/\{\{job_title\}\}/g, candidate.current_position || 'Position')
          .replace(/\{\{company_name\}\}/g, 'CalliQ')
      );
      setBody(
        tpl.body
          .replace(/\{\{candidate_name\}\}/g, candidate.full_name || 'Candidate')
          .replace(/\{\{job_title\}\}/g, candidate.current_position || 'Position')
          .replace(/\{\{company_name\}\}/g, 'CalliQ')
          .replace(/\{\{interview_date\}\}/g, 'الموعد المحدد')
          .replace(/\{\{interview_link\}\}/g, 'Google Meet')
      );
    }
  };

  const handleAiDraft = async () => {
    setGeneratingAi(true);
    try {
      const res = await emailsApi.draft({
        candidate_id: candidate.id,
        type: aiType,
        language: aiLanguage,
        instructions: aiInstructions.trim(),
      });
      if (res?.subject && res?.body) {
        setSubject(res.subject);
        setBody(res.body);
        toast('تم توليد نص الرسالة بنجاح بالـ AI!', 'success');
        setAiExpanded(false);
      }
    } catch {
      toast('تعذر توليد المسودة بالذكاء الاصطناعي', 'error');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSend = async () => {
    if (!recipientEmail.trim()) return toast('يرجى تحديد البريد الإلكتروني للمستلم', 'error');
    if (!subject.trim() || !body.trim()) return toast('يرجى كتابة عنوان الموضوع ومحتوى الرسالة', 'error');
    setSending(true);
    try {
      const sentLog = await emailsApi.send({
        candidate_id: candidate.id,
        recipient_email: recipientEmail.trim(),
        recipient_name: candidate.full_name,
        subject: subject.trim(),
        body: body.trim(),
        trigger_event: `recruiter_${aiType || 'manual_email'}`,
      });
      toast('تم إرسال الرسالة وتوثيقها في السجل بنجاح!', 'success');
      qc.invalidateQueries({ queryKey: ['candidate-emails', candidate.id] });
      setSelectedLogForPreview(sentLog);
    } catch {
      toast('فشل إرسال البريد الإلكتروني', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteLog = async (logId: number) => {
    try {
      await emailsApi.deleteLog(logId);
      qc.invalidateQueries({ queryKey: ['candidate-emails', candidate.id] });
      toast('تم حذف سجل الرسالة بنجاح', 'success');
    } catch {
      toast('فشل حذف سجل الرسالة', 'error');
    }
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(`الموضوع: ${subject}\n\n${body}`);
    setCopied(true);
    toast('تم النسخ إلى الحافظة!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenGmail = () => {
    if (!recipientEmail) return toast('يرجى إدخال البريد الإلكتروني للمستلم', 'error');
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  const handleOpenClient = () => {
    if (!recipientEmail) return toast('يرجى إدخال البريد الإلكتروني', 'error');
    const mailto = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <Mail size={16} className="text-blue-600" /> مراسلة ومتابعة المرشح
          </h3>
          <button
            type="button"
            onClick={() => setAiExpanded(!aiExpanded)}
            className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              aiExpanded
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
            }`}
          >
            <Sparkles size={12} className={generatingAi ? 'animate-spin' : ''} />
            {aiExpanded ? 'إغلاق الـ AI' : 'صياغة بالـ AI'}
          </button>
        </div>

        {/* AI Drafting Drawer */}
        {aiExpanded && (
          <div className="mb-3.5 p-3 bg-purple-50/80 rounded-xl border border-purple-200 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                <Sparkles size={13} className="text-purple-600" />
                توليد رسالة مخصصة للمرشح
              </span>
              <div className="flex items-center gap-1 bg-white rounded-md p-0.5 border border-purple-200 text-[10px]">
                <button
                  type="button"
                  onClick={() => setAiLanguage('ar')}
                  className={`px-2 py-0.5 rounded ${aiLanguage === 'ar' ? 'bg-purple-600 text-white font-bold' : 'text-slate-600'}`}
                >
                  عربي
                </button>
                <button
                  type="button"
                  onClick={() => setAiLanguage('en')}
                  className={`px-2 py-0.5 rounded ${aiLanguage === 'en' ? 'bg-purple-600 text-white font-bold' : 'text-slate-600'}`}
                >
                  English
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-700 mb-0.5 block">الهدف من الرسالة</label>
                <select
                  value={aiType}
                  onChange={e => setAiType(e.target.value)}
                  className="w-full text-xs border border-purple-200 bg-white rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="followup">متابعة واستفسار (Follow-up)</option>
                  <option value="interview">دعوة لمقابلة (Interview)</option>
                  <option value="shortlist">قبول مبدئي (Shortlist)</option>
                  <option value="offer">عرض عمل (Job Offer)</option>
                  <option value="rejection">اعتذار مع شكر (Rejection)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-700 mb-0.5 block">تعليمات إضافية (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: التأكيد على المقابلة التقنية"
                  value={aiInstructions}
                  onChange={e => setAiInstructions(e.target.value)}
                  className="w-full text-xs border border-purple-200 bg-white rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs !py-1"
                icon={<Sparkles size={12} />}
                onClick={handleAiDraft}
                loading={generatingAi}
              >
                توليد الرسالة
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">القوالب السريعة (Templates)</label>
            <select
              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-white"
              value={selectedTemplate}
              onChange={e => handleTemplateSelect(e.target.value)}
            >
              <option value="">اختيار قالب جاهز...</option>
              {templates?.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">البريد الإلكتروني للمستلم</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">عنوان الموضوع</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="مثال: متابعة بخصوص طلب التوظيف..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-600">نص الرسالة</label>
              <button
                type="button"
                onClick={handleCopyBody}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
            </div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={5}
              placeholder="اكتب نص الرسالة هنا..."
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenGmail}
                className="text-xs text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-100 flex items-center gap-1 transition-colors cursor-pointer"
                title="فتح وإرسال فوري من Gmail المباشر"
              >
                <Mail size={12} />
                <span>إرسال عبر Gmail</span>
              </button>
              <button
                type="button"
                onClick={handleOpenClient}
                className="text-xs text-slate-600 hover:text-blue-600 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1 hover:bg-slate-50 transition-colors"
              >
                <ExternalLink size={12} />
                <span>برنامج البريد</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewComposerOpen(true)}
                className="text-xs text-blue-600 hover:text-blue-800 px-2.5 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <Eye size={12} />
                <span>معاينة</span>
              </button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                icon={<Send size={14} />}
                onClick={handleSend}
                loading={sending}
              >
                إرسال وتوثيق في السجل
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <Clock size={16} className="text-slate-500" /> سجل المراسلات والإشعارات
        </h3>
        {logsLoading ? (
          <Skeleton className="h-40" />
        ) : !emailLogs || emailLogs.length === 0 ? (
          <div className="text-center py-10">
            <Mail size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs text-slate-500 font-medium">لا توجد رسائل مسجلة لهذا المرشح بعد.</p>
            <p className="text-[11px] text-slate-400 mt-1">يمكنك إرسال متابعة أو دعوة مقابلة لحفظها في السجل.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
            {emailLogs.map(log => (
              <div key={log.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5 relative group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 line-clamp-1">{log.subject}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">{log.status}</Badge>
                    <button
                      type="button"
                      onClick={() => handleDeleteLog(log.id)}
                      className="text-slate-300 hover:text-red-500 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="حذف من السجل"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed line-clamp-3">{log.body}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-200/60 mt-1">
                  <span>إلى: {log.candidate_email}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLogForPreview(log)}
                      className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold bg-blue-50/80 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors cursor-pointer"
                    >
                      <Eye size={11} />
                      <span>معاينة ما وصل للمرشح</span>
                    </button>
                    <span>{formatDateTime(log.sent_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal for Previewing Candidate Email Before Sending */}
      {previewComposerOpen && (
        <Modal
          open={previewComposerOpen}
          onClose={() => setPreviewComposerOpen(false)}
          title="معاينة شكل الرسالة كما تظهر للمرشح"
          width="max-w-2xl"
        >
          <div className="p-2 space-y-4">
            <CandidateEmailPreviewCard
              candidateName={candidate.full_name}
              recipientEmail={recipientEmail}
              subject={subject}
              body={body}
              date="الآن (معاينة)"
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setPreviewComposerOpen(false)}>
                إغلاق
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { setPreviewComposerOpen(false); handleSend(); }}>
                إرسال الآن
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal for Previewing Delivered Email from History */}
      {selectedLogForPreview && (
        <Modal
          open={!!selectedLogForPreview}
          onClose={() => setSelectedLogForPreview(null)}
          title="تفاصيل ومعاينة الرسالة المرسلة للمرشح"
          width="max-w-2xl"
        >
          <div className="p-2 space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold">الحالة: {selectedLogForPreview.status} (تم الإرسال والتوثيق)</span>
                <p className="text-[11px] text-emerald-700 mt-0.5">مرسلة بواسطة: {selectedLogForPreview.sent_by || 'المسؤول'}</p>
              </div>
              <span className="text-[11px] font-mono text-emerald-800">{formatDateTime(selectedLogForPreview.sent_at)}</span>
            </div>

            <CandidateEmailPreviewCard
              candidateName={selectedLogForPreview.candidate_name || candidate.full_name}
              recipientEmail={selectedLogForPreview.candidate_email}
              subject={selectedLogForPreview.subject}
              body={selectedLogForPreview.body}
              date={formatDateTime(selectedLogForPreview.sent_at)}
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(selectedLogForPreview.candidate_email)}&su=${encodeURIComponent(selectedLogForPreview.subject)}&body=${encodeURIComponent(selectedLogForPreview.body)}`;
                  window.open(gmailUrl, '_blank');
                }}
                className="text-xs text-red-600 hover:bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Mail size={12} />
                <span>إرسال نسخة عبر Gmail</span>
              </button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedLogForPreview(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Candidate CV & Direct Application Details Panel ────────────────────
function CandidateCVPanel({ candidate }: { candidate: Candidate }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyCV = () => {
    if (!candidate.file_content) return toast('لا يوجد نص سيرته ذاتية متاح للنسخ', 'error');
    navigator.clipboard.writeText(candidate.file_content);
    setCopied(true);
    toast('تم نسخ محتوى السيرة الذاتية والبيانات المرفقة بالحافظة!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 font-sans text-right dir-rtl">
      {/* Submitted Application Data Summary Header */}
      <Card className="p-5 border-l-4 border-l-indigo-600 bg-gradient-to-l from-white via-indigo-50/20 to-white shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600" />
            <span>بيانات التقديم المباشر والأسئلة التمهيدية (Screening Summary)</span>
          </h3>
          <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200">
            {candidate.source || 'بوابة التوظيف العامة'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">الراتب المتوقع (Expected Salary):</span>
            <span className="text-sm font-extrabold text-slate-900">
              {candidate.salary_expectation
                ? formatSalary(candidate.salary_expectation, candidate.salary_currency)
                : 'غير مخصص'}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">فترة الإشعار (Notice Period):</span>
            <span className="text-sm font-extrabold text-slate-900">
              {candidate.remote_preference || (candidate.notice_period_days != null ? `${candidate.notice_period_days} يوم` : 'غير محددة')}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 block mb-1">سنوات الخبرة المباشرة:</span>
            <span className="text-sm font-extrabold text-slate-900">
              {candidate.years_experience != null ? `${candidate.years_experience} سنوات` : 'غير محددة'}
            </span>
          </div>
        </div>

        {candidate.decision_notes && (
          <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-950">
            <span className="font-bold text-indigo-700 block mb-1">أبرز المشاريع والإنجازات التي ذكرها المرشح:</span>
            <p className="whitespace-pre-line leading-relaxed">{candidate.decision_notes.replace('[أبرز المشاريع والإنجازات المذكورة عند التقديم]: ', '')}</p>
          </div>
        )}
      </Card>

      {/* CV Raw Text Container */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">محتوى السيرة الذاتية الأصلي ومعلومات الطلب (Full CV & Application Text)</h3>
            {candidate.file_name && (
              <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full font-mono">
                {candidate.file_name}
              </span>
            )}
          </div>
          {candidate.file_content && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyCV}
              className="text-xs flex items-center gap-1.5"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'تم النسخ' : 'نسخ النص بالكامل'}</span>
            </Button>
          )}
        </div>

        {candidate.file_content ? (
          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono leading-relaxed overflow-x-auto max-h-[600px] overflow-y-auto whitespace-pre-wrap border border-slate-800">
            {candidate.file_content}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <FileText size={36} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-medium">لم يتم إرفاق ملف سيرة ذاتية نصي أو أن النص غير متاح للمعالجة.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Candidate Inquiries Panel ───────────────────────────────────────────
function CandidateInquiriesPanel({ candidate }: { candidate: Candidate }) {
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['candidate-inquiries', candidate.email],
    queryFn: () => inquiriesApi.list({ search: candidate.email }),
    enabled: !!candidate.email,
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <HelpCircle size={16} className="text-indigo-600" />
          استفسارات وتساؤلات المرشح (Candidate Inquiries)
        </h3>
        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
          إجمالي الاستفسارات: {inquiries.length}
        </Badge>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400 py-4 text-center">جاري تحميل الاستفسارات...</p>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-8 text-slate-500 space-y-2">
          <HelpCircle size={32} className="mx-auto text-slate-300" />
          <p className="text-xs font-medium">لم يقم هذا المرشح بأي استفسارات سابقة من رابط التقديم.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inquiries.map((inquiry: any) => (
            <div key={inquiry.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold text-slate-800">{inquiry.job_title}</span>
                <span>{new Date(inquiry.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-900 font-semibold">
                <span className="text-indigo-600 font-bold block mb-1">السؤال:</span>
                "{inquiry.question}"
              </div>
              {inquiry.ai_answer && (
                <div className="bg-indigo-50/70 p-3 rounded-lg border border-indigo-100 text-xs text-indigo-950">
                  <span className="text-indigo-700 font-bold block mb-1">إجابة Gemini AI المولد آلياً:</span>
                  {inquiry.ai_answer}
                </div>
              )}
              {inquiry.hr_reply && (
                <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200 text-xs text-emerald-950 font-medium">
                  <span className="text-emerald-700 font-bold block mb-1">رد مسؤول التوظيف (مُرسل للبريد):</span>
                  {inquiry.hr_reply}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export function CandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const candidateId = Number(id);

  const [tab, setTab] = useState(0);
  const [decisionModal, setDecisionModal] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [interviewModal, setInterviewModal] = useState(false);
  const [offerModal, setOfferModal] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [talentPoolModalOpen, setTalentPoolModalOpen] = useState(false);
  const [sequenceModalOpen, setSequenceModalOpen] = useState(false);
  const [selectedSeqId, setSelectedSeqId] = useState<number | ''>('');

  const { data: talentPools = [] } = useQuery({
    queryKey: ['talent-pools'],
    queryFn: () => talentPoolsApi.list(),
  });

  const { data: sequences = [] } = useQuery({
    queryKey: ['sequences'],
    queryFn: () => sequencesApi.list(),
  });

  const enrollCandidateSeqMutation = useMutation({
    mutationFn: (seqId: number) => sequencesApi.enroll(seqId, { candidate_ids: [candidateId] }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['sequences'] });
      toast(res.message || 'تم تفعيل السلسلة التلقائية للمرشح بنجاح', 'success');
      setSequenceModalOpen(false);
      setSelectedSeqId('');
    },
    onError: (err: any) => toast(err.response?.data?.detail || 'فشل تفعيل السلسلة التلقائية', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => candidatesApi.delete(candidateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      toast('Candidate deleted successfully', 'success');
      navigate('/candidates');
    },
    onError: () => toast('Failed to delete candidate', 'error'),
  });

  const { data: candidate, isLoading } = useQuery({
    queryKey: ['candidate', candidateId],
    queryFn: () => candidatesApi.get(candidateId),
    enabled: !!candidateId,
    refetchInterval: (q) => (['Queued', 'Processing'].includes(q.state.data?.status || '') ? 3000 : false),
  });

  const { data: timeline } = useQuery({
    queryKey: ['candidate-timeline', candidateId],
    queryFn: () => candidatesApi.getTimeline(candidateId),
    enabled: !!candidateId && tab === 2,
  });

  const stageMutation = useMutation({
    mutationFn: (stage: string) => candidatesApi.pipelineMove(candidateId, stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', candidateId] });
      qc.invalidateQueries({ queryKey: ['candidate-timeline', candidateId] });
      toast('Pipeline stage updated', 'success');
    },
  });

  const flagMutation = useMutation({
    mutationFn: () => candidate?.flagged
      ? candidatesApi.unflag(candidateId)
      : candidatesApi.flag(candidateId, flagReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', candidateId] });
      toast(candidate?.flagged ? 'Flag removed' : 'Candidate flagged', 'success');
      setFlagOpen(false);
      setFlagReason('');
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: () => candidatesApi.reprocess(candidateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', candidateId] });
      toast('Reprocessing started', 'success');
    },
  });

  const reEvaluateMutation = useMutation({
    mutationFn: () => candidatesApi.reEvaluate(candidateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', candidateId] });
      qc.invalidateQueries({ queryKey: ['candidates'] });
      toast('AI Re-evaluation completed successfully', 'success');
    },
    onError: () => toast('AI Evaluation failed', 'error'),
  });

  const syncNotionMutation = useMutation({
    mutationFn: () => candidatesApi.syncToNotion(candidateId),
    onSuccess: (data: any) => {
      toast(data.message || 'Successfully synced to Notion', 'success');
    },
    onError: (err: any) => {
      toast(err?.response?.data?.detail || 'Failed to sync to Notion', 'error');
    },
  });

  if (isLoading || !candidate) {
    return (
      <Layout>
        <Skeleton className="h-40 mb-4" />
        <Skeleton className="h-96" />
      </Layout>
    );
  }

  const c = candidate;
  const isProcessing = ['Queued', 'Processing'].includes(c.status);
  const skillEntries = Object.entries(c.technical_skills || {});

  return (
    <Layout>
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Back
      </button>

      {/* Header card */}
      <Card className="mb-4">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${avatarColor(c.full_name)}`}>
              {initials(c.full_name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-slate-800">{c.full_name}</h1>
                {c.is_knocked_out && <Badge className="bg-red-100 text-red-700"><AlertTriangle size={11} className="mr-1" />Knocked out</Badge>}
                {c.flagged && <Badge className="bg-amber-100 text-amber-700"><Flag size={11} className="mr-1" />Flagged</Badge>}
              </div>
              {c.current_position && <p className="text-sm text-slate-500 mb-2">{c.current_position}</p>}
              <div className="flex flex-wrap gap-3 text-sm text-slate-500 items-center">
                {c.email && (
                  <button
                    type="button"
                    onClick={() => setEmailModalOpen(true)}
                    className="flex items-center gap-1.5 hover:text-blue-700 bg-blue-50/80 hover:bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md font-medium text-xs transition-colors cursor-pointer"
                    title="مراسلة ومتابعة المرشح عبر البريد الإلكتروني"
                  >
                    <Mail size={13} />
                    <span>{c.email}</span>
                  </button>
                )}
                {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-blue-600"><Phone size={13} />{c.phone}</a>}
                {c.location && <span className="flex items-center gap-1"><MapPin size={13} />{c.location}</span>}
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600"><Linkedin size={16} /></a>}
                {c.github && <a href={c.github} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-800"><Github size={16} /></a>}
                {c.portfolio && <a href={c.portfolio} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600"><Globe size={16} /></a>}
              </div>

              {/* Talent CRM Pools badges */}
              {talentPools.filter(p => p.candidate_ids?.includes(c.id)).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                    <FolderHeart size={12} className="text-purple-600" />
                    بنوك المواهب:
                  </span>
                  {talentPools.filter(p => p.candidate_ids?.includes(c.id)).map(pool => (
                    <span
                      key={pool.id}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      {pool.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {isProcessing ? (
              <div className="flex flex-col items-center gap-1 px-4">
                <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-blue-500 animate-spin" />
                <span className="text-xs text-slate-400 mt-1">{c.status}…</span>
              </div>
            ) : (
              <ScoreRing score={c.match_score} size={72} />
            )}
            <div className="flex flex-col gap-1.5">
              <Badge className={getStatusBadge(c.status)}>{c.status}</Badge>
              {c.category && <Badge className={getCategoryBadge(c.category)}>{getCategoryLabel(c.category)}</Badge>}
              {c.recommendation && <Badge className={getRecommendationBadge(c.recommendation)}>{c.recommendation}</Badge>}
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
          <Button size="sm" icon={<ThumbsUp size={14} />} onClick={() => setDecisionModal('APPROVED')} disabled={c.recruiter_decision === 'APPROVED'}>
            Shortlist
          </Button>
          <Button size="sm" variant="danger" icon={<ThumbsDown size={14} />} onClick={() => setDecisionModal('REJECTED')} disabled={c.recruiter_decision === 'REJECTED'}>
            Reject
          </Button>
          <Button size="sm" variant="outline" icon={<Calendar size={14} />} onClick={() => setInterviewModal(true)}>
            Schedule interview
          </Button>
          <Button size="sm" variant="outline" icon={<DollarSign size={14} />} onClick={() => setOfferModal(true)}>
            Send offer
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
            icon={<Mail size={14} />}
            onClick={() => setEmailModalOpen(true)}
          >
            مراسلة بالإيميل
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-purple-600 border-purple-200 hover:bg-purple-50"
            icon={<FolderHeart size={14} />}
            onClick={() => setTalentPoolModalOpen(true)}
          >
            بنك المواهب
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            icon={<Send size={14} />}
            onClick={() => setSequenceModalOpen(true)}
          >
            سلسلة رسائل تلقائية
          </Button>
          <Select
            value={c.pipeline_stage || c.status}
            onChange={e => stageMutation.mutate(e.target.value)}
            options={[...PIPELINE_STAGES, ...TERMINAL_STAGES].map(s => ({ value: s, label: s }))}
            className="!py-1.5 text-xs w-40"
          />
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" icon={<Sparkles size={14} className="text-blue-600" />} onClick={() => reEvaluateMutation.mutate()} loading={reEvaluateMutation.isPending}>
            Re-evaluate AI
          </Button>
          <Button size="sm" variant="ghost" icon={<Flag size={14} className={c.flagged ? 'text-amber-500' : ''} />} onClick={() => c.flagged ? flagMutation.mutate() : setFlagOpen(true)}>
            {c.flagged ? 'Unflag' : 'Flag'}
          </Button>
          <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setDeleteConfirmOpen(true)}>
            Delete Candidate
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        tabs={[
          { label: 'Overview', icon: <Briefcase size={14} /> },
          { label: 'السيرة الذاتية والتقديم', icon: <FileText size={14} /> },
          { label: 'AI Analysis', icon: <Target size={14} /> },
          { label: 'Timeline', icon: <Clock size={14} /> },
          { label: 'Chat', icon: <MessageSquare size={14} /> },
          { label: 'Email & Notifications', icon: <Mail size={14} /> },
          { label: 'الاستفسارات (Inquiries)', icon: <HelpCircle size={14} /> },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {/* ── Overview ────────────────────────────────────────────── */}
        {tab === 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              {/* Direct Application Submitted Info Card */}
              {(c.salary_expectation != null || c.notice_period_days != null || c.decision_notes || c.remote_preference) && (
                <Card className="border-r-4 border-r-blue-600 bg-gradient-to-r from-blue-50/40 via-white to-white">
                  <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-600" />
                    <span>بيانات التقديم المباشر والأسئلة التمهيدية (Submitted Application Details)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                    <div className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                      <span className="text-slate-400 block mb-0.5">الراتب المتوقع (Salary):</span>
                      <span className="font-bold text-slate-800">
                        {c.salary_expectation ? formatSalary(c.salary_expectation, c.salary_currency) : 'غير مخصص'}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                      <span className="text-slate-400 block mb-0.5">فترة الإشعار (Notice Period):</span>
                      <span className="font-bold text-slate-800">
                        {c.remote_preference || (c.notice_period_days != null ? `${c.notice_period_days} يوم` : 'غير محددة')}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                      <span className="text-slate-400 block mb-0.5">خبرة مصرح بها (Exp):</span>
                      <span className="font-bold text-slate-800">{c.years_experience} سنوات</span>
                    </div>
                  </div>
                  {c.decision_notes && (
                    <div className="p-3 bg-blue-50/80 rounded-lg text-xs text-blue-900 leading-relaxed border border-blue-100">
                      <strong className="block mb-1 text-blue-700">أبرز المشاريع والإنجازات المذكورة عند التقديم:</strong>
                      {c.decision_notes.replace('[أبرز المشاريع والإنجازات المذكورة عند التقديم]: ', '')}
                    </div>
                  )}
                </Card>
              )}

              {c.ai_summary && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-blue-600" /> AI Summary
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{c.ai_summary}</p>
                </Card>
              )}

              {c.previous_positions.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Briefcase size={14} /> Experience — {c.years_experience} years
                  </h3>
                  <div className="space-y-3">
                    {c.previous_positions.map((p, i) => (
                      <div key={i} className="flex gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">{p.title}</p>
                          <p className="text-xs text-slate-500">{p.company} {p.start && `· ${p.start} – ${p.end || 'Present'}`}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {c.projects && c.projects.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <FolderGit2 size={14} className="text-blue-600" /> Key Projects & Highlights
                  </h3>
                  <div className="space-y-3">
                    {c.projects.map((proj, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <p className="text-sm font-bold text-slate-800">{proj.name}</p>
                        {proj.description && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{proj.description}</p>}
                        {proj.technologies && proj.technologies.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {proj.technologies.map(t => (
                              <span key={t} className="px-2 py-0.5 bg-white text-slate-500 text-[10px] rounded border border-slate-200">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {c.education.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <GraduationCap size={14} /> Education
                  </h3>
                  <div className="space-y-3">
                    {c.education.map((e, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium text-slate-700">{e.degree} {e.field && `in ${e.field}`}</p>
                        <p className="text-xs text-slate-500">{e.institution} {e.year && `· ${e.year}`}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {skillEntries.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Skills</h3>
                  <div className="space-y-3">
                    {skillEntries.map(([cat, skills]) => (
                      <div key={cat}>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">{cat}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {skills.map(s => (
                            <span key={s} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg">{s}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {c.certifications.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Award size={14} /> Certifications
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {c.certifications.map((cert, i) => (
                      <Badge key={i} className="bg-slate-100 text-slate-600">
                        {cert.name}{cert.year ? ` · ${cert.year}` : ''}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Preferences</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Salary expectation</span><span className="font-medium text-slate-700">{formatSalary(c.salary_expectation, c.salary_currency)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Notice period</span><span className="font-medium text-slate-700">{c.notice_period_days != null ? `${c.notice_period_days} days` : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Availability</span><span className="font-medium text-slate-700">{c.availability_date || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Remote preference</span><span className="font-medium text-slate-700">{c.remote_preference || '—'}</span></div>
                </div>
              </Card>

              {c.languages.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <LanguagesIcon size={14} /> Languages
                  </h3>
                  <div className="space-y-1.5">
                    {c.languages.map((l, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-slate-600">{l.language}</span>
                        <span className="text-slate-400 text-xs">{l.level}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Application</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Source</span><span className="font-medium text-slate-700 capitalize">{c.source}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Applied</span><span className="font-medium text-slate-700">{formatDate(c.applied_at)}</span></div>
                  {c.job_id && <div className="flex justify-between"><span className="text-slate-500">Job</span><Link to={`/candidates?job_id=${c.job_id}`} className="text-blue-600 hover:underline">View job</Link></div>}
                </div>
              </Card>

              {c.is_knocked_out && c.knockout_flags.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Knockout reasons
                  </h3>
                  <ul className="space-y-1 text-sm text-red-700">
                    {c.knockout_flags.map((f, i) => <li key={i}>· {f}</li>)}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── السيرة الذاتية والتقديم ───────────────────────────── */}
        {tab === 1 && <CandidateCVPanel candidate={c} />}

        {/* ── AI Analysis ─────────────────────────────────────────── */}
        {tab === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-1.5">
                  <TrendingUp size={14} /> Score breakdown
                </h3>
                <div className="space-y-3">
                  <ScoreRow label="Skill match" value={c.skill_match} weight={0.35} />
                  <ScoreRow label="Experience match" value={c.experience_match} weight={0.25} />
                  <ScoreRow label="Education match" value={c.education_match} weight={0.15} />
                  <ScoreRow label="Seniority match" value={c.seniority_match} weight={0.1} />
                  <ScoreRow label="Keyword match" value={c.keyword_match} weight={0.1} />
                  <ScoreRow label="Location match" value={c.location_match} weight={0.05} />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
                  <div className="text-center bg-slate-50 rounded-lg py-3">
                    <p className="text-lg font-bold text-slate-800">{Math.round(c.ats_score)}</p>
                    <p className="text-xs text-slate-500">ATS Score</p>
                  </div>
                  <div className="text-center bg-slate-50 rounded-lg py-3">
                    <p className="text-lg font-bold text-slate-800">{Math.round(c.ai_confidence)}%</p>
                    <p className="text-xs text-slate-500">AI Confidence</p>
                  </div>
                </div>
              </Card>

              {c.recommendation_reason && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Recommendation rationale</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{c.recommendation_reason}</p>
                </Card>
              )}

              <div className="grid grid-cols-2 gap-4">
                {c.strengths.length > 0 && (
                  <Card>
                    <h3 className="text-sm font-semibold text-emerald-700 mb-2">Strengths</h3>
                    <ul className="space-y-1.5 text-sm text-slate-600">
                      {c.strengths.map((s, i) => <li key={i} className="flex gap-1.5"><CheckCircle size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />{s}</li>)}
                    </ul>
                  </Card>
                )}
                {c.weaknesses.length > 0 && (
                  <Card>
                    <h3 className="text-sm font-semibold text-red-700 mb-2">Weaknesses</h3>
                    <ul className="space-y-1.5 text-sm text-slate-600">
                      {c.weaknesses.map((s, i) => <li key={i} className="flex gap-1.5"><XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />{s}</li>)}
                    </ul>
                  </Card>
                )}
              </div>

              {c.skill_gap_analysis && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Skill gap analysis</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{c.skill_gap_analysis}</p>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              {c.missing_skills.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Missing skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {c.missing_skills.map(s => <Badge key={s} className="bg-red-50 text-red-600">{s}</Badge>)}
                  </div>
                </Card>
              )}
              {c.missing_certs.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Missing certifications</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {c.missing_certs.map(s => <Badge key={s} className="bg-amber-50 text-amber-700">{s}</Badge>)}
                  </div>
                </Card>
              )}
              {c.ats_issues.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">ATS issues</h3>
                  <ul className="space-y-1 text-sm text-slate-600">
                    {c.ats_issues.map((s, i) => <li key={i}>· {s}</li>)}
                  </ul>
                </Card>
              )}
              {c.ats_suggestions.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">ATS suggestions</h3>
                  <ul className="space-y-1 text-sm text-slate-600">
                    {c.ats_suggestions.map((s, i) => <li key={i}>· {s}</li>)}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ── Timeline ─────────────────────────────────────────────── */}
        {tab === 3 && (
          <Card>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Activity timeline</h3>
            {!timeline ? (
              <Skeleton className="h-40" />
            ) : timeline.timeline.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No activity recorded yet.</p>
            ) : (
              <div className="space-y-0">
                {timeline.timeline.map((ev, i) => (
                  <div key={i} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                      {i < timeline.timeline.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-medium text-slate-700">{ev.label}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(ev.at)} {ev.by && `· ${ev.by}`}</p>
                      {ev.notes && <p className="text-xs text-slate-500 mt-0.5">{ev.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── Chat ─────────────────────────────────────────────────── */}
        {tab === 4 && <ChatPanel candidate={c} />}

        {/* ── Email & Notifications ─────────────────────────────────── */}
        {tab === 5 && <EmailLogPanel candidate={c} />}

        {/* ── Candidate Inquiries ───────────────────────────────────── */}
        {tab === 6 && <CandidateInquiriesPanel candidate={c} />}
      </div>

      {/* Modals */}
      <SendEmailModal candidate={c} open={emailModalOpen} onClose={() => setEmailModalOpen(false)} />
      {decisionModal && (
        <DecisionModal candidate={c} decision={decisionModal} open={!!decisionModal} onClose={() => setDecisionModal(null)} />
      )}
      <InterviewModal candidate={c} open={interviewModal} onClose={() => setInterviewModal(false)} />
      <OfferModal candidate={c} open={offerModal} onClose={() => setOfferModal(false)} />

      <Modal open={flagOpen} onClose={() => setFlagOpen(false)} title="Flag candidate">
        <div className="space-y-4">
          <Textarea
            label="Reason"
            value={flagReason}
            onChange={e => setFlagReason(e.target.value)}
            placeholder="Why is this candidate being flagged?"
            rows={3}
          />
          <Button
            className="w-full justify-center"
            onClick={() => flagMutation.mutate()}
            loading={flagMutation.isPending}
            disabled={!flagReason.trim()}
          >
            Flag candidate
          </Button>
        </div>
      </Modal>

      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Confirm Candidate Deletion">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Are you sure you want to permanently delete <strong className="text-slate-800">{c.full_name}</strong>?
            This will remove all associated AI evaluation scores, resume files, and stage history from your account.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>

      {/* Talent Pools Membership Modal */}
      <Modal
        open={talentPoolModalOpen}
        onClose={() => setTalentPoolModalOpen(false)}
        title={`بنوك ومجموعات المواهب - ${c.full_name}`}
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            اختر بنوك المواهب التي ترغب في إدراج المرشح <strong>{c.full_name}</strong> ضمنها لتسهيل تصنيفه ومتابعته مستقبلاً:
          </p>

          {talentPools.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              لا توجد بنوك مواهب حالياً. يمكنك إنشاء بنك مواهب جديد من صفحة مجمع المواهب CRM.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {talentPools.map((pool) => {
                const inPool = (pool.candidate_ids || []).includes(c.id);
                return (
                  <div
                    key={pool.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      inPool ? 'border-purple-200 bg-purple-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <FolderHeart size={14} className={inPool ? 'text-purple-600' : 'text-slate-400'} />
                        <span className="text-xs font-bold text-slate-800">{pool.name}</span>
                      </div>
                      {pool.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{pool.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={inPool ? 'danger' : 'outline'}
                      className="text-xs"
                      onClick={async () => {
                        try {
                          if (inPool) {
                            await talentPoolsApi.removeCandidate(pool.id, c.id);
                            toast('تم استبعاد المرشح من بنك المواهب', 'success');
                          } else {
                            await talentPoolsApi.addCandidates(pool.id, [c.id]);
                            toast('تمت إضافة المرشح لبنك المواهب بنجاح', 'success');
                          }
                          qc.invalidateQueries({ queryKey: ['talent-pools'] });
                        } catch (err: any) {
                          toast('حدث خطأ أثناء تحديث بنك المواهب', 'error');
                        }
                      }}
                    >
                      {inPool ? 'استبعاد' : 'إضافة'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 flex justify-between items-center border-t border-slate-100">
            <Link
              to="/talent-crm"
              className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
            >
              <span>إدارة بنوك المواهب CRM</span>
              <ExternalLink size={12} />
            </Link>
            <Button variant="outline" size="sm" onClick={() => setTalentPoolModalOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sequence Enrollment Modal */}
      <Modal
        open={sequenceModalOpen}
        onClose={() => setSequenceModalOpen(false)}
        title={`تفعيل سلسلة رسائل تلقائية للمرشح`}
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            اختر السلسلة التلقائية لتفعيل إرسال رسائل المتابعة والتذكير المجدولة للمرشح <strong>{c.full_name}</strong>:
          </p>

          {sequences.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              لا توجد سلاسل تلقائية متاحة. يمكنك إنشاء سلسلة تلقائية من مجمع المواهب CRM.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sequences.map((seq) => {
                const isSelected = selectedSeqId === seq.id;
                return (
                  <div
                    key={seq.id}
                    onClick={() => setSelectedSeqId(seq.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-500' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800">{seq.title}</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                        {seq.steps?.length || 0} خطوات
                      </span>
                    </div>
                    {seq.description && (
                      <p className="text-[11px] text-slate-500 mb-2 line-clamp-1">{seq.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Clock size={11} />
                      <span>
                        الخطوات: {seq.steps?.map(s => `${s.delay_hours}h`).join(' ➔ ') || 'فوري'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setSequenceModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedSeqId}
              loading={enrollCandidateSeqMutation.isPending}
              onClick={() => {
                if (selectedSeqId) {
                  enrollCandidateSeqMutation.mutate(Number(selectedSeqId));
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              تفعيل وبدء السلسلة الآن
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
