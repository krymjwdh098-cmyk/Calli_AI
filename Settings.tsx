import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Webhook, Plus, Trash2, Send, Copy, Check,
  UserCog, Shield, Zap, Eye, EyeOff, Sparkles,
  Database, Activity, Server, CheckCircle2, AlertCircle, RefreshCw,
  Globe, Code, Terminal,
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
  { value: 'admin', label: 'Admin' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'viewer', label: 'Viewer' },
];

// ── Team Tab ────────────────────────────────────────────────────────
function InviteUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'recruiter',
    create_isolated_workspace: true,
    org_name: '',
  });

  const mutation = useMutation({
    mutationFn: () => usersApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast('HR user account created successfully with assigned workspace', 'success');
      onClose();
      setForm({ name: '', email: '', password: '', role: 'recruiter', create_isolated_workspace: true, org_name: '' });
    },
    onError: (e: any) => toast(e?.response?.data?.detail || 'Failed to add member', 'error'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Add New User Account (Admin Only)">
      <div className="space-y-4">
        <Input
          label="Full name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Sarah Jenkins"
          required
        />
        <Input
          label="Email address"
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="recruiter@company.com"
          required
        />
        <Input
          label="Login password"
          type="text"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          hint="At least 6 characters"
          placeholder="pass1234"
          required
        />
        <Select
          label="System Role"
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
            <span className="text-xs font-semibold text-slate-700">Create separate isolated workspace for this HR user</span>
          </label>
          <p className="text-[11px] text-slate-500 pl-5">
            When enabled, this HR recruiter will have their own private jobs, candidates, and pipeline without interference.
          </p>

          {form.create_isolated_workspace && (
            <div className="pt-2">
              <Input
                label="Workspace / Company Name (Optional)"
                value={form.org_name}
                onChange={e => setForm(f => ({ ...f, org_name: e.target.value }))}
                placeholder="e.g. Middle East Talent Acquisition"
              />
            </div>
          )}
        </div>

        <Button className="w-full justify-center" onClick={() => mutation.mutate()} loading={mutation.isPending}>
          Create User Account
        </Button>
      </div>
    </Modal>
  );
}

function TeamTab() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: team = [], isLoading } = useQuery({ queryKey: ['team'], queryFn: usersApi.list });

  const toggleActiveMutation = useMutation({
    mutationFn: (u: TeamUser) => usersApi.update(u.id, { is_active: !u.is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); toast('Member updated', 'success'); },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => usersApi.update(id, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); toast('Role updated', 'success'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); toast('Member removed', 'success'); },
    onError: (e: any) => toast(e?.response?.data?.detail || 'Failed to remove member', 'error'),
  });

  const canManage = user?.role === 'admin' || user?.role === 'owner';

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex items-center justify-between bg-purple-50 border border-purple-200 p-4 rounded-xl">
          <div>
            <h3 className="text-sm font-bold text-purple-950 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
              Administrator User Management
            </h3>
            <p className="text-xs text-purple-700 mt-0.5">
              You have full administrative privileges to add HR recruiters, manage roles, and provision separate workspaces.
            </p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => setInviteOpen(true)}>Add User</Button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
          <p className="text-xs text-slate-600">
            <strong>Logged in as:</strong> {user?.name} ({user?.role?.toUpperCase()}) — Workspace: <em>{user?.org_name || 'Standard Workspace'}</em>. Team user addition is managed by the System Administrator.
          </p>
        </div>
      )}

      <Card padding={false}>
        {isLoading ? (
          <div className="p-4 space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {team.map((m: any) => (
              <div key={m.id} className="flex items-center gap-4 p-4">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  m.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                    {m.id === user?.id && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">You</span>}
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
                    className="!py-1.5 text-xs w-32"
                  />
                ) : (
                  <Badge className={m.role === 'admin' ? 'bg-purple-100 text-purple-700 font-semibold capitalize' : 'bg-emerald-100 text-emerald-700 capitalize'}>
                    {m.role}
                  </Badge>
                )}
                <Badge className={m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                  {m.is_active ? 'Active' : 'Disabled'}
                </Badge>
                {canManage && m.id !== user?.id && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleActiveMutation.mutate(m)}>
                      {m.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(m.id)}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
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

// ── Email Templates Tab ─────────────────────────────────────────────
function EmailTemplatesTab() {
  const toast = useToast();
  const qc = useQueryClient();
  const [editingTpl, setEditingTpl] = useState<any>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => emailsApi.getTemplates(),
  });

  const updateMutation = useMutation({
    mutationFn: (tpl: any) => emailsApi.updateTemplate(tpl),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      toast('Email template updated successfully!', 'success');
      setEditingTpl(null);
    },
    onError: () => toast('Failed to update email template', 'error'),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Send size={16} className="text-blue-600" />
              Automated Candidate Email Templates
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configure automated email notifications sent to candidates when they apply, get shortlisted, schedule interviews, or receive offers.
            </p>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates?.map(t => (
              <div key={t.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">{t.name}</span>
                    <Badge className={t.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}>
                      {t.is_active ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Subject: {t.subject}</p>
                  <p className="text-xs text-slate-500 line-clamp-3 bg-white p-2 rounded border border-slate-100 whitespace-pre-line">
                    {t.body}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono">Event: {t.event}</span>
                  <Button size="sm" variant="outline" onClick={() => setEditingTpl(t)}>
                    Edit Template
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editingTpl && (
        <Modal open={!!editingTpl} onClose={() => setEditingTpl(null)} title={`Edit ${editingTpl.name}`}>
          <div className="space-y-4">
            <Input
              label="Template Name"
              value={editingTpl.name}
              onChange={e => setEditingTpl({ ...editingTpl, name: e.target.value })}
            />
            <Input
              label="Subject Line"
              value={editingTpl.subject}
              onChange={e => setEditingTpl({ ...editingTpl, subject: e.target.value })}
              hint="Available tags: {{candidate_name}}, {{job_title}}, {{company_name}}"
            />
            <Textarea
              label="Email Body"
              value={editingTpl.body}
              onChange={e => setEditingTpl({ ...editingTpl, body: e.target.value })}
              rows={6}
              hint="Available tags: {{candidate_name}}, {{job_title}}, {{company_name}}, {{interview_date}}, {{interview_link}}, {{offer_amount}}"
            />
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={editingTpl.is_active}
                onChange={e => setEditingTpl({ ...editingTpl, is_active: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span className="text-xs text-slate-700">Enable automatic sending for this event</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingTpl(null)}>Cancel</Button>
              <Button
                onClick={() => updateMutation.mutate(editingTpl)}
                loading={updateMutation.isPending}
              >
                Save Template
              </Button>
            </div>
          </div>
        </Modal>
      )}
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
  const [tab, setTab] = useState(0);

  return (
    <Layout>
      <PageHeader title="Settings" subtitle="Manage your team, database, email templates, AI engine, webhooks, and workspace" />

      <Tabs
        tabs={[
          { label: 'Team', icon: <Users size={14} /> },
          { label: 'Database', icon: <Database size={14} /> },
          { label: 'Email Templates', icon: <Send size={14} /> },
          { label: 'AI Engine', icon: <Sparkles size={14} /> },
          { label: 'Webhooks', icon: <Webhook size={14} /> },
          { label: 'Account', icon: <UserCog size={14} /> },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-5">
        {tab === 0 && <TeamTab />}
        {tab === 1 && <DatabaseTab />}
        {tab === 2 && <EmailTemplatesTab />}
        {tab === 3 && <AIEngineTab />}
        {tab === 4 && <WebhooksTab />}
        {tab === 5 && <AccountTab />}
      </div>
    </Layout>
  );
}

