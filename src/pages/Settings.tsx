import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Webhook, Plus, Trash2, Send, Copy, Check,
  UserCog, Shield, Zap, Eye, EyeOff, Sparkles, KeyRound, Key,
  Database, Activity, Server, CheckCircle2, AlertCircle, RefreshCw,
  Globe, Code, Terminal, Lock, Building2, Image, Upload, Save, Mail,
  FileText, Edit3, Layers, Filter, Search, RotateCcw, Play, CheckSquare,
  Calendar, DollarSign, Tag, Info, AlertTriangle, ExternalLink
} from 'lucide-react';
import { usersApi, webhooksApi, settingsApi, emailsApi } from '../api';
import { useAuthStore } from '../store/auth';
import { Layout, PageHeader } from '../components/layout/Layout';
import {
  Button, Card, Modal, Input, Select, Badge, EmptyState,
  useToast, Skeleton, Tabs, Textarea,
} from '../components/ui';
import { formatDate } from '../utils';
import type { TeamUser, WebhookEndpoint } from '../types';

const ROLES = [
  { value: 'admin', label: 'مسؤول نظام (Admin)' },
  { value: 'recruiter', label: 'مسؤول توظيف (Recruiter)' },
  { value: 'viewer', label: 'مشاهد فقط (Viewer)' },
];

// ── Edit User & Reset Password Modal ──────────────────────────────
function EditUserPasswordModal({ user, open, onClose }: { user: any; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name || '',
    password: '',
    role: user?.role || 'recruiter',
    org_name: user?.org_name || '',
    is_active: user?.is_active ?? true,
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        password: '',
        role: user.role || 'recruiter',
        org_name: user.org_name || '',
        is_active: user.is_active ?? true,
      });
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: () => usersApi.update(user.id, {
      name: form.name,
      role: form.role,
      org_name: form.org_name,
      is_active: form.is_active,
      ...(form.password.trim() ? { password: form.password.trim() } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast('تم تحديث بيانات المستخدم وكلمة المرور بنجاح', 'success');
      onClose();
    },
    onError: (e: any) => toast(e?.response?.data?.detail || 'فشل تحديث بيانات المستخدم', 'error'),
  });

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title={`تعديل الحساب وإعادة تعيين كلمة المرور`}>
      <div className="space-y-4">
        <Input
          label="الاسم الكامل"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        />
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500 mb-1">البريد الإلكتروني (الحساب)</p>
          <p className="text-sm font-semibold text-slate-800 dir-ltr text-left">{user.email}</p>
        </div>
        <Input
          label="تعيين كلمة مرور جديدة (اتركها فارغة للحفاظ على الحالية)"
          type="text"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          placeholder="أدخل كلمة مرور جديدة لتعيينها فوراً..."
          hint="سيتم تعيين هذه كلمة المرور وتفعيلها فوراً لهذا الحساب"
        />
        <Select
          label="دور الحساب"
          value={form.role}
          onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          options={ROLES}
        />
        <Input
          label="اسم مساحة العمل / الشركة"
          value={form.org_name}
          onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
        />
        <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs font-semibold text-slate-700">الحساب نشط ويمكنه تسجيل الدخول</span>
        </label>

        <Button className="w-full justify-center" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          حفظ التغييرات وكلمة المرور
        </Button>
      </div>
    </Modal>
  );
}

// ── Team Tab ────────────────────────────────────────────────────────
function InviteUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: 'pass1234',
    role: 'recruiter',
    create_isolated_workspace: true,
    org_name: '',
  });
  const [createdUser, setCreatedUser] = useState<any>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPw, setCopiedPw] = useState(false);

  const mutation = useMutation({
    mutationFn: () => usersApi.create(form),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast('تم إنشاء حساب المستخدم بنجاح', 'success');
      setCreatedUser({
        name: form.name,
        email: form.email,
        password: form.password || 'pass1234',
        role: form.role,
        org_name: form.org_name || res?.org_name || 'Standard Workspace',
      });
      setForm({ name: '', email: '', password: 'pass1234', role: 'recruiter', create_isolated_workspace: true, org_name: '' });
    },
    onError: (e: any) => toast(e?.response?.data?.detail || 'فشل إضافة المستخدم', 'error'),
  });

  const handleClose = () => {
    setCreatedUser(null);
    setCopiedEmail(false);
    setCopiedPw(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={createdUser ? "تم إنشاء الحساب بنجاح! 🎉" : "إضافة حساب مستخدم جديد (Admin Only)"}>
      {createdUser ? (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
            <p className="text-sm font-bold text-emerald-900">تم تجهيز الحساب ويمكن للمستخدم تسجيل الدخول الآن</p>
            <p className="text-xs text-emerald-700 mt-1">يرجى نسخ أو إرسال بيانات الدخول التالية للمستخدم:</p>
          </div>

          <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div>
              <span className="text-xs text-slate-500 font-medium block mb-1">الاسم الكامل:</span>
              <span className="text-sm font-semibold text-slate-800">{createdUser.name}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block mb-1">البريد الإلكتروني:</span>
              <div className="flex items-center justify-between bg-white border border-slate-200 p-2.5 rounded-lg">
                <span className="text-xs font-mono text-slate-800 dir-ltr">{createdUser.email}</span>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(createdUser.email); setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000); }}
                  className="text-slate-500 hover:text-blue-600 text-xs flex items-center gap-1 font-medium"
                >
                  {copiedEmail ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copiedEmail ? 'تم النسخ' : 'نسخ'}
                </button>
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block mb-1">كلمة المرور:</span>
              <div className="flex items-center justify-between bg-white border border-slate-200 p-2.5 rounded-lg">
                <span className="text-xs font-mono font-bold text-slate-900 dir-ltr">{createdUser.password}</span>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(createdUser.password); setCopiedPw(true); setTimeout(() => setCopiedPw(false), 2000); }}
                  className="text-slate-500 hover:text-blue-600 text-xs flex items-center gap-1 font-medium"
                >
                  {copiedPw ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copiedPw ? 'تم النسخ' : 'نسخ'}
                </button>
              </div>
            </div>
          </div>

          <Button className="w-full justify-center" onClick={handleClose}>
            تم، إغلاق النافذة
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="الاسم الكامل *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="مثال: سارة أحمد"
            required
          />
          <Input
            label="البريد الإلكتروني *"
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="recruiter@company.com"
            required
          />
          <Input
            label="كلمة المرور *"
            type="text"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            hint="افتراضياً: pass1234 — يمكنك تغييرها الآن"
            required
          />
          <Select
            label="دور الحساب"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            options={ROLES}
          />

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.create_isolated_workspace}
                onChange={e => setForm(f => ({ ...f, create_isolated_workspace: e.target.checked }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-slate-700">إنشاء مساحة عمل مستقلة لهذا المستخدم</span>
            </label>
            <p className="text-[11px] text-slate-500">
              عند التفعيل، سيكون لهذا المستخدم مساحة عمل مستقلة تحوي الوظائف والمرشحين دون اختلاط مع باقي الفريق.
            </p>

            {form.create_isolated_workspace && (
              <div className="pt-2">
                <Input
                  label="اسم مساحة العمل / الشركة (اختياري)"
                  value={form.org_name}
                  onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
                  placeholder="مثال: الشركة العربية للتوظيف"
                />
              </div>
            )}
          </div>

          <Button className="w-full justify-center" onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!form.name || !form.email || !form.password}>
            إنشاء حساب المستخدم
          </Button>
        </div>
      )}
    </Modal>
  );
}

function TeamTab() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const { data: team = [], isLoading } = useQuery({ queryKey: ['team'], queryFn: usersApi.list });

  const toggleActiveMutation = useMutation({
    mutationFn: (u: TeamUser) => usersApi.update(u.id, { is_active: !u.is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); toast('تم تحديث حالة الحساب بنجاح', 'success'); },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => usersApi.update(id, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); toast('تم تحديث الدور بنجاح', 'success'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); toast('تم حذف المستخدم بنجاح', 'success'); },
    onError: (e: any) => toast(e?.response?.data?.detail || 'فشل حذف المستخدم', 'error'),
  });

  const canManage = user?.role === 'admin' || user?.role === 'owner';

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex items-center justify-between bg-purple-50 border border-purple-200 p-4 rounded-xl">
          <div>
            <h3 className="text-sm font-bold text-purple-950 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
              إدارة المستخدمين والحسابات (التحكم الكامل للأدمن)
            </h3>
            <p className="text-xs text-purple-700 mt-0.5">
              بصفتك المسؤول، يمكنك إضافة مسؤولين وتوظيف جدد، إعادة تعيين كلمات المرور، وتحديد مساحات العمل.
            </p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setInviteOpen(true)}>إضافة مستخدم جديد</Button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
          <p className="text-xs text-slate-600">
            <strong>مسجل كـ:</strong> {user?.name} ({user?.role?.toUpperCase()}) — مساحة العمل: <em>{user?.org_name || 'مساحة العمل القياسية'}</em>. إضافة وتعديل المستخدمين يتم حصرياً عبر مسؤول النظام (Admin).
          </p>
        </div>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-4 space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {team.filter((m: any) => canManage || m.id === user?.id).map((m: any) => (
              <div key={m.id} className="flex items-center gap-4 p-4">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  m.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                    {m.id === user?.id && <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">حسابك الحالي</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500 truncate">{m.email}</p>
                    {m.org_name && <span className="text-[10px] text-slate-400">• {m.org_name}</span>}
                  </div>
                </div>
                {canManage && m.role !== 'owner' ? (
                  <Select
                    value={m.role}
                    onChange={e => roleMutation.mutate({ id: m.id, role: e.target.value })}
                    options={ROLES}
                    className="!py-1.5 text-xs w-36"
                  />
                ) : (
                  <Badge className={m.role === 'admin' ? 'bg-purple-100 text-purple-700 font-semibold capitalize' : 'bg-emerald-100 text-emerald-700 capitalize'}>
                    {m.role}
                  </Badge>
                )}
                <Badge className={m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                  {m.is_active ? 'نشط' : 'معطل'}
                </Badge>
                {canManage && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditingUser(m)} title="تعديل الحساب وإعادة تعيين كلمة المرور">
                      <KeyRound size={14} className="text-blue-600" />
                    </Button>
                    {m.id !== user?.id && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => toggleActiveMutation.mutate(m)} title={m.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}>
                          {m.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(m.id)} title="حذف الحساب">
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      {editingUser && (
        <EditUserPasswordModal user={editingUser} open={Boolean(editingUser)} onClose={() => setEditingUser(null)} />
      )}
    </div>
  );
}

// ── Webhooks Tab ────────────────────────────────────────────────────
function CreateWebhookModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ url: '', description: '', events: ['*'] as string[] });
  const [created, setCreated] = useState<{ secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: eventsData } = useQuery({ queryKey: ['webhook-events'], queryFn: webhooksApi.listEvents });

  const mutation = useMutation({
    mutationFn: () => webhooksApi.createEndpoint(form),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      setCreated(res);
      toast('Webhook created', 'success');
    },
    onError: (e: any) => toast(e?.response?.data?.detail || 'Failed to create webhook', 'error'),
  });

  const toggleEvent = (ev: string) => {
    setForm(f => {
      if (ev === '*') return { ...f, events: ['*'] };
      const withoutStar = f.events.filter(e => e !== '*');
      return { ...f, events: withoutStar.includes(ev) ? withoutStar.filter(e => e !== ev) : [...withoutStar, ev] };
    });
  };

  const handleClose = () => {
    setCreated(null);
    setForm({ url: '', description: '', events: ['*'] });
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Register webhook" width="max-w-lg">
      {created ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Save this signing secret now — it won't be shown again.</p>
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg font-mono text-xs break-all">
            <span className="flex-1">{created.secret}</span>
            <button onClick={() => { navigator.clipboard.writeText(created.secret); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} className="text-slate-400" />}
            </button>
          </div>
          <Button className="w-full justify-center" onClick={handleClose}>Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Input label="Endpoint URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://your-app.com/webhooks/talentai" />
          <Input label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Slack notifications" />
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Events</label>
            <div className="flex flex-wrap gap-2">
              {(eventsData?.events || ['*']).map(ev => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors
                    ${form.events.includes(ev) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full justify-center" onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!form.url}>
            Create webhook
          </Button>
        </div>
      )}
    </Modal>
  );
}

function WebhookDeliveriesModal({ webhook, open, onClose }: { webhook: WebhookEndpoint | null; open: boolean; onClose: () => void }) {
  const { data: deliveries = [] } = useQuery({
    queryKey: ['webhook-deliveries', webhook?.id],
    queryFn: () => webhooksApi.getDeliveries(webhook!.id),
    enabled: !!webhook?.id,
  });

  return (
    <Modal open={open} onClose={onClose} title={`Recent deliveries — ${webhook?.description || webhook?.url}`} width="max-w-2xl">
      {deliveries.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No deliveries yet.</p>
      ) : (
        <div className="space-y-2">
          {deliveries.map(d => (
            <div key={d.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg text-sm">
              <Badge className={d.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                {d.status_code || 'Failed'}
              </Badge>
              <span className="flex-1 text-slate-600">{d.event}</span>
              <span className="text-xs text-slate-400">attempt {d.attempt}</span>
              <span className="text-xs text-slate-400">{formatDate(d.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function WebhooksTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deliveriesFor, setDeliveriesFor] = useState<WebhookEndpoint | null>(null);

  const { data: webhooks = [], isLoading } = useQuery({ queryKey: ['webhooks'], queryFn: webhooksApi.listEndpoints });

  const testMutation = useMutation({
    mutationFn: (id: number) => webhooksApi.testEndpoint(id),
    onSuccess: () => toast('Test ping sent', 'success'),
  });

  const toggleMutation = useMutation({
    mutationFn: (w: WebhookEndpoint) => webhooksApi.updateEndpoint(w.id, { is_active: !w.is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); toast('Webhook updated', 'success'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => webhooksApi.deleteEndpoint(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); toast('Webhook deleted', 'success'); },
  });

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>Register webhook</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={<Webhook size={28} />}
          title="No webhooks yet"
          description="Register an endpoint to receive real-time events like candidate.shortlisted or job.created."
          action={<Button icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>Register webhook</Button>}
        />
      ) : (
        <div className="space-y-3">
          {webhooks.map(w => (
            <Card key={w.id} className="flex items-center gap-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${w.is_active ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                <Zap size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{w.description || w.url}</p>
                <p className="text-xs text-slate-500 truncate">{w.url}</p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {w.events.map(e => <Badge key={e} className="bg-slate-100 text-slate-500 text-xs">{e}</Badge>)}
                </div>
              </div>
              <Badge className={w.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                {w.is_active ? 'Active' : 'Disabled'}
              </Badge>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setDeliveriesFor(w)}>Logs</Button>
                <Button variant="ghost" size="sm" icon={<Send size={13} />} onClick={() => testMutation.mutate(w.id)} loading={testMutation.isPending} />
                <Button variant="ghost" size="sm" onClick={() => toggleMutation.mutate(w)}>{w.is_active ? 'Disable' : 'Enable'}</Button>
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(w.id)}><Trash2 size={14} className="text-red-500" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateWebhookModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <WebhookDeliveriesModal webhook={deliveriesFor} open={!!deliveriesFor} onClose={() => setDeliveriesFor(null)} />
    </div>
  );
}

// ── AI Engine Tab ───────────────────────────────────────────────────
function AIEngineTab() {
  const qc = useQueryClient();
  const toast = useToast();
  const [groqKey, setGroqKey] = useState('');
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery<{
    has_groq_key: boolean;
    has_gemini_key: boolean;
    groq_key_preview: string;
    primary_engine: string;
  }>({
    queryKey: ['settings-ai'],
    queryFn: settingsApi.getAI,
  });

  const updateMutation = useMutation({
    mutationFn: () => settingsApi.updateAI({ groq_api_key: groqKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-ai'] });
      qc.invalidateQueries({ queryKey: ['ai-config'] });
      toast('Groq API Key saved successfully', 'success');
      setGroqKey('');
    },
    onError: () => toast('Failed to update Groq API key', 'error'),
  });

  const clearWorkspaceMutation = useMutation({
    mutationFn: settingsApi.clearWorkspace,
    onSuccess: (res: any) => {
      qc.invalidateQueries();
      toast(res.message || 'Workspace cleared', 'success');
      setClearConfirmOpen(false);
    },
    onError: () => toast('Failed to clear workspace', 'error'),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Sparkles size={16} className="text-purple-600" />
              Groq LPU Acceleration Engine
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Groq provides sub-second (~300ms) ultra-fast candidate evaluation and CV analysis using Llama-3.3-70B.
            </p>
          </div>
          <Badge className={data?.has_groq_key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
            {data?.has_groq_key ? 'Groq Active' : 'Not Configured'}
          </Badge>
        </div>

        {isLoading ? (
          <Skeleton className="h-20" />
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Active Engine:</span>
                <span className="font-semibold text-slate-700">{data?.primary_engine}</span>
              </div>
              {data?.groq_key_preview && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Stored Key:</span>
                  <span className="font-mono text-slate-700">{data.groq_key_preview}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Input
                label="Groq API Key (gsk_...)"
                type="password"
                value={groqKey}
                onChange={e => setGroqKey(e.target.value)}
                placeholder={data?.has_groq_key ? 'Enter new gsk_... key to replace' : 'Paste gsk_... key here'}
              />
              <p className="text-[11px] text-slate-400">
                You can get your free API key at <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">console.groq.com</a>.
              </p>
            </div>

            <Button
              icon={<Zap size={14} />}
              onClick={() => updateMutation.mutate()}
              loading={updateMutation.isPending}
              disabled={!groqKey.trim()}
            >
              Save Groq API Key
            </Button>
          </div>
        )}
      </Card>

      <Card className="border-red-200 bg-red-50/40">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
              <Trash2 size={16} className="text-red-600" />
              Clean Workspace Reset
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Clear all jobs and candidate records from your organization workspace to start completely fresh with 0 items.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setClearConfirmOpen(true)}>
            Clear Workspace
          </Button>
        </div>
      </Card>

      <Modal open={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} title="Confirm Clean Workspace Reset">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Are you sure you want to clear your current workspace? This will remove all jobs and candidate records associated with your account so that your dashboard is completely empty.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setClearConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => clearWorkspaceMutation.mutate()}
              loading={clearWorkspaceMutation.isPending}
            >
              Yes, Clear Everything
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Database Tab ────────────────────────────────────────────────────
function DatabaseTab() {
  const toast = useToast();
  const [copiedRestUrl, setCopiedRestUrl] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    configured: boolean;
    message: string;
    details?: {
      latency_ms?: number;
      uptime_seconds?: number;
      server_time?: string;
      db_name?: string;
      version?: string;
      db_url_masked?: string;
      rest_api_url?: string;
    };
  } | null>(null);

  const testMutation = useMutation({
    mutationFn: settingsApi.testDbConnection,
    onSuccess: (data) => {
      setTestResult(data);
      if (data.connected) {
        toast('Neon PostgreSQL database is connected and healthy!', 'success');
      } else if (!data.configured) {
        toast('DATABASE_URL is not configured yet.', 'info');
      } else {
        toast(data.message || 'Database connection test failed', 'error');
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to execute health check';
      toast(msg, 'error');
      setTestResult({
        connected: false,
        configured: true,
        message: msg,
      });
    },
  });

  const restUrl = testResult?.details?.rest_api_url || 'https://ep-gentle-salad-axxielyi.apirest.c-4.us-east-2.aws.neon.tech/neondb/rest/v1';

  const handleCopyRestUrl = () => {
    navigator.clipboard.writeText(restUrl);
    setCopiedRestUrl(true);
    toast('Neon REST Data API URL copied to clipboard!', 'success');
    setTimeout(() => setCopiedRestUrl(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Database size={18} className="text-blue-600" />
              Neon PostgreSQL Connection Health
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Verify real-time reachability, SSL connection, and table schemas on your Neon database instance.
            </p>
          </div>

          <Button
            icon={testMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
            onClick={() => testMutation.mutate()}
            loading={testMutation.isPending}
            className="w-full sm:w-auto justify-center"
          >
            Test Connection
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          {testResult ? (
            <div className={`p-4 rounded-xl border ${
              testResult.connected
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                : testResult.configured
                ? 'bg-red-50/60 border-red-200 text-red-900'
                : 'bg-amber-50/60 border-amber-200 text-amber-900'
            }`}>
              <div className="flex items-start gap-3">
                {testResult.connected ? (
                  <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={20} className={testResult.configured ? 'text-red-600 flex-shrink-0 mt-0.5' : 'text-amber-600 flex-shrink-0 mt-0.5'} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {testResult.connected ? 'Database Reachable & Online' : testResult.configured ? 'Connection Failed' : 'Unconfigured Connection'}
                    </span>
                    {testResult.connected && (
                      <div className="flex gap-2">
                        <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                          {testResult.details?.latency_ms !== undefined ? `⚡ ${testResult.details.latency_ms} ms` : 'Active'}
                        </Badge>
                        {testResult.details?.uptime_seconds !== undefined && (
                          <Badge className="bg-blue-100 text-blue-800 text-xs">
                            ⏱ Uptime: {testResult.details.uptime_seconds}s
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs mt-1 opacity-90">{testResult.message}</p>

                  {testResult.details && (
                    <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      {testResult.details.db_url_masked && (
                        <div>
                          <span className="text-slate-500 font-sans block text-[11px]">Database Host</span>
                          <span className="truncate block font-semibold">{testResult.details.db_url_masked}</span>
                        </div>
                      )}
                      {testResult.details.db_name && (
                        <div>
                          <span className="text-slate-500 font-sans block text-[11px]">Database Name</span>
                          <span className="font-semibold">{testResult.details.db_name}</span>
                        </div>
                      )}
                      {testResult.details.version && (
                        <div>
                          <span className="text-slate-500 font-sans block text-[11px]">Engine Version</span>
                          <span className="font-semibold">{testResult.details.version}</span>
                        </div>
                      )}
                      {testResult.details.server_time && (
                        <div>
                          <span className="text-slate-500 font-sans block text-[11px]">PostgreSQL Time</span>
                          <span className="font-semibold">{formatDate(testResult.details.server_time)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <Server size={24} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-medium text-slate-700">No recent connection test performed</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Click the <strong>Test Connection</strong> button above to run a health check query against Neon PostgreSQL.
              </p>
            </div>
          )}

          {/* Neon Serverless REST Data API Section */}
          <div className="border border-blue-200 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-blue-600" />
                <h4 className="font-semibold text-sm text-slate-800">Neon Serverless REST Data API</h4>
              </div>
              <Badge className="bg-blue-100 text-blue-800 text-[11px] font-medium">PostgREST v1</Badge>
            </div>

            <p className="text-xs text-slate-600">
              Your Neon PostgreSQL instance provides an automated Serverless HTTP REST Data API to query and manage tables directly via HTTP requests.
            </p>

            <div className="bg-slate-900 text-slate-200 rounded-lg p-3 text-xs font-mono flex items-center justify-between gap-2 overflow-x-auto">
              <span className="truncate selection:bg-blue-500 selection:text-white">{restUrl}</span>
              <button
                onClick={handleCopyRestUrl}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] flex-shrink-0"
              >
                {copiedRestUrl ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copiedRestUrl ? 'Copied' : 'Copy API URL'}
              </button>
            </div>

            <div className="bg-white/80 border border-slate-200/80 rounded-lg p-3 text-xs space-y-2">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-[11px]">
                <Code size={13} className="text-indigo-600" />
                Sample HTTP Request (Bearer JWT Authenticated):
              </span>
              <pre className="bg-slate-950 text-emerald-400 p-2.5 rounded font-mono text-[11px] overflow-x-auto">
{`curl -X GET "${restUrl}/candidates?select=id,full_name,current_position,match_score" \\
  -H "Authorization: Bearer <NEON_JWT_TOKEN>"`}
              </pre>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-700">
            <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Server size={14} className="text-blue-600" />
              How Neon PostgreSQL Integration Works
            </h4>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>When <code>DATABASE_URL</code> is set, the app automatically initializes table schemas (<code>jobs</code>, <code>candidates</code>, <code>users</code>).</li>
              <li>Every action and candidate evaluation is persisted seamlessly with fallback to fast local storage if unconfigured.</li>
              <li>You can update your <code>DATABASE_URL</code> at any time in environment variables.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Email Templates Management System ─────────────────────────────────────────
const AVAILABLE_TAGS = [
  { tag: '{{candidate_name}}', label: 'Candidate Name', desc: 'e.g. Karim Abdelrahman' },
  { tag: '{{job_title}}', label: 'Job Position', desc: 'e.g. Senior Full Stack Engineer' },
  { tag: '{{company_name}}', label: 'Company Name', desc: 'e.g. CalliQ HR' },
  { tag: '{{recruiter_name}}', label: 'Recruiter Name', desc: 'e.g. CalliQ Recruiter' },
  { tag: '{{interview_date}}', label: 'Interview Date', desc: 'e.g. Tomorrow at 3:00 PM' },
  { tag: '{{interview_link}}', label: 'Meeting Link', desc: 'e.g. https://meet.google.com/...' },
  { tag: '{{offer_amount}}', label: 'Offer Salary', desc: 'e.g. 35,000' },
  { tag: '{{offer_currency}}', label: 'Currency', desc: 'e.g. EGP' },
  { tag: '{{offer_deadline}}', label: 'Deadline', desc: 'e.g. 5 Business Days' },
];

function getCategoryMeta(category?: string, event?: string) {
  const cat = category || (
    event === 'rejection_notice' ? 'rejection' :
    event === 'interview_scheduled' ? 'interview' :
    event === 'offer_letter' ? 'offer' :
    event === 'application_received' ? 'confirmation' :
    event === 'shortlisted' ? 'shortlist' : 'custom'
  );

  switch (cat) {
    case 'rejection':
      return { key: 'rejection', label: 'Candidate Rejection', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'interview':
      return { key: 'interview', label: 'Interview Scheduling', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'offer':
      return { key: 'offer', label: 'Offer Letter', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'confirmation':
      return { key: 'confirmation', label: 'Application Receipt', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'shortlist':
      return { key: 'shortlist', label: 'Shortlisted Candidate', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    default:
      return { key: 'custom', label: 'Custom Response', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' };
  }
}

function renderSampleEmailContent(template: any, user?: any) {
  const sampleCandidate = 'Karim Abdelrahman';
  const sampleJob = 'Senior Full Stack Engineer';
  const sampleCompany = user?.org_name || 'CalliQ HR Systems';
  const recruiter = user?.name || 'CalliQ Recruiter';

  let subject = (template?.subject || '')
    .replace(/\{\{candidate_name\}\}/g, sampleCandidate)
    .replace(/\{\{job_title\}\}/g, sampleJob)
    .replace(/\{\{company_name\}\}/g, sampleCompany)
    .replace(/\{\{recruiter_name\}\}/g, recruiter)
    .replace(/\{\{interview_date\}\}/g, 'Tomorrow at 3:00 PM (Cairo Time)')
    .replace(/\{\{interview_link\}\}/g, 'https://meet.google.com/calliq-interview-room')
    .replace(/\{\{offer_amount\}\}/g, '35,000')
    .replace(/\{\{offer_currency\}\}/g, 'EGP')
    .replace(/\{\{offer_deadline\}\}/g, '5 Business Days');

  let body = (template?.body || '')
    .replace(/\{\{candidate_name\}\}/g, sampleCandidate)
    .replace(/\{\{job_title\}\}/g, sampleJob)
    .replace(/\{\{company_name\}\}/g, sampleCompany)
    .replace(/\{\{recruiter_name\}\}/g, recruiter)
    .replace(/\{\{interview_date\}\}/g, 'Tomorrow at 3:00 PM (Cairo Time)')
    .replace(/\{\{interview_link\}\}/g, 'https://meet.google.com/calliq-interview-room')
    .replace(/\{\{offer_amount\}\}/g, '35,000')
    .replace(/\{\{offer_currency\}\}/g, 'EGP')
    .replace(/\{\{offer_deadline\}\}/g, '5 Business Days');

  return { subject, body, sampleCandidate, sampleJob, sampleCompany };
}

function EmailTemplatesTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Modals
  const [editingTpl, setEditingTpl] = useState<any>(null);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const [previewTpl, setPreviewTpl] = useState<any>(null);
  const [testSendTpl, setTestSendTpl] = useState<any>(null);
  const [testRecipientEmail, setTestRecipientEmail] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => emailsApi.getTemplates(),
  });

  const saveMutation = useMutation({
    mutationFn: (tpl: any) => emailsApi.saveTemplate(tpl),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      toast('Email template saved successfully!', 'success');
      setEditingTpl(null);
    },
    onError: () => toast('Failed to save email template', 'error'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (tpl: any) => emailsApi.saveTemplate({ ...tpl, is_active: !tpl.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      toast('Template active status updated', 'success');
    },
    onError: () => toast('Failed to update status', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailsApi.deleteTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      toast('Template deleted successfully', 'success');
      setConfirmDeleteId(null);
    },
    onError: () => toast('Failed to delete template', 'error'),
  });

  const resetMutation = useMutation({
    mutationFn: () => emailsApi.resetTemplates(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      toast('Email templates restored to system defaults!', 'success');
      setShowResetModal(false);
    },
    onError: () => toast('Failed to reset templates', 'error'),
  });

  const testSendMutation = useMutation({
    mutationFn: (data: { template_id: string; recipient_email?: string }) =>
      emailsApi.testSendTemplate(data),
    onSuccess: (res) => {
      toast(res.message || 'Test email dispatched successfully!', 'success');
      setTestSendTpl(null);
    },
    onError: () => toast('Failed to send test email', 'error'),
  });

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const meta = getCategoryMeta(t.category, t.event);
    const matchesCat = selectedCategory === 'all' || meta.key === selectedCategory;
    const searchLower = searchTerm.trim().toLowerCase();
    const matchesSearch = !searchLower ||
      t.name.toLowerCase().includes(searchLower) ||
      t.subject.toLowerCase().includes(searchLower) ||
      t.body.toLowerCase().includes(searchLower) ||
      (t.event || '').toLowerCase().includes(searchLower);
    return matchesCat && matchesSearch;
  });

  const handleOpenCreateNew = () => {
    setEditingTpl({
      id: '',
      name: '',
      event: 'custom',
      category: 'custom',
      subject: 'Notice regarding your application for {{job_title}}',
      body: 'Dear {{candidate_name}},\n\nThank you for taking the time to apply for the {{job_title}} position at {{company_name}}.\n\nWe would like to invite you to the next step of our recruitment process.\n\nBest regards,\n{{company_name}} Talent Team',
      is_active: true,
      description: 'Custom response template for candidate communications.',
    });
    setEditorTab('edit');
  };

  const handleDuplicate = (tpl: any) => {
    const duplicate = {
      ...tpl,
      id: '',
      name: `${tpl.name} (Copy)`,
      updated_at: new Date().toISOString(),
    };
    saveMutation.mutate(duplicate);
  };

  const handleInsertTagInEditor = (tag: string) => {
    if (!editingTpl) return;
    setEditingTpl((prev: any) => ({
      ...prev,
      body: (prev.body || '') + (prev.body && !prev.body.endsWith(' ') ? ' ' : '') + tag,
    }));
  };

  const categories = [
    { key: 'all', label: 'All Templates', count: templates.length },
    { key: 'rejection', label: '🔴 Rejections', count: templates.filter(t => getCategoryMeta(t.category, t.event).key === 'rejection').length },
    { key: 'interview', label: '📅 Interviews', count: templates.filter(t => getCategoryMeta(t.category, t.event).key === 'interview').length },
    { key: 'offer', label: '📄 Offer Letters', count: templates.filter(t => getCategoryMeta(t.category, t.event).key === 'offer').length },
    { key: 'confirmation', label: '📩 Confirmations', count: templates.filter(t => getCategoryMeta(t.category, t.event).key === 'confirmation').length },
    { key: 'shortlist', label: '⭐ Shortlisted', count: templates.filter(t => getCategoryMeta(t.category, t.event).key === 'shortlist').length },
    { key: 'custom', label: '⚡ Custom', count: templates.filter(t => getCategoryMeta(t.category, t.event).key === 'custom').length },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header Card */}
      <Card className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
                <Mail size={20} />
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">Email Template Management System</h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Create, customize, and manage predefined response templates for candidate rejection, interview invitations, offer letters, and status updates with automated variable insertion.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw size={14} />}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs"
              onClick={() => setShowResetModal(true)}
            >
              Reset Defaults
            </Button>
            <Button
              size="sm"
              icon={<Plus size={15} />}
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg text-xs"
              onClick={handleOpenCreateNew}
            >
              Create Template
            </Button>
          </div>
        </div>
      </Card>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === cat.key
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <span>{cat.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                selectedCategory === cat.key ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<FileText size={32} className="text-slate-400" />}
          title="No email templates found"
          description={searchTerm ? "No templates match your search criteria." : "No templates exist in this category yet."}
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={handleOpenCreateNew}>
              Create New Template
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map(tpl => {
            const meta = getCategoryMeta(tpl.category, tpl.event);
            return (
              <div
                key={tpl.id}
                className="bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Top Header Row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {tpl.event}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {tpl.name}
                      </h4>
                    </div>

                    {/* Active Toggle */}
                    <button
                      onClick={() => toggleActiveMutation.mutate(tpl)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border flex items-center gap-1 ${
                        tpl.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                      title={tpl.is_active ? 'Click to disable auto-send' : 'Click to enable auto-send'}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${tpl.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      <span>{tpl.is_active ? 'Active' : 'Disabled'}</span>
                    </button>
                  </div>

                  {/* Subject Line */}
                  <div className="mb-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 block mb-0.5">Subject:</span>
                    <p className="text-xs font-semibold text-slate-800 truncate">{tpl.subject}</p>
                  </div>

                  {/* Body Snippet */}
                  <div className="relative">
                    <p className="text-xs text-slate-600 line-clamp-3 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100/80 leading-relaxed whitespace-pre-line font-normal">
                      {tpl.body}
                    </p>
                  </div>
                </div>

                {/* Card Action Row */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Edit3 size={12} />}
                      onClick={() => { setEditingTpl({ ...tpl }); setEditorTab('edit'); }}
                      className="text-xs py-1 px-2.5"
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Eye size={12} />}
                      onClick={() => setPreviewTpl(tpl)}
                      className="text-xs py-1 px-2.5 text-slate-600"
                    >
                      Preview
                    </Button>
                    <button
                      onClick={() => handleDuplicate(tpl)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors text-xs"
                      title="Duplicate Template"
                    >
                      <Copy size={13} />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Send size={12} className="text-indigo-600" />}
                      onClick={() => { setTestSendTpl(tpl); setTestRecipientEmail(user?.email || ''); }}
                      className="text-xs py-1 px-2.5 text-indigo-700 bg-indigo-50/60 border-indigo-200 hover:bg-indigo-100"
                    >
                      Test Send
                    </Button>
                    <button
                      onClick={() => setConfirmDeleteId(tpl.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Template"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal (Create & Edit) */}
      {editingTpl && (
        <Modal
          open={!!editingTpl}
          onClose={() => setEditingTpl(null)}
          title={editingTpl.id ? `Edit: ${editingTpl.name}` : 'Create New Email Template'}
        >
          <div className="space-y-4 max-w-2xl">
            {/* Modal Header Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditorTab('edit')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    editorTab === 'edit'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  ✏️ Edit Template Content
                </button>
                <button
                  onClick={() => setEditorTab('preview')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    editorTab === 'preview'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  👁️ Live Rendered Preview
                </button>
              </div>

              <span className="text-[11px] font-mono text-slate-400">
                ID: {editingTpl.id || 'new_template'}
              </span>
            </div>

            {editorTab === 'edit' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Template Name"
                    value={editingTpl.name}
                    onChange={e => setEditingTpl({ ...editingTpl, name: e.target.value })}
                    placeholder="e.g. Senior Engineer Interview Invitation"
                  />

                  <Select
                    label="Category / Trigger Event"
                    value={editingTpl.event}
                    onChange={e => {
                      const val = e.target.value;
                      const cat = val === 'rejection_notice' ? 'rejection' :
                        val === 'interview_scheduled' ? 'interview' :
                        val === 'offer_letter' ? 'offer' :
                        val === 'application_received' ? 'confirmation' :
                        val === 'shortlisted' ? 'shortlist' : 'custom';
                      setEditingTpl({ ...editingTpl, event: val, category: cat });
                    }}
                    options={[
                      { value: 'rejection_notice', label: '🔴 Candidate Rejection (rejection_notice)' },
                      { value: 'interview_scheduled', label: '📅 Interview Scheduling (interview_scheduled)' },
                      { value: 'offer_letter', label: '📄 Offer Letter (offer_letter)' },
                      { value: 'application_received', label: '📩 Application Confirmation (application_received)' },
                      { value: 'shortlisted', label: '⭐ Shortlisted Notice (shortlisted)' },
                      { value: 'custom', label: '⚡ Custom Response Template (custom)' },
                    ]}
                  />
                </div>

                <Input
                  label="Description / Usage Context"
                  value={editingTpl.description || ''}
                  onChange={e => setEditingTpl({ ...editingTpl, description: e.target.value })}
                  placeholder="e.g. Sent when inviting candidates to technical interview stage"
                />

                <Input
                  label="Subject Line"
                  value={editingTpl.subject}
                  onChange={e => setEditingTpl({ ...editingTpl, subject: e.target.value })}
                  placeholder="Subject line with {{candidate_name}} or {{job_title}}"
                />

                {/* Variable Tags Chip Inserter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Tag size={13} className="text-indigo-600" />
                      Dynamic Variables (Click chip to insert into body):
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Auto-populated dynamically per candidate</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {AVAILABLE_TAGS.map(t => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => handleInsertTagInEditor(t.tag)}
                        className="px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-700 font-mono text-[11px] rounded-lg border border-slate-200 hover:border-indigo-300 transition-all flex items-center gap-1 shadow-2xs group"
                        title={t.desc}
                      >
                        <Plus size={10} className="text-indigo-500 group-hover:scale-125 transition-transform" />
                        <span>{t.tag}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Textarea
                  label="Email Body Content"
                  value={editingTpl.body}
                  onChange={e => setEditingTpl({ ...editingTpl, body: e.target.value })}
                  rows={8}
                />

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTpl.is_active}
                      onChange={e => setEditingTpl({ ...editingTpl, is_active: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Enable automatic trigger for this event
                    </span>
                  </label>
                </div>
              </div>
            ) : (
              /* Live Render Preview in Modal */
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                  <div className="border-b border-slate-100 pb-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Subject Preview:</span>
                    <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                      {renderSampleEmailContent(editingTpl, user).subject}
                    </h3>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Email Body Preview:</span>
                    <div className="mt-2 text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/80 p-3 rounded-lg border border-slate-100">
                      {renderSampleEmailContent(editingTpl, user).body}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Button variant="outline" onClick={() => setEditingTpl(null)}>Cancel</Button>
              <Button
                onClick={() => saveMutation.mutate(editingTpl)}
                loading={saveMutation.isPending}
                disabled={!editingTpl.name || !editingTpl.subject || !editingTpl.body}
                icon={<Save size={14} />}
              >
                Save Template
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Live Inbox Preview Modal */}
      {previewTpl && (
        <Modal
          open={!!previewTpl}
          onClose={() => setPreviewTpl(null)}
          title={`Email Preview: ${previewTpl.name}`}
        >
          <div className="space-y-4 max-w-2xl">
            {/* Inbox Style Frame */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
              {/* Inbox Header */}
              <div className="bg-slate-900 text-white p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-white">CalliQ Candidate Mailer</span>
                  </div>
                  <span>Today at 3:15 PM</span>
                </div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {renderSampleEmailContent(previewTpl, user).subject}
                </h3>
              </div>

              {/* Email Meta */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs space-y-1">
                <p className="text-slate-600"><strong className="text-slate-800">From:</strong> {user?.name || 'CalliQ HR'} &lt;hr@calliq.ai&gt;</p>
                <p className="text-slate-600"><strong className="text-slate-800">To:</strong> Karim Abdelrahman &lt;cillkareem@gmail.com&gt;</p>
              </div>

              {/* Email Rendered Body */}
              <div className="p-6 text-xs text-slate-800 leading-relaxed whitespace-pre-line bg-white min-h-[160px]">
                {renderSampleEmailContent(previewTpl, user).body}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                size="sm"
                variant="outline"
                icon={<Send size={13} />}
                onClick={() => { setTestSendTpl(previewTpl); setPreviewTpl(null); setTestRecipientEmail(user?.email || ''); }}
              >
                Send Test Email
              </Button>

              <Button size="sm" onClick={() => setPreviewTpl(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Test Email Modal */}
      {testSendTpl && (
        <Modal
          open={!!testSendTpl}
          onClose={() => setTestSendTpl(null)}
          title={`Send Test Email: ${testSendTpl.name}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Send a real test email log for <strong>{testSendTpl.name}</strong> to verify formatting and variable tag population.
            </p>

            <Input
              label="Recipient Email Address"
              type="email"
              value={testRecipientEmail}
              onChange={e => setTestRecipientEmail(e.target.value)}
              placeholder="e.g. hr@company.com"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTestSendTpl(null)}>Cancel</Button>
              <Button
                icon={<Send size={14} />}
                loading={testSendMutation.isPending}
                onClick={() => testSendMutation.mutate({
                  template_id: testSendTpl.id,
                  recipient_email: testRecipientEmail,
                })}
              >
                Dispatch Test Email
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <Modal
          open={!!confirmDeleteId}
          onClose={() => setConfirmDeleteId(null)}
          title="Delete Email Template"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs">
              <AlertTriangle size={18} className="shrink-0 text-rose-600" />
              <span>Are you sure you want to delete this template? This action cannot be undone.</span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
              >
                Delete Template
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Defaults Confirmation Modal */}
      {showResetModal && (
        <Modal
          open={showResetModal}
          onClose={() => setShowResetModal(false)}
          title="Restore System Default Templates"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-xs flex items-center gap-3">
              <RotateCcw size={18} className="shrink-0 text-amber-600" />
              <span>
                Restoring defaults will reset all email templates (rejections, interview invitations, offer letters, confirmations) to their original factory settings.
              </span>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowResetModal(false)}>Cancel</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                loading={resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
              >
                Reset to Defaults
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Company Profile Tab ─────────────────────────────────────────────
const PRESET_LOGOS = [
  {
    id: 'apex',
    name: 'Apex Global',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%232563eb"/><path d="M50 20L80 75H20L50 20Z" fill="white" opacity="0.9"/><circle cx="50" cy="55" r="10" fill="%2360a5fa"/></svg>',
  },
  {
    id: 'vertex',
    name: 'Vertex AI',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%237c3aed"/><circle cx="50" cy="50" r="28" stroke="white" stroke-width="8"/><circle cx="50" cy="50" r="12" fill="%23c084fc"/></svg>',
  },
  {
    id: 'nexa',
    name: 'Nexa Talent',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%23059669"/><rect x="25" y="25" width="50" height="50" rx="12" fill="white" opacity="0.9"/><path d="M35 65L50 35L65 65" stroke="%23059669" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  },
  {
    id: 'crown',
    name: 'Crown Talent',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%23d97706"/><path d="M25 68L20 38L38 52L50 28L62 52L80 38L75 68H25Z" fill="white"/></svg>',
  },
  {
    id: 'horizon',
    name: 'Horizon Labs',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%234f46e5"/><path d="M25 40C25 40 40 25 50 25C60 25 75 40 75 40C75 40 60 75 50 75C40 75 25 40 25 40Z" fill="white" opacity="0.95"/></svg>',
  },
  {
    id: 'innovate',
    name: 'Innovate Tech',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%23e11d48"/><path d="M30 30H70V70H30V30Z" fill="white" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="10" fill="%23e11d48"/></svg>',
  },
  {
    id: 'quantum',
    name: 'Quantum HR',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%230f172a"/><circle cx="50" cy="38" r="14" fill="%2338bdf8"/><path d="M26 74C26 60 36 52 50 52C64 52 74 60 74 74H26Z" fill="%2338bdf8"/></svg>',
  },
  {
    id: 'sphere',
    name: 'Sphere Group',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="24" fill="%230891b2"/><circle cx="38" cy="38" r="18" fill="white" opacity="0.9"/><circle cx="62" cy="62" r="18" fill="white" opacity="0.6"/></svg>',
  },
];

function CompanyProfileTab() {
  const { user, updateUser } = useAuthStore();
  const qc = useQueryClient();
  const toast = useToast();

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  const { data: teamUsers = [] } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: () => usersApi.list(),
    enabled: isAdmin,
  });

  const [selectedUserId, setSelectedUserId] = useState<number>(user?.id || 1);
  const [orgName, setOrgName] = useState(user?.org_name || '');
  const [companyLogo, setCompanyLogo] = useState(user?.company_logo || '');
  const [companyTagline, setCompanyTagline] = useState(user?.company_tagline || '');
  const [companyWebsite, setCompanyWebsite] = useState(user?.company_website || '');
  const [primaryColor, setPrimaryColor] = useState(user?.primary_color || '#4f46e5');

  const selectedUser = teamUsers.find((u) => u.id === selectedUserId) || user;

  useEffect(() => {
    if (selectedUser) {
      setOrgName(selectedUser.org_name || '');
      setCompanyLogo(selectedUser.company_logo || '');
      setCompanyTagline(selectedUser.company_tagline || '');
      setCompanyWebsite(selectedUser.company_website || '');
      setPrimaryColor(selectedUser.primary_color || '#4f46e5');
    }
  }, [selectedUserId, selectedUser?.id, selectedUser?.org_name, selectedUser?.company_logo]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast('حجم الملف كبير جداً، يرجى اختيار شعار أقل من 2 ميجابايت', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setCompanyLogo(result);
      toast('تم اختيار الشعار بنجاح! انقر "حفظ ملف الشركة" للتفعيل النهائي', 'success');
    };
    reader.readAsDataURL(file);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedUserId === user?.id) {
        return usersApi.updateCompanyProfile({
          org_name: orgName,
          company_logo: companyLogo,
          company_tagline: companyTagline,
          company_website: companyWebsite,
          primary_color: primaryColor,
        });
      } else {
        return usersApi.update(selectedUserId, {
          org_name: orgName,
          company_logo: companyLogo,
          company_tagline: companyTagline,
          company_website: companyWebsite,
          primary_color: primaryColor,
        });
      }
    },
    onSuccess: (updatedUser) => {
      if (selectedUserId === user?.id || updatedUser.org_id === user?.org_id) {
        updateUser({
          org_name: updatedUser.org_name,
          company_logo: updatedUser.company_logo,
          company_tagline: updatedUser.company_tagline,
          company_website: updatedUser.company_website,
          primary_color: updatedUser.primary_color,
        });
      }
      qc.invalidateQueries({ queryKey: ['team'] });
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['admin-jobs-list'] });
      qc.invalidateQueries({ queryKey: ['apply-job'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast(`تم حفظ وتحديث ملف الشركة وهويتها البصرية وتطبيقها فورياً على جميع الوظائف والإيميلات والروابط العامة!`, 'success');
    },
    onError: (err: any) => {
      toast(err?.response?.data?.detail || 'فشل حفظ ملف الشركة', 'error');
    },
  });

  return (
    <div className="space-y-6">
      {/* Target Account Selector for Admin */}
      {isAdmin && teamUsers.length > 1 && (
        <div className="bg-indigo-50/90 border border-indigo-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Building2 size={20} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">التحكم في شعارات وهويات جميع حسابات HR والشركات</span>
              <span className="text-[11px] text-slate-600 block">بصفتك المسؤول (Admin)، اختر الحساب الذي تريد تعديل اسمه وشعاره وهويته البصرية:</span>
            </div>
          </div>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
            className="px-3.5 py-2 text-xs font-bold bg-white border border-indigo-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs w-full sm:w-auto"
          >
            {teamUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.org_name || u.name} — ({u.email})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Intro Header */}
      <div className="bg-white text-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-100">
            <Building2 size={13} />
            <span>تخصيص الهوية والشعار لحساب: {selectedUser?.org_name || selectedUser?.name || 'الشركة'}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">ملف الشركة واللوجو (Company Profile & Logo)</h2>
          <p className="text-xs text-slate-500">
            رفع شعار الشركة، تخصيص الاسم والهوية - تتحدث تلقائياً في شريط النظام العلوي، لوحة التحكم، وقوالب إيميلات المرشحين ورابط التقديم العام.
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          icon={<Save size={15} />}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs self-start sm:self-auto cursor-pointer"
        >
          حفظ ملف الشركة
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Controls Left */}
        <div className="lg:col-span-7 space-y-6">
          {/* Logo Selection & Upload Card */}
          <Card>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Image size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">شعار الشركة (Company Logo)</h3>
                  <p className="text-xs text-slate-500">اختر شعاراً من النماذج الجاهزة أو قم برفع شعارك الخاص</p>
                </div>
              </div>
              {companyLogo && (
                <button
                  type="button"
                  onClick={() => {
                    setCompanyLogo('');
                    toast('تمت إزالة الشعار الحالي', 'info');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2.5 py-1 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                >
                  حذف الشعار
                </button>
              )}
            </div>

            {/* Current Active Logo */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {companyLogo ? (
                  <img
                    src={companyLogo}
                    alt="Active Logo"
                    className="w-14 h-14 rounded-xl object-contain bg-white p-1.5 border border-slate-200 shadow-xs"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-lg border border-slate-300">
                    <Building2 size={24} />
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    {companyLogo ? 'الشعار الحالي النشط' : 'لم يتم تحديد شعار بعد'}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {companyLogo ? 'يظهر هذا الشعار للمرشحين وفي واجهات النظام' : 'اختر شعاراً أدناه لتمييز حسابك'}
                  </span>
                </div>
              </div>

              {/* Upload button */}
              <label className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors">
                <Upload size={14} className="text-indigo-600" />
                <span>رفع شعار جديد</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Preset Logos Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 mb-2.5 block flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                معرض الشعارات الاحترافية السريعة (Preset Logos):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PRESET_LOGOS.map((preset) => {
                  const isSelected = companyLogo === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setCompanyLogo(preset.url);
                        toast(`تم اختيار شعار ${preset.name}`, 'success');
                      }}
                      className={`p-3 rounded-xl border text-right flex items-center gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/30'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-slate-200 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-bold text-slate-800 block truncate">{preset.name}</span>
                        {isSelected && (
                          <span className="text-[10px] text-indigo-600 font-extrabold flex items-center gap-0.5">
                            <Check size={10} /> نشط
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Company Text Info Card */}
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Building2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">بيانات الشركة ومساحة العمل</h3>
                <p className="text-xs text-slate-500">اسم الشركة، الشعار النصي، والرابط الرسمي</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <Input
                label="اسم الشركة / المؤسسة (Company Name)"
                placeholder="مثال: شركة النجم للتكنولوجيا"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                hint="يظهر هذا الاسم في هيدر لوحة التحكم، الإيميلات المرسلة للمرشحين، وعقود التوظيف"
              />

              <Input
                label="الوصف المختصر / Tagline"
                placeholder="مثال: Leading Tech & AI Talent Solutions"
                value={companyTagline}
                onChange={(e) => setCompanyTagline(e.target.value)}
                hint="شعار مختصر يظهر أسفل اسم الشركة"
              />

              <Input
                label="موقع الشركة الإلكتروني (Company Website)"
                placeholder="https://mycompany.com"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                hint="يتم تضمينه تلقائياً في التوقيع الرقمي لإيميلات التوظيف"
              />
            </div>
          </Card>
        </div>

        {/* Live Previews Right */}
        <div className="lg:col-span-5 space-y-5">
          {/* Header Preview Box */}
          <Card>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Eye size={14} className="text-indigo-600" />
                معاينة هيدر لوحة التحكم (Dashboard View)
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                مباشر
              </span>
            </div>

            <div className="p-4 bg-slate-50 text-slate-900 rounded-xl shadow-xs border border-slate-200 space-y-3">
              <div className="flex items-center gap-3">
                {companyLogo ? (
                  <img
                    src={companyLogo}
                    alt=""
                    className="w-10 h-10 rounded-lg object-contain bg-white p-1 border border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
                    {orgName ? orgName.charAt(0) : 'C'}
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="text-sm font-bold truncate text-slate-900">{orgName || 'CalliQ HR Workspace'}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{companyTagline || 'منصة التوظيف الذكية'}</p>
                </div>
              </div>
              <div className="text-[11px] text-indigo-700 bg-white px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center justify-between font-medium shadow-2xs">
                <span>Good afternoon, Mohamed!</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </div>
          </Card>

          {/* Candidate Email Preview Box */}
          <Card>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Mail size={14} className="text-blue-600" />
                معاينة هيدر الإيميل للمرشحين (Candidate Email Header)
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                تأثير فوري
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-xs">
              {/* Email Top bar */}
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span>From: careers@{orgName ? orgName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'company'}.com</span>
                <span>إشعار رسمي</span>
              </div>

              {/* Email Body Header */}
              <div className="p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    {companyLogo ? (
                      <img
                        src={companyLogo}
                        alt=""
                        className="w-9 h-9 rounded-lg object-contain bg-slate-50 p-1 border border-slate-200"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                        {orgName ? orgName.charAt(0) : 'C'}
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-slate-800 block text-xs">{orgName || 'CalliQ ATS'}</span>
                      <span className="text-[10px] text-slate-400 block">{companyTagline || 'Talent Acquisition'}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold">
                    دعوة مقابلة
                  </span>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600 text-[11px] leading-relaxed">
                  مرحباً كريم، يسعدنا دعوتك لمقابلة عمل في شركة <strong>{orgName || 'الشركة'}</strong> لمناقشة دور مهندس البرمجيات.
                </div>

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                  مع تحيات فريق التوظيف في {orgName || 'CalliQ'} • {companyWebsite || 'https://company.com'}
                </div>
              </div>
            </div>
          </Card>

          {/* Action Save Button Sticky Footer */}
          <div className="pt-2">
            <Button
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              icon={<Save size={16} />}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 rounded-xl shadow-md cursor-pointer justify-center"
            >
              {saveMutation.isPending ? 'جاري حفظ التغييرات...' : 'حفظ ملف الشركة وتحديث اللوجو الآن'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Account Tab ─────────────────────────────────────────────────────
function AccountTab() {
  const { user } = useAuthStore();
  return (
    <Card className="max-w-lg">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
          {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div>
          <p className="font-semibold text-slate-800">{user?.name}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
        </div>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between py-2 border-b border-slate-100">
          <span className="text-slate-500">Organization</span>
          <span className="font-medium text-slate-700">{user?.org_name || '—'}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-slate-100">
          <span className="text-slate-500">Role</span>
          <Badge className="bg-blue-100 text-blue-700 capitalize">{user?.role}</Badge>
        </div>
      </div>
    </Card>
  );
}

export function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const [tab, setTab] = useState(0);

  const tabsList = [
    ...(isAdmin ? [{ label: 'ملف الشركة واللوجو (Admin Only)', icon: <Building2 size={14} /> }] : []),
    { label: 'فريق العمل (Team)', icon: <Users size={14} /> },
    { label: 'قوالب البريد (Email Templates)', icon: <Send size={14} /> },
    { label: 'الويب هوك (Webhooks)', icon: <Webhook size={14} /> },
    { label: 'الحساب الشخصي (Account)', icon: <UserCog size={14} /> },
  ];

  return (
    <Layout>
      <PageHeader
        title="الإعدادات"
        subtitle={
          isAdmin
            ? "تخصيص ملف الشركة واللوجو، فريق العمل، القوالب البريدية، الويب هوك، والحساب الشخصي"
            : "إدارة فريق العمل، القوالب البريدية، الويب هوك، والحساب الشخصي"
        }
      />

      <Tabs
        tabs={tabsList}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {isAdmin ? (
          <>
            {tab === 0 && <CompanyProfileTab />}
            {tab === 1 && <TeamTab />}
            {tab === 2 && <EmailTemplatesTab />}
            {tab === 3 && <WebhooksTab />}
            {tab === 4 && <AccountTab />}
          </>
        ) : (
          <>
            {tab === 0 && <TeamTab />}
            {tab === 1 && <EmailTemplatesTab />}
            {tab === 2 && <WebhooksTab />}
            {tab === 3 && <AccountTab />}
          </>
        )}
      </div>
    </Layout>
  );
}

