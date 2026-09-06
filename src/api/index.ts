import { api } from './client';
import type {
  User, Job, JobCreate, KnockoutRule,
  Candidate, CandidateBatch, Paginated, DashboardStats, PipelineAnalytics,
  BatchJob, TimelineEvent, WebhookEndpoint, WebhookDelivery,
  TeamUser, TimeToHireReport, TokenResponse, EmailLog, EmailTemplate,
} from '../types';

const V1 = '/api/v1';

// ── Auth ──────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    return api.post<TokenResponse>(`${V1}/auth/login`, {
      username: cleanEmail,
      email: cleanEmail,
      password: cleanPassword,
    }).then(r => r.data);
  },

  register: (data: { email: string; password: string; name: string; org_name: string }) =>
    api.post<TokenResponse>(`${V1}/auth/register`, data).then(r => r.data),

  me: () => api.get<User>(`${V1}/auth/me`).then(r => r.data),

  forgotPassword: (email: string) =>
    api.post(`${V1}/auth/forgot-password`, { email }).then(r => r.data),

  resetPassword: (token: string, new_password: string) =>
    api.post(`${V1}/auth/reset-password`, { token, new_password }).then(r => r.data),
};

// ── Jobs ──────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (active_only?: boolean) =>
    api.get<Job[]>(`${V1}/jobs/`, { params: active_only ? { active_only: true } : {} }).then(r => r.data),

  get: (id: number) => api.get<Job>(`${V1}/jobs/${id}`).then(r => r.data),

  create: (data: JobCreate) => api.post<Job>(`${V1}/jobs/`, data).then(r => r.data),

  update: (id: number, data: Partial<JobCreate & { is_active: boolean }>) =>
    api.patch<Job>(`${V1}/jobs/${id}`, data).then(r => r.data),

  delete: (id: number) => api.delete(`${V1}/jobs/${id}`),

  toggleActive: (id: number) =>
    api.patch<{ is_active: boolean }>(`${V1}/jobs/${id}/toggle-active`).then(r => r.data),

  getQR: (id: number) =>
    api.get<{ qr_base64: string; apply_url: string }>(`${V1}/jobs/${id}/qr`).then(r => r.data),

  getRankings: (id: number, limit = 50) =>
    api.get(`${V1}/jobs/${id}/rankings`, { params: { limit } }).then(r => r.data),

  getCandidates: (id: number, params?: Record<string, unknown>) =>
    api.get<Paginated<Candidate>>(`${V1}/jobs/${id}/candidates`, { params }).then(r => r.data),

  listKnockoutRules: (jobId: number) =>
    api.get<KnockoutRule[]>(`${V1}/jobs/${jobId}/knockout-rules`).then(r => r.data),

  addKnockoutRule: (jobId: number, data: Partial<KnockoutRule>) =>
    api.post(`${V1}/jobs/${jobId}/knockout-rules`, data).then(r => r.data),

  deleteKnockoutRule: (jobId: number, ruleId: number) =>
    api.delete(`${V1}/jobs/${jobId}/knockout-rules/${ruleId}`),
};

// ── Candidates ────────────────────────────────────────────────────────
export const candidatesApi = {
  list: (params?: {
    job_id?: number; batch_id?: number | string; status?: string; category?: string;
    min_score?: number; source?: string; search?: string;
    page?: number; page_size?: number; sort_by?: string;
  }) => api.get<Paginated<Candidate>>(`${V1}/candidates/`, { params }).then(r => r.data),

  get: (id: number) => api.get<Candidate>(`${V1}/candidates/${id}`).then(r => r.data),

  upload: (formData: FormData) =>
    api.post<Candidate>(`${V1}/candidates/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  bulkUpload: (formData: FormData) =>
    api.post(`${V1}/candidates/bulk-upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),

  getBatchStatus: (batchId: number) =>
    api.get<BatchJob>(`${V1}/candidates/batches/${batchId}`).then(r => r.data),

  listBatches: (params?: { job_id?: number }) => api.get<CandidateBatch[]>(`${V1}/candidates/batches`, { params }).then(r => r.data),
  createBatch: (data: { name: string; description?: string; job_id?: number }) =>
    api.post<CandidateBatch>(`${V1}/candidates/batches`, data).then(r => r.data),
  deleteBatch: (id: number) =>
    api.delete<{ message: string; id: number; deleted_candidates_count: number }>(`${V1}/candidates/batches/${id}`).then(r => r.data),
  clearBatch: (id: number) =>
    api.post<{ message: string; id: number; cleared_candidates_count: number }>(`${V1}/candidates/batches/${id}/clear`).then(r => r.data),
  clearAll: (params?: { batch_id?: number | string; job_id?: number }) =>
    api.post<{ message: string; deleted_count: number }>(`${V1}/candidates/clear-all`, params || {}).then(r => r.data),


  decide: (id: number, decision: string, notes?: string) =>
    api.post(`${V1}/candidates/${id}/decide`, { decision, notes }).then(r => r.data),

  approve: (id: number, notes?: string) =>
    api.post(`${V1}/candidates/${id}/approve`, null, { params: notes ? { notes } : {} }).then(r => r.data),

  reject: (id: number, notes?: string) =>
    api.post(`${V1}/candidates/${id}/reject`, null, { params: notes ? { notes } : {} }).then(r => r.data),

  shortlist: (id: number, notes?: string) =>
    api.post(`${V1}/candidates/${id}/shortlist`, null, { params: notes ? { notes } : {} }).then(r => r.data),

  pipelineMove: (id: number, stage: string, notes?: string) =>
    api.post(`${V1}/candidates/${id}/pipeline-move`, { stage, notes }).then(r => r.data),

  scheduleInterview: (id: number, data: {
    scheduled_at: string; interview_type: string;
    location?: string; link?: string; duration_mins?: number; notes?: string;
  }) => api.post(`${V1}/candidates/${id}/schedule-interview`, data).then(r => r.data),

  sendOffer: (id: number, data: { amount: number; currency: string; deadline_days: number; notes?: string }) =>
    api.post(`${V1}/candidates/${id}/send-offer`, data).then(r => r.data),

  offerResponse: (id: number, accepted: boolean) =>
    api.post(`${V1}/candidates/${id}/offer-response`, null, { params: { accepted } }).then(r => r.data),

  getTimeline: (id: number) =>
    api.get<{ timeline: TimelineEvent[]; pipeline_history: unknown[] }>(`${V1}/candidates/${id}/timeline`).then(r => r.data),

  chat: (id: number, message: string) =>
    api.post<{ reply: string; history_length: number }>(`${V1}/candidates/${id}/chat`, { message }).then(r => r.data),

  sendWhatsApp: (id: number, action: string, custom_message?: string) =>
    api.post(`${V1}/candidates/${id}/whatsapp`, { action, custom_message }).then(r => r.data),

  downloadCV: (id: number) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    return `/api/v1/candidates/${id}/download?token=${token}`;
  },

  updateStatus: (id: number, status: string, notes?: string) =>
    api.patch<Candidate>(`${V1}/candidates/${id}/status`, { status, notes }).then(r => r.data),

  delete: (id: number) =>
    api.delete<{ message: string; id: number }>(`${V1}/candidates/${id}`).then(r => r.data),

  reprocess: (id: number) => api.post(`${V1}/candidates/${id}/reprocess`).then(r => r.data),

  reEvaluate: (id: number) => api.post<Candidate>(`${V1}/candidates/${id}/re-evaluate`).then(r => r.data),

  reEvaluateAll: () => api.post<{ message: string; count: number }>(`${V1}/candidates/re-evaluate-all`).then(r => r.data),
  
  syncToNotion: (id: number) => api.post(`${V1}/candidates/${id}/sync-notion`).then(r => r.data),

  analyzeCv: (formData: FormData) => api.post<{ filename: string; extracted_text: string; analysis: any }>(`${V1}/candidates/analyze-cv`, formData).then(r => r.data),

  getProcessingStatus: (id: number) =>
    api.get(`${V1}/candidates/${id}/processing-status`).then(r => r.data),

  flag: (id: number, reason: string) =>
    api.patch(`${V1}/candidates/${id}/flag`, null, { params: { reason } }).then(r => r.data),

  unflag: (id: number) => api.patch(`${V1}/candidates/${id}/unflag`).then(r => r.data),
};

// ── Emails ────────────────────────────────────────────────────────────
export const emailsApi = {
  list: (params?: { candidate_id?: number }) =>
    api.get<EmailLog[]>(`${V1}/emails`, { params }).then(r => r.data),
  send: (data: { candidate_id?: number; recipient_email?: string; recipient_name?: string; subject: string; body: string; trigger_event?: string }) =>
    api.post<EmailLog>(`${V1}/emails/send`, data).then(r => r.data),
  draft: (data: { candidate_id?: number; type?: string; language?: string; instructions?: string }) =>
    api.post<{ subject: string; body: string }>(`${V1}/emails/draft`, data).then(r => r.data),
  deleteLog: (id: number) =>
    api.delete(`${V1}/emails/${id}`).then(r => r.data),
  getTemplates: () =>
    api.get<EmailTemplate[]>(`${V1}/emails/templates`).then(r => r.data),
  updateTemplate: (data: Partial<EmailTemplate>) =>
    api.post<EmailTemplate>(`${V1}/emails/templates`, data).then(r => r.data),
};

// ── Dashboard ─────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => api.get<DashboardStats>(`${V1}/dashboard/stats`).then(r => r.data),
  pipelineAnalytics: () => api.get<PipelineAnalytics>(`${V1}/dashboard/pipeline-analytics`).then(r => r.data),
  timeToHire: (days_back = 90) =>
    api.get<TimeToHireReport>(`${V1}/dashboard/time-to-hire`, { params: { days_back } }).then(r => r.data),
  aiConfig: () => api.get(`${V1}/dashboard/ai-config`).then(r => r.data),
  auditLog: (params?: Record<string, unknown>) =>
    api.get(`${V1}/dashboard/audit-log`, { params }).then(r => r.data),
};

// ── Users ─────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get<TeamUser[]>(`${V1}/users`).then(r => r.data),
  create: (data: { name: string; email: string; password: string; role: string; create_isolated_workspace?: boolean; org_name?: string }) =>
    api.post<TeamUser>(`${V1}/users`, data).then(r => r.data),
  update: (id: number, data: Partial<TeamUser & { password: string; org_name: string }>) =>
    api.patch<TeamUser>(`${V1}/users/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`${V1}/users/${id}`),
};

// ── Apply (public) ────────────────────────────────────────────────────
export const applyApi = {
  getJob: (token: string) => api.get(`${V1}/apply/${token}`).then(r => r.data),
  submit: (token: string, formData: FormData) =>
    api.post(`${V1}/apply/${token}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),
};

// ── Webhooks ──────────────────────────────────────────────────────────
export const webhooksApi = {
  listEndpoints: () =>
    api.get<WebhookEndpoint[]>(`${V1}/webhooks/endpoints`).then(r => r.data),
  createEndpoint: (data: { url: string; events: string[]; description?: string }) =>
    api.post(`${V1}/webhooks/endpoints`, data).then(r => r.data),
  updateEndpoint: (id: number, data: Partial<WebhookEndpoint>) =>
    api.patch(`${V1}/webhooks/endpoints/${id}`, data).then(r => r.data),
  deleteEndpoint: (id: number) => api.delete(`${V1}/webhooks/endpoints/${id}`),
  testEndpoint: (id: number) =>
    api.post(`${V1}/webhooks/endpoints/${id}/test`).then(r => r.data),
  getDeliveries: (id: number) =>
    api.get<WebhookDelivery[]>(`${V1}/webhooks/endpoints/${id}/deliveries`).then(r => r.data),
  listEvents: () => api.get<{ events: string[] }>(`${V1}/webhooks/events`).then(r => r.data),
};

// ── Settings & AI Engine Configuration ────────────────────────────────
export const settingsApi = {
  getAI: () =>
    api.get<{ has_groq_key: boolean; has_gemini_key: boolean; groq_key_preview: string; primary_engine: string }>(`${V1}/settings/ai`).then(r => r.data),
  updateAI: (data: { groq_api_key: string }) =>
    api.post(`${V1}/settings/ai`, data).then(r => r.data),
  clearWorkspace: () =>
    api.post<{ message: string }>(`${V1}/settings/clear-workspace`).then(r => r.data),
  testDbConnection: () =>
    api.get<{
      connected: boolean;
      configured: boolean;
      message: string;
      details?: {
        latency_ms?: number;
        server_time?: string;
        db_name?: string;
        version?: string;
        db_url_masked?: string;
      };
    }>(`${V1}/settings/test-db`).then(r => r.data),
};
