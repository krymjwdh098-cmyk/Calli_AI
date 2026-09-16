import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderHeart, Send, Plus, Search, Tag, Users, Clock, Sparkles,
  Trash2, Edit3, ChevronRight, CheckCircle2, UserPlus, Play,
  Mail, ExternalLink, RefreshCw, AlertCircle, Info, Layers, Check,
  Zap, Calendar, Sliders, Eye, Activity, Clock3, Filter, ArrowLeft,
  ToggleLeft, ToggleRight, CheckCircle, ShieldAlert, Sparkle,
  Database, SlidersHorizontal, ArrowUpDown
} from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Button, Badge, Card, Modal, Input, Textarea, useToast } from '../components/ui';
import { talentPoolsApi, sequencesApi, candidatesApi, dripCampaignsApi, jobsApi } from '../api';
import type { TalentPool, Sequence, SequenceStep, Candidate, DripCampaign, DripStep, DripExecutionLog } from '../types';
import { DeleteConfirmModal } from '../components/crm/DeleteConfirmModal';
import { CandidateInspectModal } from '../components/crm/CandidateInspectModal';
import { PoolCandidatesWorkspace } from '../components/crm/PoolCandidatesWorkspace';

const POOL_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
};

const HIRING_STAGES = [
  { id: 'Application Received', label: 'استلام طلب التقديم (Application Received)', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'Shortlisted', label: 'القائمة المختصرة (Shortlisted)', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'Phone Interview', label: 'المقابلة الهاتفية (Phone Interview)', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'Interview Scheduled', label: 'تحديد موعد المقابلة (Interview Scheduled)', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { id: 'Technical Assessment', label: 'التقييم الفني (Technical Assessment)', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { id: 'Final Interview', label: 'المقابلة النهائية (Final Interview)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'Offer Sent', label: 'إرسال العرض الوظيفي (Offer Sent)', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { id: 'Hired', label: 'تم التوظيف (Hired)', color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'Rejected', label: 'اعتذار / غير مؤهل (Rejected)', color: 'bg-rose-100 text-rose-800 border-rose-200' },
];

const PLACEHOLDER_TAGS = [
  { tag: '{{candidate_name}}', label: 'اسم المرشح' },
  { tag: '{{job_title}}', label: 'المسمى الوظيفي' },
  { tag: '{{company_name}}', label: 'اسم الشركة' },
  { tag: '{{interview_date}}', label: 'تاريخ المقابلة' },
  { tag: '{{interview_link}}', label: 'رابط المقابلة' },
  { tag: '{{offer_amount}}', label: 'مبلغ العرض' },
  { tag: '{{offer_deadline}}', label: 'مهلة الرد' },
];

export function TalentCRM() {
  const [activeTab, setActiveTab] = useState<'drip' | 'pools' | 'sequences' | 'logs'>('drip');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  const toast = useToast();
  const showSuccess = (msg: string) => toast(msg, 'success');
  const showError = (msg: string) => toast(msg, 'error');
  const queryClient = useQueryClient();

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: 'pool' | 'sequence' | 'drip' | 'log' | 'all-logs';
    id?: number;
    title: string;
    itemName?: string;
    description?: string;
  }>({
    open: false,
    type: 'pool',
    title: '',
  });

  // Modals state for Drip Campaigns
  const [dripModalOpen, setDripModalOpen] = useState(false);
  const [editingDrip, setEditingDrip] = useState<DripCampaign | null>(null);
  const [testTriggerModal, setTestTriggerModal] = useState<DripCampaign | null>(null);
  const [testCandidateId, setTestCandidateId] = useState<number | ''>('');
  const [viewingLog, setViewingLog] = useState<DripExecutionLog | null>(null);

  // Form states for Drip Campaign
  const [dripTitle, setDripTitle] = useState('');
  const [dripDesc, setDripDesc] = useState('');
  const [dripTriggerStage, setDripTriggerStage] = useState('Application Received');
  const [dripTargetJobId, setDripTargetJobId] = useState<number | ''>('');
  const [dripTargetPoolId, setDripTargetPoolId] = useState<number | ''>('');
  const [dripIsActive, setDripIsActive] = useState(true);
  const [dripSteps, setDripSteps] = useState<Partial<DripStep>[]>([
    {
      step_number: 1,
      delay_value: 0,
      delay_unit: 'hours',
      delay_hours: 0,
      subject: 'تأكيد استلام طلبك لوظيفة {{job_title}} - {{company_name}}',
      body_template: 'مرحباً {{candidate_name}}،\n\nنشكرك على تقديمك لوظيفة {{job_title}} في شركة {{company_name}}.\nتم استلام طلبك وسيقوم فريق التوظيف بمراجعته والرد عليك قريباً.\n\nتحياتنا،\nفريق التوظيف',
      action_type: 'EMAIL',
    },
    {
      step_number: 2,
      delay_value: 2,
      delay_unit: 'days',
      delay_hours: 48,
      subject: 'متابعة وتحديث طلب التقديم - {{company_name}}',
      body_template: 'عزيزي {{candidate_name}}،\n\nنود إحاطتك علماً بأن ملفك قيد التقييم الفني. نتمنى لك التوفيق، وسنوافيك بالخطوات القادمة قريباً.\n\nأطيب التحيات،\n{{company_name}}',
      action_type: 'EMAIL',
    },
  ]);
  const [aiDripGoal, setAiDripGoal] = useState('');
  const [generatingAiDrip, setGeneratingAiDrip] = useState(false);

  // Modals state for Pools & Candidates
  const [createPoolOpen, setCreatePoolOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<TalentPool | null>(null);
  const [poolWorkspaceModal, setPoolWorkspaceModal] = useState<TalentPool | null>(null);
  const [inspectCandidate, setInspectCandidate] = useState<Candidate | null>(null);

  // Modals state for Sequences
  const [createSeqOpen, setCreateSeqOpen] = useState(false);
  const [editingSeq, setEditingSeq] = useState<Sequence | null>(null);
  const [enrollModalSeq, setEnrollModalSeq] = useState<Sequence | null>(null);

  // Form states for Pool
  const [poolName, setPoolName] = useState('');
  const [poolDesc, setPoolDesc] = useState('');
  const [poolTagsInput, setPoolTagsInput] = useState('');
  const [poolColor, setPoolColor] = useState('blue');

  // Form states for Sequence
  const [seqTitle, setSeqTitle] = useState('');
  const [seqDesc, setSeqDesc] = useState('');
  const [seqTrigger, setSeqTrigger] = useState('MANUAL');
  const [seqSteps, setSeqSteps] = useState<Partial<SequenceStep>[]>([
    { step_number: 1, delay_hours: 0, subject: '', body_template: '' },
    { step_number: 2, delay_hours: 48, subject: '', body_template: '' },
  ]);
  const [aiGoal, setAiGoal] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  // Enroll state
  const [enrollTargetType, setEnrollTargetType] = useState<'pool' | 'candidates'>('pool');
  const [selectedPoolId, setSelectedPoolId] = useState<number | ''>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: dripCampaigns = [], isLoading: dripLoading } = useQuery({
    queryKey: ['drip-campaigns'],
    queryFn: () => dripCampaignsApi.list(),
  });

  const { data: dripLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['drip-campaigns-logs'],
    queryFn: () => dripCampaignsApi.getLogs(),
  });

  const { data: pools = [], isLoading: poolsLoading } = useQuery({
    queryKey: ['talent-pools'],
    queryFn: () => talentPoolsApi.list(),
  });

  const { data: sequences = [], isLoading: seqsLoading } = useQuery({
    queryKey: ['sequences'],
    queryFn: () => sequencesApi.list(),
  });

  const { data: candidatesData } = useQuery({
    queryKey: ['candidates-all-list'],
    queryFn: () => candidatesApi.list({ page_size: 200 }),
  });
  const candidates: Candidate[] = candidatesData?.items || [];

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-all-list'],
    queryFn: () => jobsApi.list(),
  });

  // ── Drip Mutations ──────────────────────────────────────────────────────
  const createDripMutation = useMutation({
    mutationFn: (data: any) => dripCampaignsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns'] });
      showSuccess('تم إنشاء وتفعيل حملة التقطير التلقائية بنجاح');
      closeDripModal();
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'حدث خطأ أثناء حفظ حملة التقطير'),
  });

  const updateDripMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DripCampaign> }) =>
      dripCampaignsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns'] });
      showSuccess('تم تحديث إعدادات حملة التقطير بنجاح');
      closeDripModal();
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'حدث خطأ أثناء التحديث'),
  });

  const deleteDripMutation = useMutation({
    mutationFn: (id: number) => dripCampaignsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns'] });
      showSuccess('تم حذف حملة التقطير بنجاح');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'تعذر حذف الحملة'),
  });

  const toggleDripMutation = useMutation({
    mutationFn: (id: number) => dripCampaignsApi.toggleActive(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns'] });
      showSuccess(res.message);
    },
  });

  const testTriggerMutation = useMutation({
    mutationFn: ({ id, candidateId }: { id: number; candidateId: number }) =>
      dripCampaignsApi.testTrigger(id, { candidate_id: candidateId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns-logs'] });
      showSuccess(res.message);
      setTestTriggerModal(null);
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'فشل إرسال اختبار الحملة'),
  });

  // ── Logs Mutations ──────────────────────────────────────────────────────
  const deleteLogMutation = useMutation({
    mutationFn: (id: number) => dripCampaignsApi.deleteLog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns-logs'] });
      showSuccess('تم حذف السجل بنجاح');
    },
    onError: () => showError('تعذر حذف السجل'),
  });

  const clearLogsMutation = useMutation({
    mutationFn: () => dripCampaignsApi.clearLogs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns-logs'] });
      showSuccess('تم مسح جميع سجلات التقطير بنجاح');
    },
    onError: () => showError('تعذر مسح السجلات'),
  });

  // ── Seed Demo HR Data Mutation ──────────────────────────────────────────
  const seedDemoMutation = useMutation({
    mutationFn: () => dripCampaignsApi.seedHRDemoExamples(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['talent-pools'] });
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns-logs'] });
      showSuccess(res.message || 'تمت تعبئة وتحديث بنوك المواهب وحملات التقطير وسلاسل التواصل بأمثلة HR المجهزة بنجاح');
    },
    onError: () => showError('تعذر تعبئة أمثلة HR التجريبية'),
  });

  // ── Pool Mutations ──────────────────────────────────────────────────────
  const createPoolMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; tags?: string[]; color?: string }) =>
      talentPoolsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-pools'] });
      showSuccess('تم إنشاء بنك المواهب بنجاح');
      closePoolModal();
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'حدث خطأ أثناء حفظ بنك المواهب'),
  });

  const updatePoolMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TalentPool> }) => talentPoolsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-pools'] });
      showSuccess('تم تحديث بنك المواهب بنجاح');
      closePoolModal();
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'حدث خطأ أثناء التحديث'),
  });

  const deletePoolMutation = useMutation({
    mutationFn: (id: number) => talentPoolsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-pools'] });
      showSuccess('تم حذف بنك المواهب نهائياً بنجاح');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'تعذر حذف بنك المواهب'),
  });

  const addCandidatesToPoolMutation = useMutation({
    mutationFn: ({ poolId, candidateIds }: { poolId: number; candidateIds: number[] }) =>
      talentPoolsApi.addCandidates(poolId, candidateIds),
    onSuccess: (updatedPool) => {
      queryClient.invalidateQueries({ queryKey: ['talent-pools'] });
      if (poolWorkspaceModal && poolWorkspaceModal.id === updatedPool.id) {
        setPoolWorkspaceModal(updatedPool);
      }
      showSuccess('تم تحديث وضم المرشحين في بنك المواهب بنجاح');
    },
  });

  const removeCandidateFromPoolMutation = useMutation({
    mutationFn: ({ poolId, candidateId }: { poolId: number; candidateId: number }) =>
      talentPoolsApi.removeCandidate(poolId, candidateId),
    onSuccess: (updatedPool) => {
      queryClient.invalidateQueries({ queryKey: ['talent-pools'] });
      if (poolWorkspaceModal && poolWorkspaceModal.id === updatedPool.id) {
        setPoolWorkspaceModal(updatedPool);
      }
      showSuccess('تم استبعاد المرشح من بنك المواهب');
    },
  });

  // ── Sequence Mutations ──────────────────────────────────────────────────
  const createSeqMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; trigger_event?: string; steps: Partial<SequenceStep>[] }) =>
      sequencesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      showSuccess('تم إنشاء السلسلة التلقائية بنجاح');
      closeSeqModal();
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'حدث خطأ أثناء حفظ السلسلة'),
  });

  const updateSeqMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Sequence> }) => sequencesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      showSuccess('تم تحديث السلسلة التلقائية بنجاح');
      closeSeqModal();
    },
  });

  const deleteSeqMutation = useMutation({
    mutationFn: (id: number) => sequencesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      showSuccess('تم حذف السلسلة التلقائية بنجاح');
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'تعذر حذف السلسلة'),
  });

  const enrollMutation = useMutation({
    mutationFn: ({ seqId, data }: { seqId: number; data: { candidate_ids?: number[]; pool_id?: number } }) =>
      sequencesApi.enroll(seqId, data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      showSuccess(res.message || 'تم تفعيل السلسلة التلقائية للمرشحين المحددين');
      setEnrollModalSeq(null);
    },
    onError: (err: any) => showError(err.response?.data?.detail || 'فشل تفعيل السلسلة التلقائية'),
  });

  // ── Pipeline Stage Handler ──────────────────────────────────────────────
  const handleCandidateStageChange = async (candidateId: number, newStage: string) => {
    try {
      await candidatesApi.pipelineMove(candidateId, newStage);
      queryClient.invalidateQueries({ queryKey: ['candidates-all-list'] });
      queryClient.invalidateQueries({ queryKey: ['talent-pools'] });
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['drip-campaigns-logs'] });
      showSuccess(`تم نقل المرشح إلى مرحلة "${newStage}" بنجاح وتفعيل مسار المتابعة التلقائي`);
    } catch (err: any) {
      showError(err.response?.data?.detail || 'فشل تحديث مرحلة المرشح');
    }
  };

  // ── Delete Confirmation Trigger ─────────────────────────────────────────
  const executeDeleteConfirm = () => {
    if (deleteConfirm.type === 'pool' && deleteConfirm.id) {
      deletePoolMutation.mutate(deleteConfirm.id);
    } else if (deleteConfirm.type === 'sequence' && deleteConfirm.id) {
      deleteSeqMutation.mutate(deleteConfirm.id);
    } else if (deleteConfirm.type === 'drip' && deleteConfirm.id) {
      deleteDripMutation.mutate(deleteConfirm.id);
    } else if (deleteConfirm.type === 'log' && deleteConfirm.id) {
      deleteLogMutation.mutate(deleteConfirm.id);
    } else if (deleteConfirm.type === 'all-logs') {
      clearLogsMutation.mutate();
    }
    setDeleteConfirm(prev => ({ ...prev, open: false }));
  };

  // ── Drip Modal Handlers ─────────────────────────────────────────────────
  const openCreateDrip = () => {
    setEditingDrip(null);
    setDripTitle('');
    setDripDesc('');
    setDripTriggerStage('Application Received');
    setDripTargetJobId('');
    setDripTargetPoolId('');
    setDripIsActive(true);
    setDripSteps([
      {
        step_number: 1,
        delay_value: 0,
        delay_unit: 'hours',
        delay_hours: 0,
        subject: 'تأكيد استلام طلبك لوظيفة {{job_title}} - {{company_name}}',
        body_template: 'مرحباً {{candidate_name}}،\n\nنشكرك على تقديمك لوظيفة {{job_title}} في شركة {{company_name}}.\nتم استلام طلبك وسيقوم فريق التوظيف بمراجعته والرد عليك قريباً.\n\nتحياتنا،\nفريق التوظيف',
        action_type: 'EMAIL',
      },
      {
        step_number: 2,
        delay_value: 2,
        delay_unit: 'days',
        delay_hours: 48,
        subject: 'متابعة وتحديث طلب التقديم - {{company_name}}',
        body_template: 'عزيزي {{candidate_name}}،\n\nنود إحاطتك علماً بأن ملفك قيد التقييم الفني. نتمنى لك التوفيق، وسنوافيك بالخطوات القادمة قريباً.\n\nأطيب التحيات،\n{{company_name}}',
        action_type: 'EMAIL',
      },
    ]);
    setDripModalOpen(true);
  };

  const openEditDrip = (camp: DripCampaign) => {
    setEditingDrip(camp);
    setDripTitle(camp.title);
    setDripDesc(camp.description || '');
    setDripTriggerStage(camp.trigger_stage);
    setDripTargetJobId(camp.target_job_id || '');
    setDripTargetPoolId(camp.target_pool_id || '');
    setDripIsActive(camp.is_active);
    setDripSteps(camp.steps || []);
    setDripModalOpen(true);
  };

  const closeDripModal = () => {
    setDripModalOpen(false);
    setEditingDrip(null);
  };

  const handleSaveDrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dripTitle.trim()) {
      showError('الرجاء إدخال عنوان حملة التقطير التلقائية');
      return;
    }
    if (dripSteps.length === 0) {
      showError('أضف خطوة متابعة واحدة على الأقل للحملة');
      return;
    }

    const payload = {
      title: dripTitle,
      description: dripDesc,
      trigger_stage: dripTriggerStage,
      target_job_id: dripTargetJobId || undefined,
      target_pool_id: dripTargetPoolId || undefined,
      is_active: dripIsActive,
      steps: dripSteps.map((st, i) => ({
        step_number: i + 1,
        delay_hours: st.delay_unit === 'days' ? (st.delay_value || 0) * 24 : (st.delay_value || 0),
        delay_value: st.delay_value || 0,
        delay_unit: st.delay_unit || 'hours',
        subject: st.subject || '',
        body_template: st.body_template || '',
        action_type: st.action_type || 'EMAIL',
      })),
    };

    if (editingDrip) {
      updateDripMutation.mutate({ id: editingDrip.id, data: payload });
    } else {
      createDripMutation.mutate(payload);
    }
  };

  const handleGenerateAIDrip = async () => {
    if (!aiDripGoal.trim()) {
      showError('اكتب هدف الحملة الذكية أولاً لتوليد الخطوات تلقائياً');
      return;
    }
    setGeneratingAiDrip(true);
    try {
      const res = await dripCampaignsApi.generateAIDrip({
        goal: aiDripGoal,
        trigger_stage: dripTriggerStage,
      });
      if (res.title) setDripTitle(res.title);
      if (res.description) setDripDesc(res.description);
      if (res.steps && res.steps.length > 0) {
        setDripSteps(res.steps);
        showSuccess('تم توليد وصياغة خطوات حملة التقطير التلقائية بالذكاء الاصطناعي!');
      }
    } catch (err) {
      showError('تعذر توليد الحملة بواسطة الذكاء الاصطناعي حالياً');
    } finally {
      setGeneratingAiDrip(false);
    }
  };

  // ── Pool Modal Handlers ─────────────────────────────────────────────────
  const openCreatePool = () => {
    setEditingPool(null);
    setPoolName('');
    setPoolDesc('');
    setPoolTagsInput('');
    setPoolColor('blue');
    setCreatePoolOpen(true);
  };

  const openEditPool = (pool: TalentPool) => {
    setEditingPool(pool);
    setPoolName(pool.name);
    setPoolDesc(pool.description || '');
    setPoolTagsInput((pool.tags || []).join(', '));
    setPoolColor(pool.color || 'blue');
    setCreatePoolOpen(true);
  };

  const closePoolModal = () => {
    setCreatePoolOpen(false);
    setEditingPool(null);
  };

  const handleSavePool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poolName.trim()) {
      showError('اسم بنك المواهب مطلوب');
      return;
    }
    const tags = poolTagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    if (editingPool) {
      updatePoolMutation.mutate({
        id: editingPool.id,
        data: { name: poolName, description: poolDesc, tags, color: poolColor },
      });
    } else {
      createPoolMutation.mutate({ name: poolName, description: poolDesc, tags, color: poolColor });
    }
  };

  // ── Sequence Modal Handlers ─────────────────────────────────────────────
  const openCreateSeq = () => {
    setEditingSeq(null);
    setSeqTitle('');
    setSeqDesc('');
    setSeqTrigger('MANUAL');
    setSeqSteps([
      { step_number: 1, delay_hours: 0, subject: '', body_template: '' },
      { step_number: 2, delay_hours: 48, subject: '', body_template: '' },
    ]);
    setCreateSeqOpen(true);
  };

  const openEditSeq = (seq: Sequence) => {
    setEditingSeq(seq);
    setSeqTitle(seq.title);
    setSeqDesc(seq.description || '');
    setSeqTrigger(seq.trigger_event || 'MANUAL');
    setSeqSteps(seq.steps || []);
    setCreateSeqOpen(true);
  };

  const closeSeqModal = () => {
    setCreateSeqOpen(false);
    setEditingSeq(null);
  };

  const handleSaveSeq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seqTitle.trim()) {
      showError('عنوان السلسلة مطلوب');
      return;
    }
    if (seqSteps.length === 0) {
      showError('أضف خطوة واحدة على الأقل');
      return;
    }
    if (editingSeq) {
      updateSeqMutation.mutate({
        id: editingSeq.id,
        data: {
          title: seqTitle,
          description: seqDesc,
          trigger_event: seqTrigger,
          steps: seqSteps.map((s, i) => ({ ...s, step_number: i + 1 })),
        },
      });
    } else {
      createSeqMutation.mutate({
        title: seqTitle,
        description: seqDesc,
        trigger_event: seqTrigger,
        steps: seqSteps.map((s, i) => ({ ...s, step_number: i + 1 })),
      });
    }
  };

  const handleGenerateAISteps = async () => {
    if (!aiGoal.trim()) {
      showError('أدخل هدف الحملة أولاً لتوليد الخطوات بالذكاء الاصطناعي');
      return;
    }
    setGeneratingAi(true);
    try {
      const res = await sequencesApi.generateAISteps(aiGoal);
      if (res.steps && res.steps.length > 0) {
        setSeqSteps(res.steps);
        showSuccess('تم صياغة وتوليد خطوات الرسائل بالذكاء الاصطناعي!');
      }
    } catch (err) {
      showError('تعذر توليد الخطوات حالياً');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollModalSeq) return;

    if (enrollTargetType === 'pool') {
      if (!selectedPoolId) {
        showError('اختر بنك مواهب لتفعيل السلسلة عليه');
        return;
      }
      enrollMutation.mutate({
        seqId: enrollModalSeq.id,
        data: { pool_id: Number(selectedPoolId) },
      });
    } else {
      if (selectedCandidateIds.length === 0) {
        showError('حدد مرشحاً واحداً على الأقل');
        return;
      }
      enrollMutation.mutate({
        seqId: enrollModalSeq.id,
        data: { candidate_ids: selectedCandidateIds },
      });
    }
  };

  // ── Filters & Metrics ───────────────────────────────────────────────────
  const filteredDripCampaigns = dripCampaigns.filter(c => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.trigger_stage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = selectedStageFilter === 'all' || c.trigger_stage === selectedStageFilter;
    return matchesSearch && matchesStage;
  });

  const allTags = Array.from(new Set(pools.flatMap(p => p.tags || [])));
  const filteredPools = pools.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'all' || (p.tags && p.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

  const activeDripCount = dripCampaigns.filter(c => c.is_active).length;
  const totalDripSteps = dripCampaigns.reduce((acc, c) => acc + (c.steps?.length || 0), 0);
  const totalEnrolledCandidates = dripCampaigns.reduce((acc, c) => acc + (c.enrolled_count || 0), 0);

  return (
    <Layout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs tracking-wider uppercase mb-1">
              <Zap size={14} className="animate-pulse" /> Talent CRM & Automated Nurturing Engine
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              إدارة علاقات المواهب وحملات التقطير التلقائية
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              تصميم وتفعيل حملات بريد إلكتروني تلقائية مشروطة بمراحل التوظيف وفترات تأخير المتابعة وبنوك المواهب.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Seed Demo Examples Button */}
            <Button
              variant="outline"
              onClick={() => seedDemoMutation.mutate()}
              disabled={seedDemoMutation.isPending}
              className="flex items-center gap-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold px-3.5 py-2 rounded-xl shadow-sm"
              title="تعبئة وتحديث بنوك المواهب والحملات وسلاسل التواصل بأمثلة جاهزة"
            >
              {seedDemoMutation.isPending ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} className="text-emerald-600" />
              )}
              تعبئة أمثلة HR المجهزة
            </Button>

            {activeTab === 'drip' && (
              <Button
                onClick={openCreateDrip}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl shadow-sm text-xs"
              >
                <Plus size={15} /> إنشاء حملة تقطير
              </Button>
            )}
            {activeTab === 'pools' && (
              <Button
                onClick={openCreatePool}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-xl shadow-sm text-xs"
              >
                <Plus size={15} /> إنشاء بنك مواهب
              </Button>
            )}
            {activeTab === 'sequences' && (
              <Button
                onClick={openCreateSeq}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-xl shadow-sm text-xs"
              >
                <Plus size={15} /> إنشاء سلسلة تلقائية
              </Button>
            )}
          </div>
        </div>

        {/* Stats Metrics Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">الحملات التلقائية النشطة</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{activeDripCount} / {dripCampaigns.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Zap size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">بنوك المواهب الجاهزة</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{pools.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <FolderHeart size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">المرشحون المشمولون بالحملات</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{totalEnrolledCandidates}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Users size={20} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">رسائل التقطير المنفذة</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{dripLogs.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Mail size={20} />
            </div>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pt-3 rounded-xl shadow-sm overflow-x-auto">
          <div className="flex items-center">
            <button
              onClick={() => setActiveTab('drip')}
              className={`flex items-center gap-2.5 px-5 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'drip'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Zap size={17} />
              <span>حملات التقطير التلقائية (Email Drips)</span>
              <Badge className="bg-blue-100 text-blue-700 font-bold ml-1">{dripCampaigns.length}</Badge>
            </button>

            <button
              onClick={() => setActiveTab('pools')}
              className={`flex items-center gap-2.5 px-5 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'pools'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FolderHeart size={17} />
              <span>بنوك ومجموعات المواهب (Talent Pools)</span>
              <Badge className="bg-slate-100 text-slate-700 font-bold ml-1">{pools.length}</Badge>
            </button>

            <button
              onClick={() => setActiveTab('sequences')}
              className={`flex items-center gap-2.5 px-5 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'sequences'
                  ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Send size={17} />
              <span>سلاسل التواصل اليدوية (Sequences)</span>
              <Badge className="bg-slate-100 text-slate-700 font-bold ml-1">{sequences.length}</Badge>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2.5 px-5 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'border-purple-600 text-purple-600 bg-purple-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Activity size={17} />
              <span>سجل التنفيذ والإرسال (Drip Logs)</span>
              <Badge className="bg-slate-100 text-slate-700 font-bold ml-1">{dripLogs.length}</Badge>
            </button>
          </div>
        </div>

        {/* ── TAB 1: AUTOMATED EMAIL DRIP CAMPAIGNS ──────────────────────── */}
        {activeTab === 'drip' && (
          <div className="space-y-6">
            {/* Search & Stage Filter Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث في حملات التقطير، مراحل التفعيل، أو الكلمات المفتاحية..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Stage Filter */}
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1 flex-shrink-0">
                  <Filter size={12} /> مرحلة التفعيل:
                </span>
                <select
                  value={selectedStageFilter}
                  onChange={e => setSelectedStageFilter(e.target.value)}
                  className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">جميع المراحل ({dripCampaigns.length})</option>
                  {HIRING_STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Drip Campaigns Cards Grid */}
            {dripLoading ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
                <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">جاري تحميل حملات التقطير التلقائية...</p>
              </div>
            ) : filteredDripCampaigns.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Zap size={32} />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-slate-800">لا توجد حملات تقطير مسجلة</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    قم بإنشاء أول حملة بريد إلكتروني تتابعية (Drip Campaign) أو انقر على "تعبئة أمثلة HR المجهزة" بالأعلى.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    onClick={() => seedDemoMutation.mutate()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2.5 rounded-xl shadow-sm"
                  >
                    <Sparkles size={14} className="ml-1.5" /> تعبئة أمثلة HR الجاهزة
                  </Button>
                  <Button
                    onClick={openCreateDrip}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2.5 rounded-xl shadow-sm"
                  >
                    <Plus size={14} className="ml-1.5" /> إنشاء حملة تقطير
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredDripCampaigns.map(camp => {
                  const stageObj = HIRING_STAGES.find(s => s.id === camp.trigger_stage) || {
                    id: camp.trigger_stage,
                    label: camp.trigger_stage,
                    color: 'bg-slate-100 text-slate-800 border-slate-200',
                  };

                  return (
                    <div
                      key={camp.id}
                      className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 transition-all shadow-sm p-5 space-y-4 flex flex-col justify-between"
                    >
                      <div>
                        {/* Header & Badges */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${stageObj.color} flex items-center gap-1`}>
                                <Zap size={11} /> مرحلة التفعيل: {stageObj.label}
                              </span>
                              {camp.target_job_title && (
                                <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                                  الوظيفة: {camp.target_job_title}
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-slate-800 tracking-tight pt-1">
                              {camp.title}
                            </h3>
                          </div>

                          {/* Active / Inactive Toggle Button */}
                          <button
                            onClick={() => toggleDripMutation.mutate(camp.id)}
                            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                              camp.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="تغيير حالة التفعيل"
                          >
                            <span className={`w-2 h-2 rounded-full ${camp.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            {camp.is_active ? 'نشطة' : 'متوقفة مؤقتاً'}
                          </button>
                        </div>

                        {camp.description && (
                          <p className="text-xs text-slate-600 line-clamp-2 mt-2 leading-relaxed">
                            {camp.description}
                          </p>
                        )}

                        {/* Steps Timeline Visualization */}
                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                            <span>مسار الخطوات وفترات التأخير ({camp.steps?.length || 0} خطوات)</span>
                            <span className="text-blue-600 font-semibold flex items-center gap-1">
                              <Clock size={12} /> التوقيت التتابعي
                            </span>
                          </div>

                          <div className="space-y-2">
                            {camp.steps?.map((st, idx) => (
                              <div
                                key={st.id || idx}
                                className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start gap-3 text-xs"
                              >
                                <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-semibold text-slate-800 truncate">{st.subject}</p>
                                    <span className="text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full whitespace-nowrap">
                                      {st.delay_hours === 0 ? 'فوري (0h)' : `بعد ${st.delay_value || (st.delay_hours / 24)} ${st.delay_unit === 'days' ? 'أيام' : 'ساعة'}`}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{st.body_template}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users size={12} className="text-slate-400" /> المشتركون: <strong>{camp.enrolled_count || 0}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTestTriggerModal(camp);
                              setTestCandidateId(candidates[0]?.id || '');
                            }}
                            className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-1.5"
                          >
                            <Play size={12} /> اختبار فوري
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDrip(camp)}
                            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                          >
                            <Edit3 size={12} /> تعديل
                          </Button>

                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                open: true,
                                type: 'drip',
                                id: camp.id,
                                title: 'حذف حملة التقطير التلقائية',
                                itemName: camp.title,
                                description: 'هل أنت متأكد من حذف هذه الحملة؟ سيتوقف تفعيل رسائل التقطير المجدولة لهذه المرحلة.',
                              })
                            }
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="حذف الحملة"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: TALENT POOLS ────────────────────────────────────────── */}
        {activeTab === 'pools' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث في بنوك المواهب والوسوم..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {allTags.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1 flex-shrink-0">
                    <Tag size={12} /> الوسوم:
                  </span>
                  <button
                    onClick={() => setSelectedTag('all')}
                    className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                      selectedTag === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    الكل
                  </button>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                        selectedTag === tag
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pools Grid */}
            {poolsLoading ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
                <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">جاري تحميل بنوك المواهب...</p>
              </div>
            ) : filteredPools.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <FolderHeart size={32} />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-slate-800">لا توجد بنوك مواهب مسجلة</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    قم بإنشاء بنك مواهب لتنظيم الكفاءات حسب التخصص أو انقر على "تعبئة أمثلة HR المجهزة".
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    onClick={() => seedDemoMutation.mutate()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2.5 rounded-xl shadow-sm"
                  >
                    <Sparkles size={14} className="ml-1.5" /> تعبئة بنوك HR المجهزة
                  </Button>
                  <Button
                    onClick={openCreatePool}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2.5 rounded-xl shadow-sm"
                  >
                    <Plus size={14} className="ml-1.5" /> إنشاء بنك مواهب جديد
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPools.map(pool => {
                  const colorConfig = POOL_COLORS[pool.color || 'blue'] || POOL_COLORS.blue;
                  const poolCandidates = candidates.filter(c => pool.candidate_ids?.includes(c.id));

                  return (
                    <div
                      key={pool.id}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-blue-300 transition-all shadow-sm p-5 space-y-4 flex flex-col justify-between"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${colorConfig.dot}`} />
                            <h3 className="text-base font-bold text-slate-800">{pool.name}</h3>
                          </div>
                          <Badge className={`${colorConfig.bg} ${colorConfig.text} border ${colorConfig.border} font-bold text-xs`}>
                            {poolCandidates.length} مرشح
                          </Badge>
                        </div>

                        {pool.description && (
                          <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                            {pool.description}
                          </p>
                        )}

                        {/* Tags */}
                        {pool.tags && pool.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-3">
                            {pool.tags.map(t => (
                              <span key={t} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPoolWorkspaceModal(pool)}
                          className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-1.5 font-semibold"
                        >
                          <Users size={13} /> فحص وإدارة المرشحين ({poolCandidates.length})
                        </Button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditPool(pool)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="تعديل بنك المواهب"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                open: true,
                                type: 'pool',
                                id: pool.id,
                                title: 'حذف بنك المواهب',
                                itemName: pool.name,
                                description: 'هل أنت متأكد من حذف هذا البنك نهائياً؟ لن يتم حذف المرشحين من النظام بل استبعادهم من هذا البنك فقط.',
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="حذف بنك المواهب"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: SEQUENCES ───────────────────────────────────────────── */}
        {activeTab === 'sequences' && (
          <div className="space-y-6">
            {seqsLoading ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
                <RefreshCw size={28} className="animate-spin text-emerald-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">جاري تحميل سلاسل التواصل...</p>
              </div>
            ) : sequences.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Send size={32} />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-slate-800">لا توجد سلاسل تواصل يدوية</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    صمم سلاسل متابعة مخصصة يمكنك إطلاقها يدوياً على أي مجموعة مرشحين بنقرة واحدة.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    onClick={() => seedDemoMutation.mutate()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2.5 rounded-xl shadow-sm"
                  >
                    <Sparkles size={14} className="ml-1.5" /> تعبئة سلاسل HR المجهزة
                  </Button>
                  <Button
                    onClick={openCreateSeq}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 py-2.5 rounded-xl shadow-sm"
                  >
                    <Plus size={14} className="ml-1.5" /> إنشاء سلسلة جديدة
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {sequences.map(seq => (
                  <div
                    key={seq.id}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all shadow-sm p-5 space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            {seq.trigger_event === 'MANUAL' ? 'تفعيل يدوي' : seq.trigger_event}
                          </span>
                          <h3 className="text-base font-bold text-slate-800 mt-2">{seq.title}</h3>
                        </div>
                        <Badge className="bg-slate-100 text-slate-700 text-xs font-bold">
                          {seq.steps?.length || 0} خطوات
                        </Badge>
                      </div>

                      {seq.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                          {seq.description}
                        </p>
                      )}

                      {/* Steps breakdown */}
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                        {seq.steps?.map((step, idx) => (
                          <div key={step.id || idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-start gap-2.5 text-xs">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{step.subject}</p>
                              <p className="text-[11px] text-slate-400">تأخير: {step.delay_hours} ساعة</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setEnrollModalSeq(seq);
                          setSelectedPoolId(pools[0]?.id || '');
                          setSelectedCandidateIds([]);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5"
                      >
                        <Play size={13} /> تفعيل السلسلة على مرشحين
                      </Button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditSeq(seq)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="تعديل السلسلة"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              open: true,
                              type: 'sequence',
                              id: seq.id,
                              title: 'حذف السلسلة التلقائية',
                              itemName: seq.title,
                              description: 'هل أنت متأكد من حذف هذه السلسلة؟ لن يؤثر ذلك على الرسائل التي تم إرسالها بالفعل.',
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="حذف السلسلة"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 4: DRIP EXECUTION LOGS ─────────────────────────────────── */}
        {activeTab === 'logs' && (
          <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">سجل إرسال وتنفيذ حملات التقطير التلقائية</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  متابعة الرسائل المرسلة والمجدولة تلقائياً للمرشحين حسب مراحل التوظيف.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-bold text-xs">
                  {dripLogs.length} عملية مسجلة
                </Badge>
                {dripLogs.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDeleteConfirm({
                        open: true,
                        type: 'all-logs',
                        title: 'مسح كافة سجلات التقطير',
                        description: 'هل أنت متأكد من مسح جميع سجلات الإرسال والتنفيذ؟ لن يؤثر هذا على الحملات نفسها.',
                      })
                    }
                    className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center gap-1 px-3"
                  >
                    <Trash2 size={13} /> مسح كافة السجلات
                  </Button>
                )}
              </div>
            </div>

            {logsLoading ? (
              <div className="py-12 text-center">
                <RefreshCw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">جاري تحميل سجلات التقطير...</p>
              </div>
            ) : dripLogs.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Mail size={32} className="text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">لا توجد سجلات تنفيذ حتى الآن</p>
                <p className="text-xs text-slate-500">
                  عند تغيير مراحل المرشحين أو إجراء اختبارات فورية، ستظهر الرسائل المرسلة والمجدولة هنا فوراً.
                </p>
                <Button
                  size="sm"
                  onClick={() => seedDemoMutation.mutate()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 mt-2"
                >
                  <Sparkles size={14} className="ml-1.5" /> تعبئة سجلات HR التجريبية
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">حملة التقطير</th>
                      <th className="p-3">مرحلة التفعيل</th>
                      <th className="p-3">المرشح المستهدف</th>
                      <th className="p-3">الخطوة</th>
                      <th className="p-3">عنوان الرسالة</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3">وقت التنفيذ</th>
                      <th className="p-3 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dripLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-bold text-slate-800">{log.campaign_title}</td>
                        <td className="p-3">
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 font-semibold text-[11px]">
                            {log.trigger_stage}
                          </span>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-800">{log.candidate_name}</p>
                          <p className="text-[11px] text-slate-400">{log.candidate_email}</p>
                        </td>
                        <td className="p-3 font-semibold text-slate-600">
                          #{log.step_number} من {log.total_steps}
                        </td>
                        <td className="p-3 font-medium text-slate-700 max-w-[200px] truncate">
                          {log.subject}
                        </td>
                        <td className="p-3">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 w-fit">
                            <CheckCircle2 size={11} /> {log.status === 'SENT' ? 'تم الإرسال' : log.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {log.executed_at ? new Date(log.executed_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : 'مجدول'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewingLog(log)}
                              className="text-[11px] py-1 px-2 border-slate-200 text-slate-700 hover:bg-slate-100"
                            >
                              <Eye size={12} className="ml-1" /> معاينة
                            </Button>
                            <button
                              onClick={() =>
                                setDeleteConfirm({
                                  open: true,
                                  type: 'log',
                                  id: log.id,
                                  title: 'حذف سجل التقطير',
                                  itemName: `رسالة: ${log.subject}`,
                                  description: 'هل تريد إزالة هذا السجل من قائمة التنفيذ؟',
                                })
                              }
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                              title="حذف السجل"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── MODAL: CREATE / EDIT DRIP CAMPAIGN ──────────────────────────── */}
        {dripModalOpen && (
          <Modal
            open={dripModalOpen}
            onClose={closeDripModal}
            title={editingDrip ? 'تعديل حملة التقطير التلقائية' : 'إنشاء حملة بريد إلكتروني تتابعية (Drip Campaign)'}
          >
            <form onSubmit={handleSaveDrip} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    عنوان الحملة التتابعية <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="مثال: حملة الترحيب ومتابعة المقابلة التلقائية"
                    value={dripTitle}
                    onChange={e => setDripTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    مرحلة التفعيل (Trigger Stage) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={dripTriggerStage}
                    onChange={e => setDripTriggerStage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                    required
                  >
                    {HIRING_STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">وصف الحملة والهدف منها</label>
                <Input
                  placeholder="وصف مختصر للغرض من هذه السلسلة التلقائية..."
                  value={dripDesc}
                  onChange={e => setDripDesc(e.target.value)}
                />
              </div>

              {/* Scoping */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">تخصيص لوظيفة محددة (اختياري)</label>
                  <select
                    value={dripTargetJobId}
                    onChange={e => setDripTargetJobId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">جميع الوظائف في النظام (عام)</option>
                    {jobs.map(j => (
                      <option key={j.id} value={j.id}>{j.title} - {j.company}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">حالة التفعيل الافتراضية</label>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={dripIsActive}
                        onChange={e => setDripIsActive(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span>تفعيل الحملة فور الحفظ</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* AI Campaign Generator Helper */}
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-4 rounded-xl border border-blue-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-800 text-xs font-bold">
                    <Sparkles size={14} className="text-blue-600" />
                    <span>مساعد الذكاء الاصطناعي لصياغة حملات التقطير (Gemini AI Drip Generator)</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="اكتب هدفك (مثلاً: إرسال شكر فوري وتذكير بالاستبيان بعد 48 ساعة)"
                    value={aiDripGoal}
                    onChange={e => setAiDripGoal(e.target.value)}
                    className="bg-white text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleGenerateAIDrip}
                    disabled={generatingAiDrip}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs whitespace-nowrap flex items-center gap-1.5 px-4"
                  >
                    {generatingAiDrip ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    توليد الحملة الذكية
                  </Button>
                </div>
              </div>

              {/* Drip Steps Builder */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">خطوات الحملة التتابعية (Follow-up Steps):</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDripSteps(prev => [
                        ...prev,
                        {
                          step_number: prev.length + 1,
                          delay_value: 3,
                          delay_unit: 'days',
                          delay_hours: 72,
                          subject: '',
                          body_template: '',
                          action_type: 'EMAIL',
                        },
                      ])
                    }
                    className="text-xs border-slate-300 text-slate-700"
                  >
                    + إضافة خطوة تالية
                  </Button>
                </div>

                {dripSteps.map((step, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        الخطوة رقم #{idx + 1}
                      </span>
                      {dripSteps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDripSteps(prev => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 text-xs font-medium"
                        >
                          حذف الخطوة
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">فترة التأخير (Delay)</label>
                        <div className="flex gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            value={step.delay_value ?? (step.delay_hours || 0)}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setDripSteps(prev =>
                                prev.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        delay_value: val,
                                        delay_hours: s.delay_unit === 'days' ? val * 24 : val,
                                      }
                                    : s
                                )
                              );
                            }}
                            className="w-20"
                          />
                          <select
                            value={step.delay_unit || 'hours'}
                            onChange={e => {
                              const unit = e.target.value as 'hours' | 'days';
                              setDripSteps(prev =>
                                prev.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        delay_unit: unit,
                                        delay_hours: unit === 'days' ? (s.delay_value || 0) * 24 : (s.delay_value || 0),
                                      }
                                    : s
                                )
                              );
                            }}
                            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                          >
                            <option value="hours">ساعات</option>
                            <option value="days">أيام</option>
                          </select>
                        </div>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          عنوان البريد (Subject) <span className="text-rose-500">*</span>
                        </label>
                        <Input
                          placeholder="مثال: مرحباً بك {{candidate_name}} في مرحلة المقابلة"
                          value={step.subject || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setDripSteps(prev => prev.map((s, i) => (i === idx ? { ...s, subject: val } : s)));
                          }}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          نص الرسالة وقالب البريد <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-1 flex-wrap">
                          {PLACEHOLDER_TAGS.slice(0, 4).map(p => (
                            <button
                              key={p.tag}
                              type="button"
                              onClick={() => {
                                setDripSteps(prev =>
                                  prev.map((s, i) =>
                                    i === idx ? { ...s, body_template: (s.body_template || '') + ' ' + p.tag } : s
                                  )
                                );
                              }}
                              className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-100 font-mono"
                            >
                              +{p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Textarea
                        placeholder="محتوى الرسالة..."
                        value={step.body_template || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setDripSteps(prev => prev.map((s, i) => (i === idx ? { ...s, body_template: val } : s)));
                        }}
                        rows={3}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={closeDripModal} className="text-xs">
                  إلغاء
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5">
                  {editingDrip ? 'حفظ التعديلات' : 'إنشاء وتفعيل الحملة'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── MODAL: TEST TRIGGER DRIP CAMPAIGN ──────────────────────────── */}
        {testTriggerModal && (
          <Modal
            open={!!testTriggerModal}
            onClose={() => setTestTriggerModal(null)}
            title={`اختبار إطلاق حملة: ${testTriggerModal.title}`}
          >
            <div className="space-y-4 pt-2">
              <p className="text-xs text-slate-600">
                اختر مرشحاً من قاعدة البيانات لمحاكاة إطلاقه في الحملة والتأكد من إرسال الرسالة وتسجيلها في السجلات.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">اختر المرشح للاختبار</label>
                <select
                  value={testCandidateId}
                  onChange={e => setTestCandidateId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                >
                  <option value="">-- اختر مرشحاً --</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.email}) - {c.current_position || 'مرشح'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" onClick={() => setTestTriggerModal(null)} className="text-xs">
                  إلغاء
                </Button>
                <Button
                  onClick={() => {
                    if (!testCandidateId) {
                      showError('اختر مرشحاً أولاً');
                      return;
                    }
                    testTriggerMutation.mutate({
                      id: testTriggerModal.id,
                      candidateId: Number(testCandidateId),
                    });
                  }}
                  disabled={testTriggerMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4"
                >
                  {testTriggerMutation.isPending ? 'جاري الإرسال...' : 'تنفيذ الاختبار الفوري'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* ── MODAL: VIEW DRIP EXECUTION LOG DETAILS ──────────────────────── */}
        {viewingLog && (
          <Modal
            open={!!viewingLog}
            onClose={() => setViewingLog(null)}
            title={`تفاصيل الرسالة المنفذة: ${viewingLog.subject}`}
          >
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block mb-0.5">المرشح المستهدف:</span>
                  <span className="font-bold text-slate-800">{viewingLog.candidate_name}</span>
                  <span className="text-slate-500 block text-[11px]">{viewingLog.candidate_email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">الحملة ومرحلة التفعيل:</span>
                  <span className="font-bold text-slate-800">{viewingLog.campaign_title}</span>
                  <span className="text-blue-600 block text-[11px]">{viewingLog.trigger_stage}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-800">الموضوع: {viewingLog.subject}</p>
                <div className="p-3 bg-white rounded-lg border border-slate-200 whitespace-pre-line text-slate-700 font-sans leading-relaxed">
                  {viewingLog.body_rendered}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setViewingLog(null)} className="text-xs">
                  إغلاق
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* ── MODAL: CREATE / EDIT TALENT POOL ────────────────────────────── */}
        {createPoolOpen && (
          <Modal
            open={createPoolOpen}
            onClose={closePoolModal}
            title={editingPool ? 'تعديل بنك المواهب' : 'إنشاء بنك مواهب جديد'}
          >
            <form onSubmit={handleSavePool} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم بنك المواهب <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="مثال: مطورو Full-Stack المميزون"
                  value={poolName}
                  onChange={e => setPoolName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الوصف</label>
                <Input
                  placeholder="وصف مختصر لمعايير هذا البنك..."
                  value={poolDesc}
                  onChange={e => setPoolDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الوسوم / المهارات المستهدفة (مفصولة بفواصل)
                </label>
                <Input
                  placeholder="React, TypeScript, Node.js, AI"
                  value={poolTagsInput}
                  onChange={e => setPoolTagsInput(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">لون البنك المميز</label>
                <div className="flex items-center gap-3">
                  {Object.keys(POOL_COLORS).map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setPoolColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        POOL_COLORS[color].dot
                      } ${poolColor === color ? 'ring-2 ring-blue-500 ring-offset-2' : 'border-transparent'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={closePoolModal} className="text-xs">
                  إلغاء
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5">
                  {editingPool ? 'حفظ التعديلات' : 'إنشاء بنك المواهب'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── MODAL: WORKSPACE FOR TALENT POOL CANDIDATES & AI MATCHES ───── */}
        {poolWorkspaceModal && (
          <PoolCandidatesWorkspace
            open={!!poolWorkspaceModal}
            pool={poolWorkspaceModal}
            allCandidates={candidates}
            onClose={() => setPoolWorkspaceModal(null)}
            onRemoveCandidate={(poolId, candidateId) =>
              removeCandidateFromPoolMutation.mutate({ poolId, candidateId })
            }
            onAddCandidates={(poolId, candidateIds) =>
              addCandidatesToPoolMutation.mutate({ poolId, candidateIds })
            }
            onInspectCandidate={(c) => setInspectCandidate(c)}
            onEnrollCandidateInSeq={(c) => {
              if (sequences.length > 0) {
                setEnrollModalSeq(sequences[0]);
                setEnrollTargetType('candidates');
                setSelectedCandidateIds([c.id]);
              } else {
                showError('قم بإنشاء سلسلة تواصل أولاً');
              }
            }}
            onStageChange={handleCandidateStageChange}
          />
        )}

        {/* ── MODAL: CANDIDATE DEEP PROFILE INSPECTION ───────────────────── */}
        {inspectCandidate && (
          <CandidateInspectModal
            open={!!inspectCandidate}
            candidate={inspectCandidate}
            onClose={() => setInspectCandidate(null)}
            onStageChange={handleCandidateStageChange}
            onEnrollInSequence={(c) => {
              if (sequences.length > 0) {
                setEnrollModalSeq(sequences[0]);
                setEnrollTargetType('candidates');
                setSelectedCandidateIds([c.id]);
              } else {
                showError('قم بإنشاء سلسلة تواصل أولاً');
              }
            }}
          />
        )}

        {/* ── MODAL: CREATE / EDIT SEQUENCE ───────────────────────────────── */}
        {createSeqOpen && (
          <Modal
            open={createSeqOpen}
            onClose={closeSeqModal}
            title={editingSeq ? 'تعديل السلسلة التلقائية' : 'إنشاء سلسلة رسائل تواصل جديدة'}
          >
            <form onSubmit={handleSaveSeq} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  عنوان السلسلة <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="مثال: سلسلة متابعة مهندسي البرمجيات الجدد"
                  value={seqTitle}
                  onChange={e => setSeqTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">وصف السلسلة</label>
                <Input
                  placeholder="وصف مختصر للغرض من السلسلة..."
                  value={seqDesc}
                  onChange={e => setSeqDesc(e.target.value)}
                />
              </div>

              {/* AI Steps Generator Helper */}
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
                    <Sparkles size={14} className="text-emerald-600" />
                    <span>توليد خطوات السلسلة بالذكاء الاصطناعي (Gemini AI)</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="اكتب هدف الحملة (مثلاً: استقطاب مطوري بايثون ومتابعتهم باحترافية)"
                    value={aiGoal}
                    onChange={e => setAiGoal(e.target.value)}
                    className="bg-white text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleGenerateAISteps}
                    disabled={generatingAi}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs whitespace-nowrap flex items-center gap-1.5 px-3"
                  >
                    {generatingAi ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    توليد الخطوات
                  </Button>
                </div>
              </div>

              {/* Dynamic Steps List */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">خطوات السلسلة التتابعية:</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSeqSteps(prev => [
                        ...prev,
                        { step_number: prev.length + 1, delay_hours: 48, subject: '', body_template: '' },
                      ])
                    }
                    className="text-xs border-slate-300 text-slate-700"
                  >
                    + إضافة خطوة تالية
                  </Button>
                </div>

                {seqSteps.map((step, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        الخطوة رقم #{idx + 1}
                      </span>
                      {seqSteps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setSeqSteps(prev => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 text-xs font-medium"
                        >
                          حذف الخطوة
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">فترة التأخير (بالساعات)</label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0 (فوري) أو 48 أو 72"
                          value={step.delay_hours}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setSeqSteps(prev => prev.map((s, i) => (i === idx ? { ...s, delay_hours: val } : s)));
                          }}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">عنوان البريد (Subject)</label>
                        <Input
                          placeholder="عنوان الرسالة..."
                          value={step.subject}
                          onChange={e => {
                            const val = e.target.value;
                            setSeqSteps(prev => prev.map((s, i) => (i === idx ? { ...s, subject: val } : s)));
                          }}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        نص الرسالة (تستطيع استخدام المتغيرات {'{{candidate_name}}'}, {'{{company_name}}'}, {'{{job_title}}'})
                      </label>
                      <Textarea
                        placeholder="محتوى الرسالة المجدولة..."
                        value={step.body_template}
                        onChange={e => {
                          const val = e.target.value;
                          setSeqSteps(prev => prev.map((s, i) => (i === idx ? { ...s, body_template: val } : s)));
                        }}
                        rows={3}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={closeSeqModal} className="text-xs">
                  إلغاء
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5">
                  {editingSeq ? 'حفظ التعديلات' : 'حفظ وإنشاء السلسلة'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── MODAL: ENROLL CANDIDATES INTO SEQUENCE ───────────────────────── */}
        {enrollModalSeq && (
          <Modal
            open={!!enrollModalSeq}
            onClose={() => setEnrollModalSeq(null)}
            title={`تفعيل السلسلة التلقائية: ${enrollModalSeq.title}`}
          >
            <form onSubmit={handleEnrollSubmit} className="space-y-4 pt-2">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-800 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Info size={14} /> تفاصيل الحملة المجدولة:
                </p>
                <p>تتضمن هذه السلسلة <strong>{enrollModalSeq.steps?.length} خطوات</strong>، تبدأ الخطوة الأولى فورياً أو حسب تأخير كل خطوة.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">طريقة تحديد المستهدفين:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEnrollTargetType('pool')}
                    className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      enrollTargetType === 'pool'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    تطبيق على بنك مواهب كامل
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnrollTargetType('candidates')}
                    className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      enrollTargetType === 'candidates'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    تحديد مرشحين محددين
                  </button>
                </div>
              </div>

              {enrollTargetType === 'pool' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اختر بنك المواهب المستهدف</label>
                  <select
                    value={selectedPoolId}
                    onChange={e => setSelectedPoolId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- اختر بنك مواهب --</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.candidate_ids?.length || 0} مرشح)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">اختر المرشحين</label>
                  <div className="max-h-52 overflow-y-auto scrollbar-thin border border-slate-200 rounded-xl divide-y divide-slate-100 p-2">
                    {candidates.map(c => {
                      const isSelected = selectedCandidateIds.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{c.full_name}</p>
                            <p className="text-[11px] text-slate-400">{c.email}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedCandidateIds(prev => [...prev, c.id]);
                              } else {
                                setSelectedCandidateIds(prev => prev.filter(id => id !== c.id));
                              }
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setEnrollModalSeq(null)} className="text-xs">
                  إلغاء
                </Button>
                <Button type="submit" disabled={enrollMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5">
                  {enrollMutation.isPending ? 'جاري التفعيل...' : 'تأكيد وتفعيل السلسلة التلقائية'}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* ── MODAL: GLOBAL DELETE CONFIRMATION ──────────────────────────── */}
        {deleteConfirm.open && (
          <DeleteConfirmModal
            open={deleteConfirm.open}
            title={deleteConfirm.title}
            itemName={deleteConfirm.itemName}
            description={deleteConfirm.description}
            onClose={() => setDeleteConfirm(prev => ({ ...prev, open: false }))}
            onConfirm={executeDeleteConfirm}
            isPending={
              deletePoolMutation.isPending ||
              deleteSeqMutation.isPending ||
              deleteDripMutation.isPending ||
              deleteLogMutation.isPending ||
              clearLogsMutation.isPending
            }
          />
        )}
      </div>
    </Layout>
  );
}
