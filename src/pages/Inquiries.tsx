import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HelpCircle, Search, Mail, Phone, Sparkles, MessageSquare, CheckCircle,
  Clock, Star, Trash2, Send, CornerDownLeft, AlertCircle, Filter, RefreshCw
} from 'lucide-react';
import { inquiriesApi } from '../api';
import { Button, Badge, Card, Modal, Textarea, useToast, Spinner, EmptyState } from '../components/ui';
import { Layout, PageHeader } from '../components/layout/Layout';
import type { CandidateInquiry } from '../types';

export function InquiriesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedInquiry, setSelectedInquiry] = useState<CandidateInquiry | null>(null);
  const [replyText, setReplyText] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const qc = useQueryClient();
  const toast = useToast();

  const { data: inquiries = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['inquiries', statusFilter, search],
    queryFn: () => inquiriesApi.list({
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      search: search || undefined,
    }),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) => inquiriesApi.reply(id, text),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['inquiries'] });
      toast(`تم إرسال الرد بنجاح وحفظه بالبريد إلى ${updated.candidate_name}`, 'success');
      setSelectedInquiry(null);
      setReplyText('');
    },
    onError: () => toast('حدث خطأ أثناء إرسال الرد', 'error'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => inquiriesApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inquiries'] });
      toast('تم تحديث حالة الاستفسار', 'info');
    },
    onError: () => toast('فشل تحديث حالة الاستفسار', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => inquiriesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inquiries'] });
      toast('تم حذف الاستفسار بنجاح', 'success');
      setDeleteId(null);
    },
    onError: () => toast('فشل حذف الاستفسار', 'error'),
  });

  const handleOpenReplyModal = (inquiry: CandidateInquiry) => {
    setSelectedInquiry(inquiry);
    setReplyText(inquiry.hr_reply || inquiry.ai_answer || '');
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry || !replyText.trim()) return;
    replyMutation.mutate({ id: selectedInquiry.id, text: replyText });
  };

  // Stats calculation
  const totalCount = inquiries.length;
  const pendingCount = inquiries.filter(i => i.status === 'PENDING').length;
  const answeredCount = inquiries.filter(i => i.status === 'ANSWERED').length;
  const starredCount = inquiries.filter(i => i.status === 'STARRED').length;

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="استفسارات المتقدمين (Candidates Inquiries)"
          subtitle="إدارة ومتابعة تساؤلات المتقدمين للوظائف، والرد المباشر مع دعم الإجابات الذكية عبر Gemini AI."
          actions={
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={14} className={`ml-2 ${isFetching ? 'animate-spin' : ''}`} />
              تحديث البيانات
            </Button>
          }
        />

        {/* Top Summary Cards (Light Theme Only) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-white border border-slate-200 shadow-xs rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">إجمالي الاستفسارات</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <MessageSquare size={20} />
            </div>
          </Card>

          <Card className="p-4 bg-white border border-amber-200/70 shadow-xs rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-700">قيد الانتظار (جديد)</p>
              <h3 className="text-2xl font-bold text-amber-900 mt-1">{pendingCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock size={20} />
            </div>
          </Card>

          <Card className="p-4 bg-white border border-emerald-200/70 shadow-xs rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-700">تم الرد عليها</p>
              <h3 className="text-2xl font-bold text-emerald-900 mt-1">{answeredCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle size={20} />
            </div>
          </Card>

          <Card className="p-4 bg-white border border-indigo-200/70 shadow-xs rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-indigo-700">استفسارات مميزة</p>
              <h3 className="text-2xl font-bold text-indigo-900 mt-1">{starredCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Star size={20} />
            </div>
          </Card>
        </div>

        {/* Filter & Search Bar */}
        <Card className="p-4 bg-white border border-slate-200 shadow-xs rounded-xl">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="ابحث باسم المتقدم، البريد الإلكتروني، رقم الهاتف، الوظيفة أو نص الاستفسار..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === 'PENDING'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                قيد الانتظار ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ANSWERED')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === 'ANSWERED'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                تم الرد ({answeredCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('STARRED')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === 'STARRED'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-indigo-700'
                }`}
              >
                مميز ({starredCount})
              </button>
            </div>
          </div>
        </Card>

        {/* Inquiries List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200">
            <Spinner size={32} className="text-indigo-600" />
            <p className="mt-4 text-sm font-medium text-slate-600">جاري تحميل الاستفسارات...</p>
          </div>
        ) : inquiries.length === 0 ? (
          <EmptyState
            title="لا توجد استفسارات مطابقة"
            description="لم يتم العثور على أي استفسارات مطابقة للبحث أو الفلتر المختار."
            icon={<HelpCircle size={40} className="text-slate-400" />}
          />
        ) : (
          <div className="space-y-4">
            {inquiries.map((inquiry) => (
              <Card
                key={inquiry.id}
                className="p-5 bg-white border border-slate-200 shadow-xs rounded-2xl hover:border-indigo-200 transition-all space-y-4"
              >
                {/* Header Row: Candidate Info & Job Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      {inquiry.candidate_name ? inquiry.candidate_name.charAt(0) : 'م'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">{inquiry.candidate_name}</h4>
                      <div className="flex items-center flex-wrap gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dir-ltr">
                          <Mail size={12} className="text-slate-400" />
                          <a href={`mailto:${inquiry.candidate_email}`} className="hover:text-indigo-600 hover:underline">
                            {inquiry.candidate_email}
                          </a>
                        </span>
                        {inquiry.candidate_phone && (
                          <span className="flex items-center gap-1 font-medium text-slate-700 dir-ltr">
                            <Phone size={12} className="text-slate-400" />
                            <a href={`tel:${inquiry.candidate_phone}`} className="hover:text-indigo-600 hover:underline">
                              {inquiry.candidate_phone}
                            </a>
                          </span>
                        )}
                        <span className="text-slate-400">• {new Date(inquiry.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Job Tag */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {inquiry.job_title && (
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-medium text-xs py-1 px-2.5">
                        {inquiry.job_title}
                      </Badge>
                    )}

                    {inquiry.status === 'PENDING' && (
                      <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-xs py-1 px-2.5">
                        <Clock size={12} className="ml-1" />
                        قيد الانتظار
                      </Badge>
                    )}
                    {inquiry.status === 'ANSWERED' && (
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-xs py-1 px-2.5">
                        <CheckCircle size={12} className="ml-1" />
                        تم الرد
                      </Badge>
                    )}
                    {inquiry.status === 'STARRED' && (
                      <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold text-xs py-1 px-2.5">
                        <Star size={12} className="ml-1 fill-indigo-500 text-indigo-500" />
                        استفسار مميز
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Question Box */}
                <div className="bg-slate-50 border-r-4 border-indigo-500 p-4 rounded-xl">
                  <p className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                    <MessageSquare size={14} className="text-indigo-600" />
                    نص استفسار المرشح:
                  </p>
                  <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                    "{inquiry.question}"
                  </p>
                </div>

                {/* AI Answer Suggestion Preview */}
                {inquiry.ai_answer && (
                  <div className="bg-indigo-50/70 border border-indigo-100 p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-indigo-900 flex items-center gap-1">
                        <Sparkles size={14} className="text-indigo-600 animate-pulse" />
                        مقترح الرد الآلي المولد بواسطة Gemini AI:
                      </p>
                    </div>
                    <p className="text-xs text-indigo-950 leading-relaxed font-medium">
                      {inquiry.ai_answer}
                    </p>
                  </div>
                )}

                {/* HR Reply Box (If Answered) */}
                {inquiry.hr_reply && (
                  <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs text-emerald-800 font-bold">
                      <span className="flex items-center gap-1">
                        <CheckCircle size={14} className="text-emerald-600" />
                        رد مسؤول التوظيف (تم الإرسال للبريد الإلكتروني):
                      </span>
                      {inquiry.hr_replied_at && (
                        <span className="font-normal text-emerald-700">
                          {new Date(inquiry.hr_replied_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                      {inquiry.hr_reply}
                    </p>
                  </div>
                )}

                {/* Footer Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenReplyModal(inquiry)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-3.5 py-1.5"
                    >
                      <Send size={13} className="ml-1.5" />
                      {inquiry.hr_reply ? 'تعديل / إعادة الرد' : 'الرد على الاستفسار'}
                    </Button>

                    {inquiry.status !== 'STARRED' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => statusMutation.mutate({ id: inquiry.id, status: 'STARRED' })}
                        className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 text-xs"
                      >
                        <Star size={13} className="ml-1" />
                        تمييز
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => statusMutation.mutate({ id: inquiry.id, status: 'PENDING' })}
                        className="text-slate-600 hover:text-slate-900 text-xs"
                      >
                        إلغاء التمييز
                      </Button>
                    )}

                    {inquiry.status === 'PENDING' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => statusMutation.mutate({ id: inquiry.id, status: 'ANSWERED' })}
                        className="text-emerald-600 hover:bg-emerald-50 text-xs"
                      >
                        <CheckCircle size={13} className="ml-1" />
                        تحديد كـ تم الرد
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(inquiry.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                  >
                    <Trash2 size={13} className="ml-1" />
                    حذف الاستفسار
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Reply Modal */}
        {selectedInquiry && (
          <Modal
            open={!!selectedInquiry}
            onClose={() => setSelectedInquiry(null)}
            title="الرد المباشر على الاستفسار"
          >
            <form onSubmit={handleSendReply} className="space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>المتقدم: {selectedInquiry.candidate_name}</span>
                  <span className="dir-ltr text-slate-600">{selectedInquiry.candidate_email}</span>
                </div>
                <div className="text-slate-700 font-medium border-t border-slate-200 pt-2 mt-2">
                  <span className="font-bold text-slate-900">سؤال المرشح: </span>
                  "{selectedInquiry.question}"
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    نص الإجابة (سيتم إرسالها رسمياً عبر البريد الإلكتروني للمرشح):
                  </label>
                  {selectedInquiry.ai_answer && (
                    <button
                      type="button"
                      onClick={() => setReplyText(selectedInquiry.ai_answer || '')}
                      className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1"
                    >
                      <Sparkles size={12} />
                      استخدام اقتراح Gemini AI
                    </button>
                  )}
                </div>
                <Textarea
                  rows={5}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="اكتب ردك الوافي للمرشح هنا..."
                  required
                  className="bg-white text-slate-900 border-slate-300 text-sm leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="ghost" type="button" onClick={() => setSelectedInquiry(null)}>
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={replyMutation.isPending || !replyText.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-5"
                >
                  {replyMutation.isPending ? (
                    <>
                      <Spinner size={16} className="ml-2" />
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Send size={14} className="ml-2" />
                      إرسال الرد وحفظ التغييرات
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Delete Confirmation Modal */}
        {deleteId !== null && (
          <Modal
            open={deleteId !== null}
            onClose={() => setDeleteId(null)}
            title="تأكيد حذف الاستفسار"
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                هل أنت تأكد من رغبتك في حذف هذا الاستفسار نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setDeleteId(null)}>
                  إلغاء
                </Button>
                <Button
                  variant="danger"
                  onClick={() => deleteMutation.mutate(deleteId)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}
