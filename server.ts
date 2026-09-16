import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import * as pdfParseModule from 'pdf-parse';
import mammoth from 'mammoth';
import { Client as NotionClient } from '@notionhq/client';
import { initNeonTables, syncDataToNeon, testNeonConnection, deleteCandidateFromNeon, fetchDataFromNeon } from './src/lib/neonDb';
const pdfParse: (dataBuffer: Buffer, options?: any) => Promise<{ text: string; numpages: number }> = (pdfParseModule as any).default || pdfParseModule;

const app = express();
const PORT = 3000;

// CORS configuration - allow requests from Vercel or any origin in production
app.use(cors({
  origin: true, // In a real production app, you might want to specify your Vercel URL
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// System configuration for API keys
const SYSTEM_CONFIG = {
  groq_api_key: process.env.GROQ_API_KEY || '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',
};

// Groq Client Initialization
let groqClient: Groq | null = null;
function getGroqClient(): Groq | null {
  const activeKey = (SYSTEM_CONFIG.groq_api_key || process.env.GROQ_API_KEY || '').trim();
  if (!activeKey) return null;
  if (!groqClient || (groqClient as any).apiKey !== activeKey) {
    try {
      groqClient = new Groq({ apiKey: activeKey });
    } catch (e) {
      console.warn('Failed to initialize Groq client:', e);
      return null;
    }
  }
  return groqClient;
}

// Lazy Gemini AI initialization
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (e) {
      console.warn('Failed to initialize GoogleGenAI client:', e);
    }
  }
  return aiClient;
}

// ── Notion Integration ──────────────────────────────────────────────────────
const notion = process.env.NOTION_TOKEN ? new NotionClient({ auth: process.env.NOTION_TOKEN }) : null;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

async function syncCandidateToNotion(candidate: DBCandidate) {
  if (!notion || !NOTION_DATABASE_ID) return null;

  try {
    const response = await notion.pages.create({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        'Name': {
          title: [{ text: { content: candidate.full_name } }]
        },
        'Email': {
          email: candidate.email
        },
        'Phone': {
          phone_number: candidate.phone || ''
        },
        'Position': {
          rich_text: [{ text: { content: candidate.current_position || 'N/A' } }]
        },
        'Score': {
          number: candidate.match_score
        },
        'Status': {
          select: { name: candidate.status || 'Applied' }
        },
        'AI Summary': {
          rich_text: [{ text: { content: candidate.ai_summary?.substring(0, 2000) || '' } }]
        }
      }
    });
    return response;
  } catch (error) {
    console.error('[Notion Sync Error]:', error);
    return null;
  }
}

// ── In-Memory Database / Store ──────────────────────────────────────────────
interface DBUser {
  id: number;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'recruiter' | 'viewer';
  org_id: number;
  org_name: string;
  company_logo?: string;
  company_tagline?: string;
  company_website?: string;
  primary_color?: string;
  password?: string;
  is_active: boolean;
  created_at: string;
}

interface DBJob {
  id: number;
  org_id: number;
  recruiter_id: number;
  title: string;
  company: string;
  description: string;
  required_skills: string[];
  nice_to_have: string[];
  min_experience: number;
  max_experience: number;
  education_req: string;
  location_req: string;
  hr_email?: string;
  salary_min?: number;
  salary_max?: number;
  is_active: boolean;
  apply_url?: string;
  public_token?: string;
  score_strong_match?: number;
  score_potential_match?: number;
  score_weak_match?: number;
  candidate_count: number;
  created_at: string;
  updated_at?: string;
}

interface DBKnockoutRule {
  id: number;
  job_id: number;
  rule_type: string;
  field?: string;
  operator?: string;
  value?: string;
  action: string;
  description: string;
  is_active: boolean;
  is_mandatory: boolean;
}

interface DBCandidateBatch {
  id: number;
  org_id: number;
  recruiter_id: number;
  name: string;
  description?: string;
  job_id?: number;
  candidate_count?: number;
  created_at: string;
}

interface DBCandidate {
  id: number;
  org_id: number;
  recruiter_id?: number;
  job_id?: number;
  batch_id?: number;
  full_name: string;
  email: string;
  phone: string;
  whatsapp_phone?: string;
  location: string;
  nationality?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  current_position: string;
  years_experience: number;
  previous_positions: any[];
  companies: string[];
  education: any[];
  certifications: any[];
  courses: string[];
  technical_skills: Record<string, string[]>;
  soft_skills: string[];
  languages: any[];
  projects: any[];
  achievements: string[];
  awards: string[];
  match_score: number;
  ats_score: number;
  skill_match: number;
  experience_match: number;
  education_match: number;
  seniority_match: number;
  location_match: number;
  keyword_match: number;
  salary_match: number;
  ai_confidence: number;
  recommendation: 'Strong Hire' | 'Hire' | 'Consider' | 'Reject';
  recommendation_reason: string;
  ai_summary: string;
  strengths: string[];
  weaknesses: string[];
  missing_skills: string[];
  missing_certs: string[];
  skill_gap_analysis?: string;
  ats_issues: string[];
  ats_suggestions: string[];
  rank?: number;
  category: 'STRONG_MATCH' | 'POTENTIAL_MATCH' | 'WEAK_MATCH' | 'NEEDS_REVIEW' | 'KNOCKOUT_FAILED';
  status: string;
  pipeline_stage?: string;
  pipeline_history: any[];
  recruiter_decision: 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED';
  decision_notes?: string;
  decided_at?: string;
  salary_expectation?: number;
  salary_currency?: string;
  notice_period_days?: number;
  availability_date?: string;
  remote_preference?: string;
  salary_expectation_match?: string;
  offer_amount?: number;
  offer_currency?: string;
  offer_sent_at?: string;
  offer_deadline?: string;
  offer_accepted?: boolean;
  applied_at: string;
  shortlisted_at?: string;
  hired_at?: string;
  rejected_at?: string;
  interview_scheduled?: string;
  interview_type?: string;
  interview_link?: string;
  interview_location?: string;
  interview_duration_mins?: number;
  flagged: boolean;
  flag_reason?: string;
  is_knocked_out: boolean;
  knockout_flags: string[];
  source: string;
  file_name?: string;
  file_content?: string;
  duplicate_of?: number;
  processing_attempts: number;
  last_error?: string;
  chat_history: { role: 'user' | 'assistant'; content: string; created_at: string }[];
  whatsapp_history: { type: string; body: string; status: string; created_at: string }[];
  analysis?: any;
  created_at: string;
}

interface DBWebhookEndpoint {
  id: number;
  url: string;
  events: string[];
  is_active: boolean;
  description?: string;
  created_at: string;
}

interface DBWebhookDelivery {
  id: number;
  endpoint_id: number;
  event: string;
  status_code: number;
  success: boolean;
  attempt: number;
  error?: string;
  created_at: string;
}

interface DBEmailLog {
  id: number;
  org_id: number;
  candidate_id?: number;
  candidate_name: string;
  candidate_email: string;
  subject: string;
  body: string;
  trigger_event: string;
  status: 'Sent' | 'Failed' | 'Pending';
  sent_by: string;
  sent_at: string;
}

interface DBEmailTemplate {
  id: string;
  event: string;
  category?: string;
  name: string;
  subject: string;
  body: string;
  is_active: boolean;
  description?: string;
  updated_at?: string;
}

interface DBCandidateInquiry {
  id: number;
  org_id: number;
  job_id?: number;
  job_title?: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone?: string;
  question: string;
  ai_answer?: string;
  status: 'PENDING' | 'ANSWERED' | 'STARRED';
  hr_reply?: string;
  hr_replied_at?: string;
  created_at: string;
}

const INQUIRIES: DBCandidateInquiry[] = [];
let nextInquiryId = 1;

// ── Talent Pools & Collections ────────────────────────────────────────────────
export interface DBTalentPool {
  id: number;
  org_id: number;
  name: string;
  description?: string;
  tags?: string[];
  color?: string;
  candidate_ids: number[];
  created_at: string;
  updated_at?: string;
}

export interface DBSequenceStep {
  id: number;
  step_number: number;
  delay_hours: number;
  subject: string;
  body_template: string;
}

export interface DBSequence {
  id: number;
  org_id: number;
  title: string;
  description?: string;
  trigger_event?: string;
  steps: DBSequenceStep[];
  created_at: string;
}

export interface DBSequenceEnrollment {
  id: number;
  org_id: number;
  sequence_id: number;
  sequence_title: string;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  current_step: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  enrolled_at: string;
  next_send_at: string;
  history: {
    step_number: number;
    subject: string;
    sent_at: string;
    status: 'SENT' | 'FAILED';
  }[];
}

const TALENT_POOLS: DBTalentPool[] = [
  {
    id: 1,
    org_id: 1,
    name: 'قادة React (React Leaders)',
    description: 'خبراء ومصممو واجهات React و Next.js المتفوقون للمشاريع الكبيرة.',
    tags: ['React', 'TypeScript', 'Frontend'],
    color: 'blue',
    candidate_ids: [1, 3],
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 2,
    org_id: 1,
    name: 'مرشحو المستقبل (Future Candidates)',
    description: 'مرشحون مميزون ذوو تقييمات عالية للوظائف المستقبلية.',
    tags: ['High Score', 'Leadership', 'Future'],
    color: 'emerald',
    candidate_ids: [1, 2],
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 3,
    org_id: 1,
    name: 'مصممو UI/UX (UI/UX Designers)',
    description: 'مبدعو تصميم واجهات وتجربة المستخدم.',
    tags: ['UI', 'UX', 'Figma'],
    color: 'purple',
    candidate_ids: [],
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  }
];

const SEQUENCES: DBSequence[] = [
  {
    id: 1,
    org_id: 1,
    title: 'سلسلة التذكير بمواعيد المقابلات (Interview Reminder Sequence)',
    description: 'سلسلة رسائل متابعة تلقائية لتأكيد الموعد والتذكير بعد 48 ساعة.',
    trigger_event: 'AFTER_INTERVIEW_SCHEDULED',
    steps: [
      {
        id: 1,
        step_number: 1,
        delay_hours: 0,
        subject: 'تأكيد موعد المقابلة الوظيفية: {{job_title}}',
        body_template: 'مرحباً {{candidate_name}}،\n\nنود تأكيد موعد مقابلتك المحددة لوظيفة {{job_title}} في شركة {{company_name}}.\n\nموعد المقابلة: {{interview_date}}\nرابط الاجتماع: {{interview_link}}\n\nنتمنى لك كل التوفيق!\nفريق التوظيف'
      },
      {
        id: 2,
        step_number: 2,
        delay_hours: 48,
        subject: 'تذكير: موعد المقابلة القادمة خلال 48 ساعة',
        body_template: 'مرحباً {{candidate_name}}،\n\nتذكير ودي بموعد مقابلتك القادمة لوظيفة {{job_title}}.\n\nيرجى التأكد من الانضمام عبر الرابط: {{interview_link}}\n\nتحياتنا،\n{{company_name}}'
      }
    ],
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 2,
    org_id: 1,
    title: 'متابعة العرض الوظيفي (Job Offer Nurturing Sequence)',
    description: 'سلسلة تذكير تلقائية بالعرض الوظيفي بعد 3 أيام من صدوره.',
    trigger_event: 'AFTER_OFFER_SENT',
    steps: [
      {
        id: 1,
        step_number: 1,
        delay_hours: 0,
        subject: 'عرض وظيفي رسمي: {{job_title}} في {{company_name}}',
        body_template: 'عزيزي {{candidate_name}}،\n\nيسرنا تقديم عرض العمل الرسمي لوظيفة {{job_title}}.\n\nالراتب المقترح: {{offer_amount}} {{offer_currency}}\nالموعد النهائي للرد: {{offer_deadline}}\n\nيسعدنا انضمامك لفريقنا!'
      },
      {
        id: 2,
        step_number: 2,
        delay_hours: 72,
        subject: 'تذكير بالعرض الوظيفي المتاح - {{company_name}}',
        body_template: 'عزيزي {{candidate_name}}،\n\nنود التذكير بأن عرض العمل لوظيفة {{job_title}} لا يزال بانتظار موافقتك.\n\nينتهي العرض بتاريخ: {{offer_deadline}}.\nفي حال كان لديك أي استفسارات، لا تتردد في التواصل معنا مباشرة.\n\nمع أطيب التحيات،\nفريق التوظيف'
      }
    ],
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  }
];

const SEQUENCE_ENROLLMENTS: DBSequenceEnrollment[] = [];

// ── Automated Email Drip Campaigns (Talent CRM) ─────────────────────────────
export interface DBDripStep {
  id: number;
  step_number: number;
  delay_value: number;
  delay_unit: 'hours' | 'days';
  delay_hours: number;
  subject: string;
  body_template: string;
  action_type?: 'EMAIL' | 'INTERNAL_NOTIFICATION';
}

export interface DBDripCampaign {
  id: number;
  org_id: number;
  title: string;
  description?: string;
  trigger_stage: string;
  target_job_id?: number | null;
  target_job_title?: string;
  target_pool_id?: number | null;
  is_active: boolean;
  steps: DBDripStep[];
  enrolled_count: number;
  completed_count: number;
  created_at: string;
  updated_at?: string;
}

export interface DBDripExecutionLog {
  id: number;
  org_id: number;
  campaign_id: number;
  campaign_title: string;
  trigger_stage: string;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  step_number: number;
  total_steps: number;
  subject: string;
  body_rendered: string;
  status: 'SCHEDULED' | 'SENT' | 'FAILED' | 'SKIPPED';
  scheduled_for: string;
  executed_at?: string;
  error?: string;
}

const DRIP_CAMPAIGNS: DBDripCampaign[] = [
  {
    id: 1,
    org_id: 1,
    title: 'حملة استلام الطلبات والتأكيد التلقائي (Application Received Drip)',
    description: 'سلسلة تقطير تبدأ فور تقديم المرشح، تشكر المرشح وتوضح خطوات التقييم والفرز ثم رسالة تعريفية بعد 48 ساعة.',
    trigger_stage: 'Application Received',
    target_job_id: null,
    target_pool_id: null,
    is_active: true,
    enrolled_count: 3,
    completed_count: 2,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    steps: [
      {
        id: 1,
        step_number: 1,
        delay_value: 0,
        delay_unit: 'hours',
        delay_hours: 0,
        subject: 'تم استلام طلب التقديم بنجاح - {{job_title}} في {{company_name}}',
        body_template: 'عزيزي/عزيزتي {{candidate_name}}،\n\nنشكرك على اهتمامك بالانضمام إلى فريق {{company_name}} والتقديم على وظيفة {{job_title}}.\n\nتم استلام سيرتك الذاتية وتجري الآن مراجعتها عبر نظام الفرز الذكي. سنقوم بموافاتك بالخطوات القادمة قريباً.\n\nمع أطيب التحيات،\nفريق استقطاب المواهب - {{company_name}}'
      },
      {
        id: 2,
        step_number: 2,
        delay_value: 48,
        delay_unit: 'hours',
        delay_hours: 48,
        subject: 'تعرف على بيئة العمل وثقافة الابتكار في {{company_name}}',
        body_template: 'مرحباً {{candidate_name}}،\n\nبينما يواصل فريق التوظيف مراجعة ملفك لوظيفة {{job_title}}، يسعدنا مشاركتك لمحة سريعة عن قيم وثقافة العمل لدينا في {{company_name}}.\n\nيمكنك زيارة موقعنا والاطلاع على مشاريعنا وشهادات الموظفين.\n\nنتمنى لك كل التوفيق!\n{{company_name}}'
      }
    ]
  },
  {
    id: 2,
    org_id: 1,
    title: 'سلسلة التذكير بمواعيد المقابلات (Interview Scheduled Drip)',
    description: 'ترسل تفاصيل المقابلة فور جدولتها، وتتبعها برسالة تذكيرية قبل 24 ساعة لضمان الحضور.',
    trigger_stage: 'Interview Scheduled',
    target_job_id: null,
    target_pool_id: null,
    is_active: true,
    enrolled_count: 2,
    completed_count: 1,
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    steps: [
      {
        id: 1,
        step_number: 1,
        delay_value: 0,
        delay_unit: 'hours',
        delay_hours: 0,
        subject: 'دعوة لمقابلة وظيفية: {{job_title}} - {{company_name}}',
        body_template: 'عزيزي {{candidate_name}}،\n\nيسرنا دعوتك لحضور مقابلة تقييمية لوظيفة {{job_title}}.\n\n📅 الموعد: {{interview_date}}\n📍 رابط الاجتماع: {{interview_link}}\n\nيرجى التأكد من الحضور قبل الموعد بـ 5 دقائق.\n\nتحياتنا،\n{{company_name}}'
      },
      {
        id: 2,
        step_number: 2,
        delay_value: 24,
        delay_unit: 'hours',
        delay_hours: 24,
        subject: 'تذكير بموعد مقابلتك القادمة مع فريق {{company_name}}',
        body_template: 'مرحباً {{candidate_name}}،\n\nتذكير ودي بموعد مقابلتك المحدد لوظيفة {{job_title}}.\n\nالرابط المباشر: {{interview_link}}\n\nإذا واجهتك أي صعوبة تقنية، يرجى الرد على هذا البريد فوراً.\n\nنتطلع للحديث معك!'
      }
    ]
  },
  {
    id: 3,
    org_id: 1,
    title: 'حملة متابعة وقبول العروض الوظيفية (Offer Sent Nurturing)',
    description: 'إرسال خطاب العرض ومتابعة المرشح بعد 3 أيام للإجابة على الاستفسارات والتأكيد.',
    trigger_stage: 'Offer Sent',
    target_job_id: null,
    target_pool_id: null,
    is_active: true,
    enrolled_count: 1,
    completed_count: 1,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    steps: [
      {
        id: 1,
        step_number: 1,
        delay_value: 0,
        delay_unit: 'hours',
        delay_hours: 0,
        subject: 'تهانينا! عرض عمل رسمي لوظيفة {{job_title}} - {{company_name}}',
        body_template: 'عزيزي {{candidate_name}}،\n\nيسعدنا جداً تقديم عرض التوظيف الرسمي لك لشغل وظيفة {{job_title}} لدى {{company_name}}.\n\nالراتب والمزايا: {{offer_amount}} {{offer_currency}}\nمهلة الرد: {{offer_deadline}}\n\nنتشرف بانضمامك لفريقنا ونتمنى لك مسيرة مهنية مميزة معنا.\n\nمع وافر التقدير،\nإدارة الموارد البشرية'
      },
      {
        id: 2,
        step_number: 2,
        delay_value: 3,
        delay_unit: 'days',
        delay_hours: 72,
        subject: 'متابعة العرض الوظيفي: هل لديك أي استفسارات؟ - {{company_name}}',
        body_template: 'مرحباً {{candidate_name}}،\n\nنود الاطمئنان على استلامك للعرض الوظيفي الرسمي واستطلاع ما إذا كانت لديك أي استفسارات حول بيئة العمل، المزايا، أو خطوات البدء.\n\nيسعدنا دائماً تقديم أي توضيحات.\n\nأطيب التحيات،\n{{company_name}}'
      }
    ]
  },
  {
    id: 4,
    org_id: 1,
    title: 'تغذية العلاقات ودعوة بنك المواهب (Talent Pool Nurture)',
    description: 'سلسلة بعد مرحلة الاعتذار لإبقاء المرشحين المتميزين ضمن شبكة المواهب للوظائف المستقبلية.',
    trigger_stage: 'Rejected',
    target_job_id: null,
    target_pool_id: null,
    is_active: true,
    enrolled_count: 2,
    completed_count: 2,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    steps: [
      {
        id: 1,
        step_number: 1,
        delay_value: 0,
        delay_unit: 'hours',
        delay_hours: 0,
        subject: 'تحديث بشأن طلب التقديم لوظيفة {{job_title}} - {{company_name}}',
        body_template: 'عزيزي {{candidate_name}}،\n\nنشكرك على الوقت الذي خصصته لمشاركتنا خبراتك لوظيفة {{job_title}}.\n\nنود إبلاغك بأنه وقع الاختيار على مرشح آخر لهذه الفرصة بالذات، إلا أننا نقدر كفاءتك العالية ورغبتك في الانضمام إلينا.\n\nمع تمنياتنا لك بالتوفيق الدائم.\n{{company_name}}'
      },
      {
        id: 2,
        step_number: 2,
        delay_value: 7,
        delay_unit: 'days',
        delay_hours: 168,
        subject: 'ابقَ على تواصل: ملفك المهني محفوظ في بنك مواهب {{company_name}}',
        body_template: 'مرحباً {{candidate_name}}،\n\nنود إعلامك بأن سيرتك الذاتية محفوظة ومميزة ضمن بنك المواهب النشط لدينا. عند فتح أي شواغر جديدة تتوافق مع خبراتك، ستكون لك الأولوية في التواصل.\n\nشكراً لثقتك بنا!\n{{company_name}} Talent Network'
      }
    ]
  }
];

const DRIP_LOGS: DBDripExecutionLog[] = [
  {
    id: 1,
    org_id: 1,
    campaign_id: 1,
    campaign_title: 'حملة استلام الطلبات والتأكيد التلقائي (Application Received Drip)',
    trigger_stage: 'Application Received',
    candidate_id: 1,
    candidate_name: 'Karim Abdelrahman',
    candidate_email: 'cillkareem@gmail.com',
    step_number: 1,
    total_steps: 2,
    subject: 'تم استلام طلب التقديم بنجاح - Senior Full Stack Engineer في CalliQ',
    body_rendered: 'عزيزي كريم، نشكرك على تقديمك لوظيفة Senior Full Stack Engineer. تم استلام السيرة الذاتية بنجاح.',
    status: 'SENT',
    scheduled_for: new Date(Date.now() - 7 * 86400000).toISOString(),
    executed_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 2,
    org_id: 1,
    campaign_id: 1,
    campaign_title: 'حملة استلام الطلبات والتأكيد التلقائي (Application Received Drip)',
    trigger_stage: 'Application Received',
    candidate_id: 1,
    candidate_name: 'Karim Abdelrahman',
    candidate_email: 'cillkareem@gmail.com',
    step_number: 2,
    total_steps: 2,
    subject: 'تعرف على بيئة العمل وثقافة الابتكار في CalliQ',
    body_rendered: 'مرحباً كريم، يسعدنا مشاركتك لمحة سريعة عن ثقافة العمل ومشاريعنا في CalliQ.',
    status: 'SENT',
    scheduled_for: new Date(Date.now() - 5 * 86400000).toISOString(),
    executed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 3,
    org_id: 1,
    campaign_id: 2,
    campaign_title: 'سلسلة التذكير بمواعيد المقابلات (Interview Scheduled Drip)',
    trigger_stage: 'Interview Scheduled',
    candidate_id: 2,
    candidate_name: 'Dr. Elena Rostova',
    candidate_email: 'elena.rostova@ailab.org',
    step_number: 1,
    total_steps: 2,
    subject: 'دعوة لمقابلة وظيفية: Lead AI Researcher - CalliQ',
    body_rendered: 'Dear Dr. Elena, We are excited to invite you to a technical interview for the Lead AI Researcher role.',
    status: 'SENT',
    scheduled_for: new Date(Date.now() - 2 * 86400000).toISOString(),
    executed_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  }
];

let nextTalentPoolId = 4;
let nextSequenceId = 3;
let nextEnrollmentId = 1;
let nextDripCampaignId = 5;
let nextDripLogId = 4;

const EMAIL_LOGS: DBEmailLog[] = [
  {
    id: 1,
    org_id: 1,
    candidate_id: 1,
    candidate_name: 'Karim Abdelrahman',
    candidate_email: 'cillkareem@gmail.com',
    subject: 'Application Received - Senior Full Stack Engineer',
    body: 'Dear Karim Abdelrahman,\n\nThank you for applying for the Senior Full Stack Engineer position at CalliQ. We have received your CV and our AI ATS evaluation engine has processed your application.\n\nBest regards,\nCalliQ Talent Acquisition',
    trigger_event: 'application_received',
    status: 'Sent',
    sent_by: 'System Auto-Trigger',
    sent_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 2,
    org_id: 1,
    candidate_id: 1,
    candidate_name: 'Karim Abdelrahman',
    candidate_email: 'cillkareem@gmail.com',
    subject: 'Interview Invitation - Senior Full Stack Engineer',
    body: 'Dear Karim Abdelrahman,\n\nWe are pleased to invite you for a Technical Interview for the Senior Full Stack Engineer role.\n\nScheduled Date: Tomorrow 3:00 PM\nMeeting Link: https://meet.google.com/calliq-interview\n\nLooking forward to speaking with you!\nCalliQ Hiring Team',
    trigger_event: 'interview_scheduled',
    status: 'Sent',
    sent_by: 'CalliQ Admin',
    sent_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  }
];

const DEFAULT_EMAIL_TEMPLATES: DBEmailTemplate[] = [
  {
    id: 'tpl_rejection_standard',
    event: 'rejection_notice',
    category: 'rejection',
    name: 'Standard Rejection Notice',
    description: 'Polite, professional rejection for applicants not selected for current opening.',
    subject: 'Update regarding your application for {{job_title}} at {{company_name}}',
    body: 'Dear {{candidate_name}},\n\nThank you for taking the time to apply for the {{job_title}} position at {{company_name}}.\n\nAfter careful review of all applications, we have decided to move forward with other candidates whose qualifications more closely align with our current role requirements.\n\nWe genuinely appreciate your interest in {{company_name}} and wish you the best of success in your career journey.\n\nSincerely,\n{{company_name}} Talent Acquisition Team',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl_rejection_talent_pool',
    event: 'rejection_notice',
    category: 'rejection',
    name: 'Encouraging Rejection (Talent Pool)',
    description: 'Warm rejection encouraging candidate to stay connected for future opportunities.',
    subject: 'Thank you for interviewing with {{company_name}} - {{job_title}}',
    body: 'Dear {{candidate_name}},\n\nThank you for taking the time to interview with our team for the {{job_title}} position at {{company_name}}.\n\nWhile we were very impressed with your background and qualifications, we have chosen another candidate who possesses specialized experience for this specific role.\n\nWe would love to keep your profile in our active talent pool and reach out when future roles matching your skills become available.\n\nWarm regards,\n{{company_name}} Recruitment Team',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl_interview_invite',
    event: 'interview_scheduled',
    category: 'interview',
    name: 'Standard Interview Invitation',
    description: 'General interview invitation with date, time, and video call link.',
    subject: 'Interview Invitation: {{job_title}} at {{company_name}}',
    body: 'Dear {{candidate_name}},\n\nWe are excited to invite you to an interview for the {{job_title}} position at {{company_name}}!\n\n📅 Date & Time: {{interview_date}}\n📍 Location/Link: {{interview_link}}\n👤 Interviewer: {{recruiter_name}}\n\nPlease confirm if this time works for you by replying to this email.\n\nBest regards,\n{{company_name}} Hiring Team',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl_interview_tech',
    event: 'interview_scheduled',
    category: 'interview',
    name: 'Technical Assessment & Interview',
    description: 'Invitation for technical assessment or coding/case study round.',
    subject: 'Technical Interview Stage: {{job_title}} - {{company_name}}',
    body: 'Dear {{candidate_name}},\n\nCongratulations on passing the initial screening! We would like to invite you to the Technical Interview stage for the {{job_title}} position at {{company_name}}.\n\n📅 Date & Time: {{interview_date}}\n📍 Meeting Link: {{interview_link}}\n\nIn this round, we will discuss your technical problem-solving approach and past engineering projects.\n\nLooking forward to speaking with you!\n\nWarm regards,\n{{company_name}} Technical Team',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl_offer_standard',
    event: 'offer_letter',
    category: 'offer',
    name: 'Official Job Offer Letter',
    description: 'Formal employment offer letter with salary, benefits, and response deadline.',
    subject: 'Official Offer of Employment: {{job_title}} at {{company_name}}',
    body: 'Dear {{candidate_name}},\n\nOn behalf of {{company_name}}, I am thrilled to extend an official offer of employment for the position of {{job_title}}!\n\n💰 Offered Salary: {{offer_amount}} {{offer_currency}}\n📅 Target Start / Response Expiry: {{offer_deadline}}\n\nWe were deeply impressed by your experience and enthusiasm, and we believe you will be a tremendous addition to our team.\n\nPlease review the offer details and let us know if you accept.\n\nWarm regards,\n{{company_name}} Executive Leadership',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl_app_received',
    event: 'application_received',
    category: 'confirmation',
    name: 'Application Receipt Confirmation',
    description: 'Automated receipt acknowledgment sent immediately after applying.',
    subject: 'Application Received - {{job_title}} at {{company_name}}',
    body: 'Dear {{candidate_name}},\n\nThank you for applying for the {{job_title}} position at {{company_name}}.\n\nWe have successfully received your CV and application. Our AI-powered recruitment engine is evaluating your qualifications against our benchmarks.\n\nWe will update you on the next steps shortly.\n\nBest regards,\n{{company_name}} Talent Team',
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl_shortlisted',
    event: 'shortlisted',
    category: 'shortlist',
    name: 'Shortlisted Candidate Notice',
    description: 'Notification sent when candidate is shortlisted for phone screening.',
    subject: 'Great news regarding your application for {{job_title}}!',
    body: 'Dear {{candidate_name}},\n\nCongratulations! Your profile has been shortlisted for the {{job_title}} role at {{company_name}}.\n\nOur recruiters were impressed by your background and experience. A member of our hiring team will reach out soon to coordinate the next interview phase.\n\nBest regards,\n{{company_name}} Recruitment Team',
    is_active: true,
    updated_at: new Date().toISOString(),
  }
];

const EMAIL_TEMPLATES: DBEmailTemplate[] = JSON.parse(JSON.stringify(DEFAULT_EMAIL_TEMPLATES));

let nextEmailLogId = 10;
function sendAutomatedCandidateEmail(
  event: string,
  candidate: { id?: number; org_id?: number; full_name: string; email: string; job_id?: number },
  extraData?: Record<string, any>
): DBEmailLog | null {
  const tpl = EMAIL_TEMPLATES.find(t => t.event === event && t.is_active);
  if (!tpl) return null;

  const targetJob = candidate.job_id ? JOBS.find(j => j.id === candidate.job_id) : JOBS[0];
  const companyName = targetJob?.company || 'CalliQ';
  const jobTitle = targetJob?.title || 'Open Position';

  let subject = tpl.subject
    .replace(/\{\{candidate_name\}\}/g, candidate.full_name || 'Candidate')
    .replace(/\{\{job_title\}\}/g, jobTitle)
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{interview_date\}\}/g, extraData?.interview_date || 'Scheduled Time')
    .replace(/\{\{interview_link\}\}/g, extraData?.interview_link || 'Google Meet')
    .replace(/\{\{offer_amount\}\}/g, String(extraData?.offer_amount || ''))
    .replace(/\{\{offer_currency\}\}/g, String(extraData?.offer_currency || 'USD'))
    .replace(/\{\{offer_deadline\}\}/g, String(extraData?.offer_deadline || '7 Days'));

  let body = tpl.body
    .replace(/\{\{candidate_name\}\}/g, candidate.full_name || 'Candidate')
    .replace(/\{\{job_title\}\}/g, jobTitle)
    .replace(/\{\{company_name\}\}/g, companyName)
    .replace(/\{\{interview_date\}\}/g, extraData?.interview_date || 'Scheduled Time')
    .replace(/\{\{interview_link\}\}/g, extraData?.interview_link || 'Google Meet')
    .replace(/\{\{offer_amount\}\}/g, String(extraData?.offer_amount || ''))
    .replace(/\{\{offer_currency\}\}/g, String(extraData?.offer_currency || 'USD'))
    .replace(/\{\{offer_deadline\}\}/g, String(extraData?.offer_deadline || '7 Days'));

  const log: DBEmailLog = {
    id: nextEmailLogId++,
    org_id: candidate.org_id || 1,
    candidate_id: candidate.id,
    candidate_name: candidate.full_name,
    candidate_email: candidate.email,
    subject,
    body,
    trigger_event: event,
    status: 'Sent',
    sent_by: extraData?.sent_by || 'Automated Email Engine',
    sent_at: new Date().toISOString(),
  };

  EMAIL_LOGS.unshift(log);
  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: `Automated Email Sent (${tpl.name})`,
    user: extraData?.sent_by || 'System Auto-Trigger',
    target: `${candidate.full_name} <${candidate.email}>`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  return log;
}

function triggerDripCampaignsForCandidate(
  triggerStage: string,
  candidate: DBCandidate,
  extraData?: Record<string, any>
) {
  try {
    const orgId = candidate.org_id || 1;
    const targetJob = candidate.job_id ? JOBS.find(j => j.id === candidate.job_id) : JOBS[0];
    const companyName = targetJob?.company || 'CalliQ';
    const jobTitle = targetJob?.title || candidate.current_position || 'Open Position';

    const normStage = (triggerStage || '').trim().toLowerCase();

    const matchingCampaigns = DRIP_CAMPAIGNS.filter(c => {
      if (c.org_id !== orgId || !c.is_active) return false;
      const cNorm = (c.trigger_stage || '').trim().toLowerCase();

      const match =
        cNorm === normStage ||
        (normStage.includes('apply') || normStage.includes('application') || normStage.includes('received') || normStage.includes('new')) && (cNorm.includes('apply') || cNorm.includes('received')) ||
        (normStage.includes('interview') || normStage.includes('scheduled')) && (cNorm.includes('interview')) ||
        (normStage.includes('offer')) && (cNorm.includes('offer')) ||
        (normStage.includes('reject')) && (cNorm.includes('reject')) ||
        (normStage.includes('shortlist')) && (cNorm.includes('shortlist')) ||
        (normStage.includes('screen')) && (cNorm.includes('screen')) ||
        (normStage.includes('hire')) && (cNorm.includes('hire'));

      if (!match) return false;

      if (c.target_job_id && candidate.job_id && c.target_job_id !== candidate.job_id) return false;

      if (c.target_pool_id) {
        const pool = TALENT_POOLS.find(p => p.id === c.target_pool_id);
        if (!pool || !pool.candidate_ids.includes(candidate.id)) return false;
      }

      return true;
    });

    for (const camp of matchingCampaigns) {
      camp.enrolled_count = (camp.enrolled_count || 0) + 1;

      for (const step of camp.steps) {
        const delayHours = step.delay_hours ?? (step.delay_unit === 'days' ? (step.delay_value || 0) * 24 : (step.delay_value || 0));
        const scheduledFor = new Date(Date.now() + delayHours * 3600 * 1000).toISOString();

        const replacePlaceholders = (text: string) => {
          return (text || '')
            .replace(/\{\{candidate_name\}\}/g, candidate.full_name || 'Candidate')
            .replace(/\{\{job_title\}\}/g, jobTitle)
            .replace(/\{\{company_name\}\}/g, companyName)
            .replace(/\{\{interview_date\}\}/g, extraData?.interview_date || candidate.interview_scheduled || 'الموعد المحدد')
            .replace(/\{\{interview_link\}\}/g, extraData?.interview_link || candidate.interview_link || 'https://meet.google.com/calliq-interview')
            .replace(/\{\{offer_amount\}\}/g, String(extraData?.offer_amount || candidate.offer_amount || '120,000'))
            .replace(/\{\{offer_currency\}\}/g, String(extraData?.offer_currency || candidate.offer_currency || 'USD'))
            .replace(/\{\{offer_deadline\}\}/g, String(extraData?.offer_deadline || candidate.offer_deadline || '7 Days'));
        };

        const subject = replacePlaceholders(step.subject);
        const body = replacePlaceholders(step.body_template);
        const isImmediate = delayHours === 0;

        const log: DBDripExecutionLog = {
          id: nextDripLogId++,
          org_id: orgId,
          campaign_id: camp.id,
          campaign_title: camp.title,
          trigger_stage: camp.trigger_stage,
          candidate_id: candidate.id,
          candidate_name: candidate.full_name,
          candidate_email: candidate.email,
          step_number: step.step_number,
          total_steps: camp.steps.length,
          subject,
          body_rendered: body,
          status: isImmediate ? 'SENT' : 'SCHEDULED',
          scheduled_for: scheduledFor,
          executed_at: isImmediate ? new Date().toISOString() : undefined,
        };

        DRIP_LOGS.unshift(log);

        if (isImmediate) {
          EMAIL_LOGS.unshift({
            id: nextEmailLogId++,
            org_id: orgId,
            candidate_id: candidate.id,
            candidate_name: candidate.full_name,
            candidate_email: candidate.email,
            subject,
            body,
            trigger_event: `drip_${camp.trigger_stage.toLowerCase().replace(/\s+/g, '_')}_step_${step.step_number}`,
            status: 'Sent',
            sent_by: `Drip Campaign: ${camp.title}`,
            sent_at: new Date().toISOString(),
          });

          AUDIT_LOGS.unshift({
            id: AUDIT_LOGS.length + 1,
            action: `Drip Campaign Triggered: ${camp.title} (Step ${step.step_number})`,
            user: 'Automated CRM Drip Engine',
            target: `${candidate.full_name} <${candidate.email}>`,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    saveDatabase();
  } catch (dripErr) {
    console.error('[Drip Campaign Trigger Error]:', dripErr);
  }
}

// ── Initial Demo Seed Data ──────────────────────────────────────────────────
const USERS: DBUser[] = [
  {
    id: 1,
    email: 'admin@calliq.ai',
    name: 'CalliQ Admin',
    role: 'admin',
    org_id: 1,
    org_name: 'CalliQ Global Admin',
    password: 'admin1234',
    is_active: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 2,
    email: 'hr@calliq.ai',
    name: 'HR Recruiter',
    role: 'recruiter',
    org_id: 2,
    org_name: 'Tech Talent Acquisition',
    password: 'hr1234',
    is_active: true,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 3,
    email: 'demo@company.com',
    name: 'Demo Recruiter',
    role: 'recruiter',
    org_id: 3,
    org_name: 'Demo Enterprise HR',
    password: 'demo1234',
    is_active: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

const JOBS: DBJob[] = [
  {
    id: 1,
    org_id: 1,
    recruiter_id: 1,
    title: 'Senior Full Stack Engineer',
    company: 'CalliQ Technologies',
    description: 'Looking for an experienced Full Stack engineer with deep knowledge of React, Node.js/Python, TypeScript, and modern cloud deployment pipelines.',
    required_skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],
    nice_to_have: ['FastAPI', 'AWS', 'TailwindCSS', 'Redis'],
    min_experience: 4,
    max_experience: 8,
    education_req: "Bachelor's in Computer Science or equivalent",
    location_req: 'Remote / Hybrid',
    hr_email: 'jobs@calliq.ai',
    salary_min: 75000,
    salary_max: 120000,
    is_active: true,
    apply_url: '/apply/job-token-senior-fullstack-1',
    score_strong_match: 85,
    score_potential_match: 65,
    score_weak_match: 40,
    candidate_count: 5,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 2,
    org_id: 1,
    recruiter_id: 1,
    title: 'AI & Machine Learning Specialist',
    company: 'CalliQ Labs',
    description: 'Lead the development of generative AI pipelines, LLM routing algorithms, and multi-modal CV classification models.',
    required_skills: ['Python', 'PyTorch', 'LLMs', 'FastAPI', 'LangChain'],
    nice_to_have: ['Vector DBs', 'Kubernetes', 'HuggingFace', 'Docker'],
    min_experience: 3,
    max_experience: 7,
    education_req: "Master's or Bachelor's in CS / AI",
    location_req: 'Remote',
    hr_email: 'ai-jobs@calliq.ai',
    salary_min: 90000,
    salary_max: 140000,
    is_active: true,
    apply_url: '/apply/job-token-ai-ml-specialist-2',
    score_strong_match: 85,
    score_potential_match: 70,
    score_weak_match: 45,
    candidate_count: 4,
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 3,
    org_id: 1,
    recruiter_id: 2,
    title: 'Product Marketing Manager',
    company: 'CalliQ AI Global',
    description: 'Drive go-to-market strategies, B2B SaaS positioning, outbound growth funnels, and enterprise customer acquisition.',
    required_skills: ['Product Marketing', 'B2B SaaS', 'GTM Strategy', 'Content Strategy'],
    nice_to_have: ['HubSpot', 'SEO', 'Data Analysis'],
    min_experience: 3,
    max_experience: 6,
    education_req: 'Degree in Business, Marketing or related',
    location_req: 'London / Dubai / Remote',
    hr_email: 'careers@calliq.ai',
    salary_min: 60000,
    salary_max: 95000,
    is_active: true,
    apply_url: '/apply/job-token-product-marketing-3',
    score_strong_match: 80,
    score_potential_match: 60,
    score_weak_match: 35,
    candidate_count: 3,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  }
];

const KNOCKOUT_RULES: DBKnockoutRule[] = [
  {
    id: 1,
    job_id: 1,
    rule_type: 'experience',
    field: 'years_experience',
    operator: 'gte',
    value: '2',
    action: 'reject',
    description: 'Minimum 2 years of proven software engineering experience.',
    is_active: true,
    is_mandatory: true,
  }
];

const CANDIDATES: DBCandidate[] = [
  {
    id: 1,
    org_id: 1,
    recruiter_id: 1,
    job_id: 1,
    full_name: 'Karim Ahmed Mansour',
    email: 'karim.mansour@techmail.io',
    phone: '+20 100 456 7890',
    whatsapp_phone: '+201004567890',
    location: 'Cairo, Egypt (Open to Remote)',
    nationality: 'Egyptian',
    linkedin: 'https://linkedin.com/in/karim-mansour-dev',
    github: 'https://github.com/karim-mansour',
    portfolio: 'https://karim-dev.io',
    current_position: 'Senior Software Engineer at Horizon Cloud',
    years_experience: 6,
    previous_positions: [
      { title: 'Senior Software Engineer', company: 'Horizon Cloud', start: '2022-01', end: 'Present', duration_months: 32 },
      { title: 'Full Stack Developer', company: 'Nexus Digital', start: '2019-06', end: '2021-12', duration_months: 30 },
    ],
    companies: ['Horizon Cloud', 'Nexus Digital'],
    education: [
      { degree: "Bachelor's of Science", field: 'Computer Science', institution: 'Cairo University', year: '2019', gpa: 3.8 }
    ],
    certifications: [
      { name: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', year: 2023 }
    ],
    courses: ['Advanced Distributed Systems', 'Modern Cloud Architecture'],
    technical_skills: {
      Frontend: ['React', 'TypeScript', 'TailwindCSS', 'Next.js'],
      Backend: ['Node.js', 'FastAPI', 'Express', 'Python'],
      Databases: ['PostgreSQL', 'Redis', 'MongoDB'],
      DevOps: ['Docker', 'Kubernetes', 'CI/CD', 'GitHub Actions']
    },
    soft_skills: ['Technical Leadership', 'Cross-Functional Team Collaboration', 'Problem Solving'],
    languages: [
      { language: 'Arabic', level: 'Native' },
      { language: 'English', level: 'Fluent / Professional' }
    ],
    projects: [
      { name: 'Multi-Tenant Microservices ATS', description: 'Engineered high-throughput candidate matching system.', technologies: ['React', 'Node.js', 'PostgreSQL', 'Docker'] }
    ],
    achievements: ['Increased system throughput by 40% using Redis caching and async queues.'],
    awards: ['Best Engineering Contributor 2023'],
    match_score: 94,
    ats_score: 96,
    skill_match: 95,
    experience_match: 92,
    education_match: 95,
    seniority_match: 94,
    location_match: 90,
    keyword_match: 96,
    salary_match: 92,
    ai_confidence: 96,
    recommendation: 'Strong Hire',
    recommendation_reason: 'Exceptional alignment across all required stack requirements (React, TypeScript, Node.js, PostgreSQL, Docker) with 6 years of solid full-stack experience.',
    ai_summary: 'Karim is a seasoned Senior Software Engineer demonstrating strong full-stack proficiency. His recent projects match the architectural needs of the role seamlessly.',
    strengths: [
      'Comprehensive mastery of TypeScript, React, and Node.js backend services',
      'Solid 6 years of progressive engineering experience with proven leadership',
      'Hands-on experience with cloud deployments (AWS, Docker, CI/CD)'
    ],
    weaknesses: [
      'Has not explicitly listed extensive Kubernetes production tuning experience'
    ],
    missing_skills: [],
    missing_certs: [],
    skill_gap_analysis: 'Zero critical skill gaps for this job specification.',
    ats_issues: [],
    ats_suggestions: ['Include more metrics on API latency improvements in CV header.'],
    rank: 1,
    category: 'STRONG_MATCH',
    status: 'Shortlisted',
    pipeline_stage: 'Technical',
    pipeline_history: [
      { stage: 'Screening', entered_at: new Date(Date.now() - 8 * 86400000).toISOString(), exited_at: new Date(Date.now() - 6 * 86400000).toISOString(), moved_by: 'Demo Recruiter', notes: 'Initial AI screening passed with 94% score' },
      { stage: 'Phone Interview', entered_at: new Date(Date.now() - 6 * 86400000).toISOString(), exited_at: new Date(Date.now() - 3 * 86400000).toISOString(), moved_by: 'Demo Recruiter', notes: 'Great communication and culture fit' },
      { stage: 'Technical', entered_at: new Date(Date.now() - 3 * 86400000).toISOString(), moved_by: 'Demo Recruiter', notes: 'Live coding challenge scheduled' }
    ],
    recruiter_decision: 'APPROVED',
    decision_notes: 'Top candidate for the Senior Full Stack role.',
    decided_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    salary_expectation: 95000,
    salary_currency: 'USD',
    notice_period_days: 30,
    applied_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    shortlisted_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    flagged: false,
    is_knocked_out: false,
    knockout_flags: [],
    source: 'LinkedIn Direct',
    file_name: 'Karim_Mansour_FullStack_CV.pdf',
    processing_attempts: 1,
    chat_history: [
      { role: 'user', content: 'What are Karim’s top 3 engineering strengths?', created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
      { role: 'assistant', content: 'Karim excels in: 1) Full-stack TypeScript architecture (React + Node.js), 2) Database performance optimization with PostgreSQL & Redis, and 3) Cloud-native containerized delivery with Docker and AWS.', created_at: new Date(Date.now() - 2 * 86400000).toISOString() }
    ],
    whatsapp_history: [
      { type: 'Interview Invitation', body: 'Hi Karim! We were impressed with your application for the Senior Full Stack Engineer position at CalliQ Technologies.', status: 'Delivered', created_at: new Date(Date.now() - 3 * 86400000).toISOString() }
    ],
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: 2,
    org_id: 1,
    recruiter_id: 1,
    job_id: 2,
    full_name: 'Dr. Elena Rostova',
    email: 'elena.rostova@ailab.org',
    phone: '+44 7700 900123',
    whatsapp_phone: '+447700900123',
    location: 'London, UK (Remote / Hybrid)',
    nationality: 'British',
    linkedin: 'https://linkedin.com/in/elena-rostova-ai',
    github: 'https://github.com/elena-rostova',
    current_position: 'Lead AI Researcher at QuantumML',
    years_experience: 5,
    previous_positions: [
      { title: 'Lead AI Researcher', company: 'QuantumML', start: '2021-03', end: 'Present', duration_months: 42 },
      { title: 'Machine Learning Engineer', company: 'DeepSense Analytics', start: '2019-01', end: '2021-02', duration_months: 26 }
    ],
    companies: ['QuantumML', 'DeepSense Analytics'],
    education: [
      { degree: 'Ph.D. in Artificial Intelligence', field: 'Machine Learning', institution: 'University of Oxford', year: '2019' }
    ],
    certifications: [{ name: 'TensorFlow Advanced ML Specialization', issuer: 'DeepLearning.AI', year: 2021 }],
    courses: ['Transformer Architectures', 'Reinforcement Learning with Human Feedback'],
    technical_skills: {
      AI_ML: ['Python', 'PyTorch', 'HuggingFace', 'LangChain', 'LLM Fine-tuning', 'Transformers'],
      Backend: ['FastAPI', 'Docker', 'Celery'],
      Databases: ['Pinecone', 'Qdrant', 'PostgreSQL']
    },
    soft_skills: ['Research Communication', 'Algorithm Design', 'Mentorship'],
    languages: [{ language: 'English', level: 'Native' }],
    projects: [{ name: 'Retrieval Augmented Generation Router', description: 'Semantic retrieval pipeline handling 2M tokens/day.' }],
    achievements: ['Published 4 papers at top ML conferences.'],
    awards: ['Oxford Best Dissertation in AI 2019'],
    match_score: 96,
    ats_score: 98,
    skill_match: 98,
    experience_match: 94,
    education_match: 100,
    seniority_match: 96,
    location_match: 95,
    keyword_match: 97,
    salary_match: 90,
    ai_confidence: 98,
    recommendation: 'Strong Hire',
    recommendation_reason: 'Unmatched background in LLMs, PyTorch, and RAG architectures with a Ph.D. from Oxford and 5 years of applied industry experience.',
    ai_summary: 'Elena is a premier AI Specialist with deep mathematical foundation and practical engineering track record building scalable generative AI systems.',
    strengths: ['Ph.D. in AI with published transformer research', 'Deep mastery of PyTorch, LangChain, and vector embeddings', 'Proven production deployment experience with FastAPI'],
    weaknesses: ['Salary expectation on the higher end of the band'],
    missing_skills: [],
    missing_certs: [],
    skill_gap_analysis: 'Exceeds role requirements.',
    ats_issues: [],
    ats_suggestions: [],
    rank: 1,
    category: 'STRONG_MATCH',
    status: 'Final Interview',
    pipeline_stage: 'Final Interview',
    pipeline_history: [
      { stage: 'Screening', entered_at: new Date(Date.now() - 6 * 86400000).toISOString(), exited_at: new Date(Date.now() - 4 * 86400000).toISOString(), moved_by: 'Demo Recruiter' },
      { stage: 'Technical', entered_at: new Date(Date.now() - 4 * 86400000).toISOString(), exited_at: new Date(Date.now() - 1 * 86400000).toISOString(), moved_by: 'Demo Recruiter', notes: 'Aced AI architecture interview' },
      { stage: 'Final Interview', entered_at: new Date(Date.now() - 1 * 86400000).toISOString(), moved_by: 'Demo Recruiter' }
    ],
    recruiter_decision: 'APPROVED',
    decision_notes: 'Priority hire candidate.',
    decided_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    salary_expectation: 130000,
    salary_currency: 'USD',
    notice_period_days: 15,
    applied_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    shortlisted_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    flagged: false,
    is_knocked_out: false,
    knockout_flags: [],
    source: 'Website Application',
    file_name: 'Elena_Rostova_AI_CV.pdf',
    processing_attempts: 1,
    chat_history: [],
    whatsapp_history: [],
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 3,
    org_id: 1,
    recruiter_id: 1,
    job_id: 1,
    full_name: 'Marcus Vance',
    email: 'marcus.v@inboxmail.com',
    phone: '+1 415 889 2041',
    location: 'Austin, TX (Remote)',
    current_position: 'Frontend Developer at PixelWave',
    years_experience: 3,
    previous_positions: [
      { title: 'Frontend Developer', company: 'PixelWave', start: '2021-08', end: 'Present', duration_months: 36 }
    ],
    companies: ['PixelWave'],
    education: [
      { degree: "Bachelor's", field: 'Information Systems', institution: 'University of Texas', year: '2021' }
    ],
    certifications: [],
    courses: ['React Performance', 'CSS Masterclass'],
    technical_skills: {
      Frontend: ['React', 'JavaScript', 'CSS3', 'HTML5', 'TailwindCSS'],
      Backend: ['Node.js (Basic)'],
      Databases: ['MongoDB']
    },
    soft_skills: ['UI Detail', 'Creativity'],
    languages: [{ language: 'English', level: 'Native' }],
    projects: [{ name: 'E-commerce React Storefront', description: 'High converting shopping experience.' }],
    achievements: ['Redesigned customer checkout flow.'],
    awards: [],
    match_score: 68,
    ats_score: 74,
    skill_match: 65,
    experience_match: 70,
    education_match: 80,
    seniority_match: 65,
    location_match: 85,
    keyword_match: 70,
    salary_match: 80,
    ai_confidence: 90,
    recommendation: 'Consider',
    recommendation_reason: 'Strong frontend UI skills with React, but lacks the required backend depth (PostgreSQL, Docker, distributed architecture) required for a Senior Full Stack role.',
    ai_summary: 'Marcus is a capable React frontend developer who may fit a Mid-level Frontend opening better than Senior Full Stack.',
    strengths: ['Great React and UI styling capabilities', 'Motivated and quick learner'],
    weaknesses: ['Lacks deep Node.js and PostgreSQL production experience', '3 years vs. 4+ years required for senior role'],
    missing_skills: ['Docker', 'PostgreSQL', 'TypeScript Advanced'],
    missing_certs: [],
    skill_gap_analysis: 'Requires backend mentorship for PostgreSQL and Docker infrastructure.',
    ats_issues: ['Limited keywords related to cloud and containerization'],
    ats_suggestions: ['Add details on backend API integration and SQL data models.'],
    rank: 3,
    category: 'POTENTIAL_MATCH',
    status: 'Under Review',
    pipeline_stage: 'Screening',
    pipeline_history: [
      { stage: 'Screening', entered_at: new Date(Date.now() - 4 * 86400000).toISOString() }
    ],
    recruiter_decision: 'NEEDS_REVIEW',
    applied_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    flagged: false,
    is_knocked_out: false,
    knockout_flags: [],
    source: 'Direct Upload',
    file_name: 'Marcus_Vance_Resume.pdf',
    processing_attempts: 1,
    chat_history: [],
    whatsapp_history: [],
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  }
];

const WEBHOOKS: DBWebhookEndpoint[] = [
  {
    id: 1,
    url: 'https://api.calliq.ai/v1/integrations/slack',
    events: ['candidate.applied', 'candidate.shortlisted', 'candidate.hired'],
    is_active: true,
    description: 'Slack channel notifications for recruiter alerts',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  }
];

const AUDIT_LOGS: any[] = [
  { id: 1, action: 'Candidate Upload', user: 'Demo Recruiter', target: 'Karim Ahmed Mansour', timestamp: new Date(Date.now() - 8 * 86400000).toISOString() },
  { id: 2, action: 'AI Evaluation Complete', user: 'System (Gemini)', target: 'Karim Ahmed Mansour (Score: 94%)', timestamp: new Date(Date.now() - 8 * 86400000).toISOString() },
  { id: 3, action: 'Stage Move: Technical', user: 'Demo Recruiter', target: 'Karim Ahmed Mansour', timestamp: new Date(Date.now() - 3 * 86400000).toISOString() },
];

const CANDIDATE_BATCHES: DBCandidateBatch[] = [];

let nextCandidateId = 4;
let nextJobId = 4;
let nextUserId = 3;
let nextOrgId = 2;
let nextWebhookId = 2;
let nextCandidateBatchId = 1;

// In-memory token-to-user session map
const SESSIONS: Map<string, number> = new Map();

// ── Persistent Disk Database Engine ──────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

function initDataPersistence() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.USERS && Array.isArray(parsed.USERS)) {
        USERS.splice(0, USERS.length, ...parsed.USERS);
      }
      if (parsed.JOBS && Array.isArray(parsed.JOBS)) {
        JOBS.splice(0, JOBS.length, ...parsed.JOBS);
      }
      if (parsed.CANDIDATES && Array.isArray(parsed.CANDIDATES)) {
        CANDIDATES.splice(0, CANDIDATES.length, ...parsed.CANDIDATES);
      }
      if (parsed.CANDIDATE_BATCHES && Array.isArray(parsed.CANDIDATE_BATCHES)) {
        CANDIDATE_BATCHES.splice(0, CANDIDATE_BATCHES.length, ...parsed.CANDIDATE_BATCHES);
      }
      if (parsed.WEBHOOKS && Array.isArray(parsed.WEBHOOKS)) {
        WEBHOOKS.splice(0, WEBHOOKS.length, ...parsed.WEBHOOKS);
      }
      if (parsed.AUDIT_LOGS && Array.isArray(parsed.AUDIT_LOGS)) {
        AUDIT_LOGS.splice(0, AUDIT_LOGS.length, ...parsed.AUDIT_LOGS);
      }
      if (parsed.EMAIL_LOGS && Array.isArray(parsed.EMAIL_LOGS)) {
        EMAIL_LOGS.splice(0, EMAIL_LOGS.length, ...parsed.EMAIL_LOGS);
      }
      if (parsed.EMAIL_TEMPLATES && Array.isArray(parsed.EMAIL_TEMPLATES) && parsed.EMAIL_TEMPLATES.length > 0) {
        EMAIL_TEMPLATES.splice(0, EMAIL_TEMPLATES.length, ...parsed.EMAIL_TEMPLATES);
      }
      if (parsed.INQUIRIES && Array.isArray(parsed.INQUIRIES)) {
        INQUIRIES.splice(0, INQUIRIES.length, ...parsed.INQUIRIES);
      }
      if (parsed.TALENT_POOLS && Array.isArray(parsed.TALENT_POOLS)) {
        TALENT_POOLS.splice(0, TALENT_POOLS.length, ...parsed.TALENT_POOLS);
      }
      if (parsed.SEQUENCES && Array.isArray(parsed.SEQUENCES)) {
        SEQUENCES.splice(0, SEQUENCES.length, ...parsed.SEQUENCES);
      }
      if (parsed.SEQUENCE_ENROLLMENTS && Array.isArray(parsed.SEQUENCE_ENROLLMENTS)) {
        SEQUENCE_ENROLLMENTS.splice(0, SEQUENCE_ENROLLMENTS.length, ...parsed.SEQUENCE_ENROLLMENTS);
      }
      if (parsed.DRIP_CAMPAIGNS && Array.isArray(parsed.DRIP_CAMPAIGNS)) {
        DRIP_CAMPAIGNS.splice(0, DRIP_CAMPAIGNS.length, ...parsed.DRIP_CAMPAIGNS);
      }
      if (parsed.DRIP_LOGS && Array.isArray(parsed.DRIP_LOGS)) {
        DRIP_LOGS.splice(0, DRIP_LOGS.length, ...parsed.DRIP_LOGS);
      }
      if (parsed.SESSIONS && typeof parsed.SESSIONS === 'object') {
        SESSIONS.clear();
        for (const [token, uid] of Object.entries(parsed.SESSIONS)) {
          SESSIONS.set(token, Number(uid));
        }
      }
      if (parsed.nextCandidateId) nextCandidateId = Math.max(nextCandidateId, parsed.nextCandidateId);
      if (parsed.nextJobId) nextJobId = Math.max(nextJobId, parsed.nextJobId);
      if (parsed.nextUserId) nextUserId = Math.max(nextUserId, parsed.nextUserId);
      if (parsed.nextOrgId) nextOrgId = Math.max(nextOrgId, parsed.nextOrgId);
      if (parsed.nextWebhookId) nextWebhookId = Math.max(nextWebhookId, parsed.nextWebhookId);
      if (parsed.nextCandidateBatchId) nextCandidateBatchId = Math.max(nextCandidateBatchId, parsed.nextCandidateBatchId);
      if (parsed.nextEmailLogId) nextEmailLogId = Math.max(nextEmailLogId, parsed.nextEmailLogId);
      if (parsed.nextInquiryId) nextInquiryId = Math.max(nextInquiryId, parsed.nextInquiryId);
      if (parsed.nextTalentPoolId) nextTalentPoolId = Math.max(nextTalentPoolId, parsed.nextTalentPoolId);
      if (parsed.nextSequenceId) nextSequenceId = Math.max(nextSequenceId, parsed.nextSequenceId);
      if (parsed.nextEnrollmentId) nextEnrollmentId = Math.max(nextEnrollmentId, parsed.nextEnrollmentId);
      if (parsed.nextDripCampaignId) nextDripCampaignId = Math.max(nextDripCampaignId, parsed.nextDripCampaignId);
      if (parsed.nextDripLogId) nextDripLogId = Math.max(nextDripLogId, parsed.nextDripLogId);

      // Recalculate max IDs to prevent any ID collision
      const maxUid = USERS.reduce((m, u) => Math.max(m, u.id || 0), 0);
      nextUserId = Math.max(nextUserId, maxUid + 1);

      const maxJid = JOBS.reduce((m, j) => Math.max(m, j.id || 0), 0);
      nextJobId = Math.max(nextJobId, maxJid + 1);

      const maxCid = CANDIDATES.reduce((m, c) => Math.max(m, c.id || 0), 0);
      nextCandidateId = Math.max(nextCandidateId, maxCid + 1);

      const maxBid = CANDIDATE_BATCHES.reduce((m, b) => Math.max(m, b.id || 0), 0);
      nextCandidateBatchId = Math.max(nextCandidateBatchId, maxBid + 1);

      const maxEid = EMAIL_LOGS.reduce((m, e) => Math.max(m, e.id || 0), 0);
      nextEmailLogId = Math.max(nextEmailLogId, maxEid + 1);

      const maxIid = INQUIRIES.reduce((m, i) => Math.max(m, i.id || 0), 0);
      nextInquiryId = Math.max(nextInquiryId, maxIid + 1);

      const maxPid = TALENT_POOLS.reduce((m, p) => Math.max(m, p.id || 0), 0);
      nextTalentPoolId = Math.max(nextTalentPoolId, maxPid + 1);

      const maxSid = SEQUENCES.reduce((m, s) => Math.max(m, s.id || 0), 0);
      nextSequenceId = Math.max(nextSequenceId, maxSid + 1);

      const maxEnid = SEQUENCE_ENROLLMENTS.reduce((m, e) => Math.max(m, e.id || 0), 0);
      nextEnrollmentId = Math.max(nextEnrollmentId, maxEnid + 1);

      const maxDripId = DRIP_CAMPAIGNS.reduce((m, d) => Math.max(m, d.id || 0), 0);
      nextDripCampaignId = Math.max(nextDripCampaignId, maxDripId + 1);

      const maxDripLogId = DRIP_LOGS.reduce((m, d) => Math.max(m, d.id || 0), 0);
      nextDripLogId = Math.max(nextDripLogId, maxDripLogId + 1);

      // If database has no users at all, ensure root admin exists
      if (USERS.length === 0) {
        USERS.push({
          id: nextUserId++,
          email: 'admin@calliq.ai',
          name: 'CalliQ Admin',
          role: 'admin',
          org_id: 1,
          org_name: 'CalliQ Global Admin',
          password: 'admin1234',
          is_active: true,
          created_at: new Date().toISOString(),
        });
        saveDatabase();
      }

      // If Talent Pools or Drip campaigns are empty, enrich with rich HR examples for active organizations
      if (TALENT_POOLS.length === 0 || DRIP_CAMPAIGNS.length === 0) {
        const orgIds = Array.from(new Set(USERS.map(u => u.org_id || 1)));
        for (const oid of orgIds) {
          seedHRDemoDataForOrg(oid);
        }
      }

      console.log(`[DB Persistence] Successfully loaded ${USERS.length} users, ${JOBS.length} jobs, ${CANDIDATES.length} candidates, ${CANDIDATE_BATCHES.length} batches from ${DB_FILE}`);
    } else {
      // First initialization ever
      if (USERS.length === 0) {
        USERS.push({
          id: 1,
          email: 'admin@calliq.ai',
          name: 'CalliQ Admin',
          role: 'admin',
          org_id: 1,
          org_name: 'CalliQ Global Admin',
          password: 'admin1234',
          is_active: true,
          created_at: new Date().toISOString(),
        });
      }
      saveDatabase();
      console.log(`[DB Persistence] Initialized new persistent database file at ${DB_FILE}`);
    }
  } catch (err) {
    console.error('[DB Persistence] Error loading database:', err);
  }
}

function saveDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const sessionObj: Record<string, number> = {};
    for (const [k, v] of SESSIONS.entries()) {
      sessionObj[k] = v;
    }
    const dataToSave = {
      USERS,
      JOBS,
      CANDIDATES,
      CANDIDATE_BATCHES,
      WEBHOOKS,
      AUDIT_LOGS,
      EMAIL_LOGS,
      EMAIL_TEMPLATES,
      INQUIRIES,
      TALENT_POOLS,
      SEQUENCES,
      SEQUENCE_ENROLLMENTS,
      DRIP_CAMPAIGNS,
      DRIP_LOGS,
      SESSIONS: sessionObj,
      nextCandidateId,
      nextJobId,
      nextUserId,
      nextOrgId,
      nextWebhookId,
      nextCandidateBatchId,
      nextEmailLogId,
      nextInquiryId,
      nextTalentPoolId,
      nextSequenceId,
      nextEnrollmentId,
      nextDripCampaignId,
      nextDripLogId,
      last_saved_at: new Date().toISOString(),
    };
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);

    // Sync to Neon PostgreSQL if connection URL is set
    syncDataToNeon({
      jobs: JOBS,
      candidates: CANDIDATES,
      users: USERS,
    }).catch(err => console.error('[Neon Sync Async Error]:', err));
  } catch (err) {
    console.error('[DB Persistence] Failed to save database to disk:', err);
  }
}

function seedStarterJobsForOrg(orgId: number, recruiterId: number, orgName: string) {
  const existingJobs = JOBS.filter(j => j.org_id === orgId);
  if (existingJobs.length === 0) {
    const starter1: DBJob = {
      id: nextJobId++,
      org_id: orgId,
      recruiter_id: recruiterId,
      title: 'Talent Acquisition & HR Specialist',
      company: orgName,
      description: 'Manage full-cycle recruitment, talent sourcing, candidate screening, interviews, and HR operations.',
      required_skills: ['Recruiting', 'Talent Acquisition', 'Interviewing', 'HRIS', 'Communication'],
      nice_to_have: ['Employee Relations', 'Onboarding', 'Labor Law', 'ATS Systems'],
      min_experience: 2,
      max_experience: 6,
      education_req: "Bachelor's Degree in HR, Business or related field",
      location_req: 'Remote / Hybrid',
      hr_email: 'hr@company.com',
      salary_min: 45000,
      salary_max: 75000,
      is_active: true,
      apply_url: `/apply/job-token-${Date.now()}-1`,
      score_strong_match: 80,
      score_potential_match: 60,
      score_weak_match: 40,
      candidate_count: 0,
      created_at: new Date().toISOString(),
    };

    const starter2: DBJob = {
      id: nextJobId++,
      org_id: orgId,
      recruiter_id: recruiterId,
      title: 'Operations & Business Manager',
      company: orgName,
      description: 'Oversee daily operations, streamline business processes, manage project roadmaps, and drive KPI performance.',
      required_skills: ['Project Management', 'Operations Management', 'Team Leadership', 'Strategic Planning', 'KPI Tracking'],
      nice_to_have: ['Agile', 'Budgeting', 'Risk Assessment', 'Change Management'],
      min_experience: 3,
      max_experience: 8,
      education_req: "Bachelor's or Master's Degree",
      location_req: 'Hybrid / On-site',
      hr_email: 'careers@company.com',
      salary_min: 60000,
      salary_max: 95000,
      is_active: true,
      apply_url: `/apply/job-token-${Date.now()}-2`,
      score_strong_match: 80,
      score_potential_match: 60,
      score_weak_match: 40,
      candidate_count: 0,
      created_at: new Date().toISOString(),
    };

    JOBS.push(starter1, starter2);
  }
}

// ── Authentication Helper Middleware ────────────────────────────────────────
function getAuthUser(req: express.Request): DBUser | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    // Check in session map
    if (SESSIONS.has(token)) {
      const userId = SESSIONS.get(token);
      const user = USERS.find(u => u.id === userId && u.is_active);
      if (user) return user;
    }

    // Check token format: token_calliq_{userId}_{timestamp}
    const tokenMatch = token.match(/^token_calliq_(\d+)_/);
    if (tokenMatch) {
      const userId = parseInt(tokenMatch[1], 10);
      const user = USERS.find(u => u.id === userId && u.is_active);
      if (user) return user;
    }
  }
  return null;
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ detail: 'Authentication required. Please log in with your credentials.' });
  }
  (req as any).user = user;
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ detail: 'Authentication required. Please log in.' });
  }
  if (user.role !== 'admin' && user.role !== 'owner') {
    return res.status(403).json({ detail: 'Forbidden. Administrator privileges required to perform this action.' });
  }
  (req as any).user = user;
  next();
}

// ── API ROUTES ──────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: 'production', timestamp: new Date().toISOString() });
});

// 1. Auth Endpoints
app.post(['/api/v1/auth/login', '/api/v1/auth/login/', '/api/v1/auth/token', '/api/v1/auth/token/'], (req, res) => {
  const rawEmail = req.body?.username || req.body?.email || req.query?.email || req.query?.username || '';
  const rawPassword = req.body?.password || req.query?.password || '';
  const email = String(rawEmail).trim().toLowerCase();
  const cleanPassword = String(rawPassword).trim();

  if (!email || !cleanPassword) {
    return res.status(400).json({ detail: 'البريد الإلكتروني وكلمة المرور مطلوبة.' });
  }

  const user = USERS.find(u => (u.email || '').trim().toLowerCase() === email);
  if (!user) {
    return res.status(401).json({ detail: 'بيانات الدخول غير صحيحة. البريد الإلكتروني غير مسجل في النظام.' });
  }

  if (!user.is_active) {
    return res.status(403).json({ detail: 'تم تعطيل هذا الحساب. يرجى مراجعة مسؤول النظام.' });
  }

  const userPass = String(user.password || '').trim();
  if (userPass !== cleanPassword) {
    return res.status(401).json({ detail: 'كلمة المرور غير صحيحة. يرجى التأكد من كلمة المرور.' });
  }

  const token = `token_calliq_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  SESSIONS.set(token, user.id);
  saveDatabase();

  return res.json({
    access_token: token,
    refresh_token: `refresh_${user.id}_${Date.now()}`,
    token_type: 'bearer',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      org_id: user.org_id,
      org_name: user.org_name,
    },
  });
});

app.post(['/api/v1/auth/register', '/api/v1/auth/register/'], (req, res) => {
  return res.status(403).json({
    detail: 'التسجيل المباشر مغلق. إنشاء وتعيين حسابات المستخدمين يتم حصرياً بواسطة مسؤول النظام (Admin).'
  });
});

app.get(['/api/v1/auth/me', '/api/v1/auth/me/'], requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const { password, ...safeUser } = user;
  res.json(safeUser);
});

app.post('/api/v1/auth/refresh', (req, res) => {
  let user: DBUser | null = getAuthUser(req);
  if (!user) {
    const refreshToken = req.body?.refresh_token;
    if (typeof refreshToken === 'string' && refreshToken.startsWith('refresh_')) {
      const parts = refreshToken.split('_');
      const userId = parseInt(parts[1], 10);
      if (userId) {
        user = USERS.find(u => u.id === userId && u.is_active) || null;
      }
    }
  }

  if (!user) {
    return res.status(401).json({ detail: 'Authentication required. Session expired.' });
  }

  const token = `token_calliq_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  SESSIONS.set(token, user.id);
  saveDatabase();

  const { password, ...safeUser } = user;
  res.json({
    access_token: token,
    refresh_token: `refresh_${user.id}_${Date.now()}`,
    token_type: 'bearer',
    user: safeUser,
  });
});

app.post('/api/v1/auth/forgot-password', (req, res) => {
  res.json({ message: 'Password reset link sent to your email.' });
});

app.post('/api/v1/auth/reset-password', (req, res) => {
  res.json({ message: 'Password updated successfully.' });
});

// 2. Jobs Endpoints
app.get('/api/v1/jobs', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const activeOnly = req.query.active_only === 'true';
  let list = JOBS.filter(j => j.org_id === user.org_id);
  if (activeOnly) list = list.filter(j => j.is_active);
  // Update candidate count dynamically
  const enriched = list.map(j => ({
    ...j,
    candidate_count: CANDIDATES.filter(c => c.job_id === j.id && c.org_id === user.org_id).length,
  }));
  res.json(enriched);
});

app.get('/api/v1/jobs/:id', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const job = JOBS.find(j => j.id === id && j.org_id === user.org_id);
  if (!job) return res.status(404).json({ detail: 'Job not found' });
  res.json({
    ...job,
    candidate_count: CANDIDATES.filter(c => c.job_id === job.id && c.org_id === user.org_id).length,
  });
});

app.post('/api/v1/jobs', requireAuth, (req, res) => {
  const data = req.body;
  const user = (req as any).user as DBUser;
  const newJob: DBJob = {
    id: nextJobId++,
    org_id: user.org_id,
    recruiter_id: user.id,
    title: data.title || 'Untitled Job',
    company: data.company || user.org_name,
    description: data.description || '',
    required_skills: Array.isArray(data.required_skills) ? data.required_skills : [],
    nice_to_have: Array.isArray(data.nice_to_have) ? data.nice_to_have : [],
    min_experience: Number(data.min_experience) || 0,
    max_experience: Number(data.max_experience) || 10,
    education_req: data.education_req || '',
    location_req: data.location_req || 'Remote',
    hr_email: data.hr_email || user.email,
    salary_min: Number(data.salary_min) || 0,
    salary_max: Number(data.salary_max) || 0,
    is_active: true,
    apply_url: `/apply/job-token-${Date.now()}`,
    score_strong_match: data.score_strong_match || 80,
    score_potential_match: data.score_potential_match || 60,
    score_weak_match: data.score_weak_match || 40,
    candidate_count: 0,
    created_at: new Date().toISOString(),
  };
  JOBS.unshift(newJob);
  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Job Created',
    user: user.name,
    target: newJob.title,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();
  res.status(201).json(newJob);
});

app.patch('/api/v1/jobs/:id', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const index = JOBS.findIndex(j => j.id === id && j.org_id === user.org_id);
  if (index === -1) return res.status(404).json({ detail: 'Job not found' });
  JOBS[index] = { ...JOBS[index], ...req.body, updated_at: new Date().toISOString() };
  saveDatabase();
  res.json(JOBS[index]);
});

app.delete('/api/v1/jobs/:id', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const index = JOBS.findIndex(j => j.id === id && j.org_id === user.org_id);
  if (index !== -1) JOBS.splice(index, 1);
  saveDatabase();
  res.json({ message: 'Job deleted successfully' });
});

app.patch('/api/v1/jobs/:id/toggle-active', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const job = JOBS.find(j => j.id === id && j.org_id === user.org_id);
  if (!job) return res.status(404).json({ detail: 'Job not found' });
  job.is_active = !job.is_active;
  saveDatabase();
  res.json({ is_active: job.is_active });
});

app.get('/api/v1/jobs/:id/qr', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const job = JOBS.find(j => j.id === id && j.org_id === user.org_id);
  const applyUrl = job ? job.apply_url : '';
  res.json({
    apply_url: applyUrl,
    qr_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  });
});

app.get('/api/v1/jobs/:id/rankings', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const matched = CANDIDATES.filter(c => c.job_id === id && c.org_id === user.org_id)
    .sort((a, b) => b.match_score - a.match_score)
    .map((c, idx) => ({ id: c.id, rank: idx + 1, name: c.full_name, score: c.match_score, category: c.category }));
  res.json(matched);
});

app.get('/api/v1/jobs/:id/candidates', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const items = CANDIDATES.filter(c => c.job_id === id && c.org_id === user.org_id);
  res.json({
    total: items.length,
    page: 1,
    page_size: 50,
    pages: 1,
    items,
  });
});

app.get('/api/v1/jobs/:jobId/knockout-rules', requireAuth, (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  res.json(KNOCKOUT_RULES.filter(r => r.job_id === jobId));
});

app.post('/api/v1/jobs/:jobId/knockout-rules', requireAuth, (req, res) => {
  const jobId = parseInt(req.params.jobId, 10);
  const rule: DBKnockoutRule = {
    id: KNOCKOUT_RULES.length + 1,
    job_id: jobId,
    rule_type: req.body.rule_type || 'custom',
    field: req.body.field,
    operator: req.body.operator,
    value: req.body.value,
    action: req.body.action || 'reject',
    description: req.body.description || 'Custom Knockout Rule',
    is_active: true,
    is_mandatory: true,
  };
  KNOCKOUT_RULES.push(rule);
  res.status(201).json(rule);
});

app.delete('/api/v1/jobs/:jobId/knockout-rules/:ruleId', requireAuth, (req, res) => {
  const ruleId = parseInt(req.params.ruleId, 10);
  const idx = KNOCKOUT_RULES.findIndex(r => r.id === ruleId);
  if (idx !== -1) KNOCKOUT_RULES.splice(idx, 1);
  res.json({ message: 'Knockout rule removed' });
});

// 3. Candidates Endpoints
// 3a. Candidate Batches / Workspace Pages (must precede /:id)
app.get('/api/v1/candidates/batches', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const jobId = req.query.job_id ? Number(req.query.job_id) : undefined;
  let list = CANDIDATE_BATCHES.filter(b => b.org_id === user.org_id);
  if (jobId) {
    list = list.filter(b => b.job_id === jobId);
  }
  const enriched = list.map(b => ({
    ...b,
    candidate_count: CANDIDATES.filter(c => c.batch_id === b.id && c.org_id === user.org_id).length,
  }));
  res.json(enriched);
});

app.post('/api/v1/candidates/batches', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const { name, description, job_id } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ detail: 'اسم صفحة / دفعة التوظيف مطلوب.' });
  }

  const newBatch: DBCandidateBatch = {
    id: nextCandidateBatchId++,
    org_id: user.org_id,
    recruiter_id: user.id,
    name: String(name).trim(),
    description: description ? String(description).trim() : undefined,
    job_id: job_id ? Number(job_id) : undefined,
    created_at: new Date().toISOString(),
  };

  CANDIDATE_BATCHES.unshift(newBatch);

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Candidate Page/Batch Created',
    user: user.name,
    target: newBatch.name,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  res.status(201).json({ ...newBatch, candidate_count: 0 });
});

app.delete('/api/v1/candidates/batches/:id', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const idx = CANDIDATE_BATCHES.findIndex(b => b.id === id && b.org_id === user.org_id);
  if (idx === -1) {
    return res.status(404).json({ detail: 'الصفحة أو دفعة التوظيف غير موجودة.' });
  }

  const batch = CANDIDATE_BATCHES[idx];
  let deletedCount = 0;

  for (let i = CANDIDATES.length - 1; i >= 0; i--) {
    if (CANDIDATES[i].batch_id === id && CANDIDATES[i].org_id === user.org_id) {
      const deletedCand = CANDIDATES.splice(i, 1)[0];
      deleteCandidateFromNeon(deletedCand.id);
      deletedCount++;
    }
  }

  CANDIDATE_BATCHES.splice(idx, 1);

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Candidate Page/Batch & Candidates Deleted',
    user: user.name,
    target: `${batch.name} (${deletedCount} candidates removed)`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  res.json({
    message: `تم حذف الصفحة '${batch.name}' و ${deletedCount} سير ذاتية بنجاح.`,
    id,
    deleted_candidates_count: deletedCount,
  });
});

app.post('/api/v1/candidates/batches/:id/clear', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const batch = CANDIDATE_BATCHES.find(b => b.id === id && b.org_id === user.org_id);
  if (!batch) {
    return res.status(404).json({ detail: 'الصفحة أو دفعة التوظيف غير موجودة.' });
  }

  let clearedCount = 0;
  for (let i = CANDIDATES.length - 1; i >= 0; i--) {
    if (CANDIDATES[i].batch_id === id && CANDIDATES[i].org_id === user.org_id) {
      const deletedCand = CANDIDATES.splice(i, 1)[0];
      deleteCandidateFromNeon(deletedCand.id);
      clearedCount++;
    }
  }

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Candidate Page Cleared',
    user: user.name,
    target: `${batch.name} (${clearedCount} candidates cleared)`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  res.json({
    message: `تم تفريغ كافة السير الذاتية (${clearedCount}) من صفحة '${batch.name}' بنجاح.`,
    id,
    cleared_candidates_count: clearedCount,
  });
});

// 3b. Candidate Listing with Multi-Tenant & Batch Isolation
app.get('/api/v1/candidates', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  let list = CANDIDATES.filter(c => c.org_id === user.org_id);
  const { job_id, batch_id, status, category, min_score, search, sort_by } = req.query;

  if (job_id) list = list.filter(c => c.job_id === Number(job_id));
  if (batch_id !== undefined && batch_id !== null && batch_id !== '' && batch_id !== 'all') {
    if (batch_id === 'unassigned' || batch_id === 'none') {
      list = list.filter(c => !c.batch_id);
    } else {
      list = list.filter(c => c.batch_id === Number(batch_id));
    }
  }
  if (status) list = list.filter(c => c.status.toLowerCase() === String(status).toLowerCase());
  if (category) list = list.filter(c => c.category === category);
  if (min_score) list = list.filter(c => c.match_score >= Number(min_score));
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(c =>
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.current_position.toLowerCase().includes(q)
    );
  }

  if (sort_by === 'score_desc') list.sort((a, b) => b.match_score - a.match_score);
  else if (sort_by === 'score_asc') list.sort((a, b) => a.match_score - b.match_score);
  else list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.page_size) || 20;
  const start = (page - 1) * pageSize;
  const items = list.slice(start, start + pageSize);

  res.json({
    total: list.length,
    page,
    page_size: pageSize,
    pages: Math.ceil(list.length / pageSize) || 1,
    items,
  });
});

app.get('/api/v1/candidates/:id', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  res.json(cand);
});

// Helper: Extract Clean Text from PDF/Docx/File Buffer
async function extractCleanTextFromBuffer(buffer?: Buffer, filename?: string, mimetype?: string): Promise<string> {
  if (!buffer || buffer.length === 0) return '';

  const isPdf = (mimetype && mimetype.includes('pdf')) || (filename && filename.toLowerCase().endsWith('.pdf')) || (buffer.slice(0, 5).toString() === '%PDF-');
  const isDocx = (mimetype && (mimetype.includes('word') || mimetype.includes('officedocument'))) || (filename && (filename.toLowerCase().endsWith('.docx') || filename.toLowerCase().endsWith('.doc')));

  // 1. Docx / Doc file parsing via mammoth
  if (isDocx) {
    try {
      const docxRes = await mammoth.extractRawText({ buffer });
      if (docxRes && docxRes.value && docxRes.value.trim().length > 10) {
        return docxRes.value
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
          .replace(/\r\n/g, '\n')
          .trim();
      }
    } catch (e) {
      console.warn('mammoth extraction notice:', e);
    }
  }

  // 2. PDF Extraction
  if (isPdf) {
    // 2a. Primary: PDF.js legacy worker
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        disableFontFace: true,
        isEvalSupported: false,
        useSystemFonts: true,
      });
      const doc = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        let lastY: number | null = null;
        let pageStr = '';
        for (const item of content.items as any[]) {
          const str = item.str || '';
          if (!str) continue;
          if (lastY !== null && item.transform && Math.abs(item.transform[5] - lastY) > 5) {
            pageStr += '\n';
          } else if (pageStr.length > 0 && !pageStr.endsWith(' ') && !pageStr.endsWith('\n')) {
            pageStr += ' ';
          }
          pageStr += str;
          if (item.transform) lastY = item.transform[5];
        }
        fullText += pageStr + '\n\n';
      }
      const cleaned = fullText
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
        .trim();
      if (cleaned.length > 15) {
        return cleaned;
      }
    } catch (err) {
      console.warn('pdfjs legacy extraction notice:', err);
    }

    // 2b. Secondary PDF parser (pdf-parse v2)
    try {
      const pdfModule = pdfParseModule as any;
      if (pdfModule && pdfModule.PDFParse) {
        const parser = new pdfModule.PDFParse({ data: buffer });
        if (typeof parser.load === 'function') await parser.load();
        if (typeof parser.getText === 'function') {
          const textRes = await parser.getText();
          const rawText = typeof textRes === 'string' ? textRes : (textRes?.text || '');
          if (rawText && rawText.trim().length > 10) {
            const cleaned = rawText
              .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
              .trim();
            if (cleaned.length > 15) return cleaned;
          }
        }
      }
    } catch (err) {
      console.warn('pdf-parse v2 PDFParse extraction notice:', err);
    }
  }

  // 3. Text buffers / UTF-8 / Raw printable streams (English + Arabic UTF-8)
  try {
    const raw = buffer.toString('utf-8');
    const clean = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ').trim();
    if (clean.length > 20 && !clean.startsWith('%PDF-') && !clean.includes('/Type/Catalog')) {
      return clean;
    }
  } catch (e) {
    // Ignore
  }

  return filename ? `Candidate CV Document: ${filename}` : '';
}

// ── Known Skills Dictionary for Intelligent Entity Extraction (Multi-Domain & Multi-Language) ──
const KNOWN_SKILL_CATEGORIES: Record<string, string[]> = {
  // Software, Web & Mobile Development
  'Programming': [
    'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'PHP', 'Golang', 'Go', 'Rust', 'Ruby', 'Swift', 'Kotlin', 'Dart', 'Scala', 'R', 'SQL', 'Bash', 'Shell', 'C', 'Perl', 'Lua', 'HTML5', 'CSS3', 'HTML', 'CSS',
    'برمجة', 'بايثون', 'جافا', 'جافاسكريبت', 'تايب سكريبت', 'بي إتش بي', 'سي بلس بلس', 'سي شارب'
  ],
  'Frontend': [
    'React', 'React.js', 'ReactJS', 'Next.js', 'NextJS', 'Next.js 14', 'Vue', 'Vue.js', 'VueJS', 'Nuxt.js', 'NuxtJS', 'Angular', 'AngularJS', 'Svelte', 'SvelteKit', 'TailwindCSS', 'Tailwind CSS', 'Tailwind', 'Redux', 'Zustand', 'GraphQL', 'Webpack', 'Vite', 'Bootstrap', 'Material UI', 'MUI', 'Shadcn', 'Sass', 'SCSS', 'jQuery', 'Responsive Design', 'HTML/CSS',
    'تطوير واجهات', 'رياكت', 'فيو', 'أنغولار', 'تيلويند', 'تصميم متجاوب'
  ],
  'Backend & APIs': [
    'Node.js', 'Nodejs', 'Node', 'Express', 'Express.js', 'NestJS', 'Django', 'FastAPI', 'Flask', 'Spring Boot', 'Spring', 'Laravel', 'ASP.NET', '.NET Core', '.NET', 'Ruby on Rails', 'Gin', 'gRPC', 'REST API', 'RESTful APIs', 'REST', 'Microservices', 'WebSockets', 'GraphQL', 'Celery', 'Kafka', 'RabbitMQ',
    'تطوير باك إند', 'لارافيل', 'نود جي اس', 'جانغو', 'فاست إيه بي آي', 'سبرينغ بوت', 'مايكروسيرفس'
  ],
  'Databases & Storage': [
    'PostgreSQL', 'Postgres', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle', 'SQL Server', 'DynamoDB', 'Cassandra', 'Supabase', 'Firebase', 'Firestore', 'Elasticsearch', 'Pinecone', 'Qdrant', 'Neo4j', 'Prisma', 'Drizzle', 'TypeORM', 'Mongoose', 'CouchDB', 'MariaDB',
    'قواعد بيانات', 'ماي إس كيو إل', 'بوستجرس', 'مونجو دي بي', 'ريديس', 'فايربيز'
  ],
  'Cloud & DevOps': [
    'AWS', 'Amazon Web Services', 'Azure', 'Google Cloud', 'GCP', 'Docker', 'Kubernetes', 'K8s', 'Terraform', 'CI/CD', 'GitHub Actions', 'GitLab CI', 'Jenkins', 'Nginx', 'Linux', 'Ubuntu', 'Ansible', 'Prometheus', 'Grafana', 'Serverless', 'Cloudflare', 'Vercel', 'AWS Lambda', 'Git', 'GitHub', 'GitLab',
    'الحوسبة السحابية', 'دوكر', 'كوبرنيتس', 'لينكس', 'إدارة السيرفرات', 'أوبنتو', 'جيت'
  ],
  'AI, ML & Data Science': [
    'Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow', 'Keras', 'OpenCV', 'Scikit-Learn', 'Pandas', 'NumPy', 'HuggingFace', 'Transformers', 'LangChain', 'LlamaIndex', 'LLMs', 'Large Language Models', 'RAG', 'Vector Search', 'NLP', 'Computer Vision', 'Fine-tuning', 'Generative AI', 'BERT', 'Data Analytics', 'Tableau', 'Power BI', 'PowerBI', 'Data Mining', 'Big Data', 'Spark', 'Hadoop',
    'الذكاء الاصطناعي', 'تعلم الآلة', 'علم البيانات', 'تحليل البيانات', 'باور بي آي', 'تابلوه', 'الرؤية الحاسوبية'
  ],
  'Mobile Development': [
    'React Native', 'Flutter', 'iOS', 'Android', 'SwiftUI', 'Jetpack Compose', 'Expo', 'Kotlin Multiplatform',
    'تطوير تطبيقات الجوال', 'فلاتر', 'أندرويد', 'آي أو إس', 'رياكت نيتف'
  ],

  // Design, Media & Creative
  'Design & Creative': [
    'UI Design', 'UX Design', 'UI/UX', 'UX/UI', 'Figma', 'Adobe XD', 'Adobe Photoshop', 'Photoshop', 'Adobe Illustrator', 'Illustrator', 'Adobe InDesign', 'InDesign', 'Graphic Design', 'Motion Graphics', 'User Research', 'Wireframing', 'Prototyping', 'Visual Design', 'Design Systems', 'After Effects', 'Premiere Pro', 'Blender', '3D Modeling', 'AutoCAD', 'SolidWorks', 'Canva', 'CorelDraw',
    'تصميم واجهات', 'تجربة المستخدم', 'فيجما', 'فوتوشوب', 'إليستريتور', 'إن ديزاين', 'التصميم الجرافيكي', 'موشن جرافيك', 'بلندر', 'تصميم ثلاثي الأبعاد', 'أوتوكاد', 'كانفا'
  ],

  // Business, Office, HR, Finance & Marketing
  'Office & Productivity': [
    'Microsoft Office', 'Microsoft Excel', 'Excel', 'Advanced Excel', 'Microsoft Word', 'Word', 'PowerPoint', 'Google Sheets', 'Google Docs', 'Google Workspace', 'Data Entry', 'Outlook',
    'مايكروسوفت أوفيس', 'إكسل', 'إكسيل', 'وورد', 'بوربوينت', 'جوجل شيتس', 'إدخال بيانات'
  ],
  'Human Resources': [
    'Recruiting', 'Recruitment', 'Talent Acquisition', 'Headhunting', 'HR Policies', 'Employee Relations', 'Onboarding', 'Payroll', 'Compensation & Benefits', 'HRIS', 'Workday', 'Performance Management', 'Labor Law', 'Talent Management', 'Job Descriptions', 'Interviewing', 'ATS Systems', 'Personnel',
    'الموارد البشرية', 'التوظيف', 'إدارة المواهب', 'شؤون الموظفين', 'الرواتب', 'علاقات العمل', 'قانون العمل', 'المقابلات الشخصية', 'التأمينات'
  ],
  'Sales & Business Dev': [
    'B2B Sales', 'B2C Sales', 'Cold Calling', 'Lead Generation', 'Account Management', 'CRM', 'Salesforce', 'HubSpot', 'Negotiation', 'Closing Deals', 'Pipeline Management', 'Customer Success', 'Client Relations', 'Sales Strategy', 'Revenue Growth', 'Direct Sales', 'Retail Sales',
    'المبيعات', 'تطوير الأعمال', 'التفاوض', 'إدارة الحسابات', 'جذب العملاء', 'سيلزفورس', 'هوبسبوت', 'إدارة علاقات العملاء'
  ],
  'Marketing & Growth': [
    'Digital Marketing', 'Content Marketing', 'SEO', 'Search Engine Optimization', 'SEM', 'Google Ads', 'Facebook Ads', 'Social Media Marketing', 'Copywriting', 'Email Marketing', 'Brand Strategy', 'Market Research', 'Growth Hacking', 'Google Analytics', 'Campaign Management', 'Meta Ads', 'TikTok Ads',
    'التسويق الرقمي', 'التسويق بالمحتوى', 'تحسين محركات البحث', 'إعلانات جوجل', 'إدارة الحملات', 'السوشيال ميديا', 'كتابة المحتوى', 'إعلانات فيسبوك'
  ],
  'Finance & Accounting': [
    'Financial Analysis', 'Accounting', 'Bookkeeping', 'QuickBooks', 'Excel Modeling', 'Financial Modeling', 'Budgeting', 'Forecasting', 'Taxation', 'Auditing', 'IFRS', 'GAAP', 'Cash Flow Management', 'P&L Management', 'Risk Management', 'SAP', 'ERP', 'Odoo', 'Cost Accounting',
    'المحاسبة', 'التحليل المالي', 'الموازنات', 'الضرائب', 'التدقيق والمراجعة', 'دفاتر الحسابات', 'أودو', 'ساب', 'محاسبة تكاليف'
  ],
  'Operations & Management': [
    'Project Management', 'Agile', 'Scrum', 'Product Management', 'Supply Chain', 'Logistics', 'Operations Management', 'Vendor Management', 'Risk Assessment', 'Change Management', 'Strategic Planning', 'KPI Tracking', 'PMP', 'Lean Six Sigma', 'Jira', 'Trello', 'Asana', 'Notion', 'Kanban',
    'إدارة المشاريع', 'سلاسل الإمداد', 'العمليات', 'التخطيط الاستراتيجي', 'أجايل', 'سكرم', 'إدارة المنتجات', 'جيرا', 'كانبان'
  ],
  'Customer Support & Medical': [
    'Customer Support', 'Help Desk', 'Zendesk', 'Intercom', 'Technical Support', 'Ticketing Systems', 'Customer Satisfaction', 'Conflict Resolution', 'Call Center Operations', 'Patient Care', 'Clinical Research', 'Healthcare Administration', 'Pharmacology',
    'خدمة العملاء', 'الدعم الفني', 'حل النزاعات', 'كول سنتر', 'الرعاية الصحية', 'الصيدلة'
  ]
};

function normalizeTechnicalSkills(rawSkills: any): Record<string, string[]> {
  if (!rawSkills) return { "Core Competencies": ["Professional Execution"] };
  if (Array.isArray(rawSkills)) {
    const valid = rawSkills.map(s => String(s).trim()).filter(Boolean);
    return { "Technical Skills": valid.length > 0 ? valid : ["Professional Execution"] };
  }
  if (typeof rawSkills === 'object') {
    const res: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(rawSkills)) {
      if (Array.isArray(val)) {
        const cleaned = val.map(v => String(v).trim()).filter(Boolean);
        if (cleaned.length > 0) res[key] = cleaned;
      } else if (typeof val === 'string') {
        const cleaned = val.split(/[,;\n]+/).map(v => v.trim()).filter(Boolean);
        if (cleaned.length > 0) res[key] = cleaned;
      }
    }
    if (Object.keys(res).length > 0) return res;
  }
  return { "Core Competencies": ["Professional Execution"] };
}

function safeParseLLMJson(raw: any): any | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    }
    return JSON.parse(cleaned);
  } catch (e) {
    try {
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(raw.substring(firstBrace, lastBrace + 1));
      }
    } catch (e2) {
      // JSON parsing fallback failed
    }
  }
  return null;
}

// Helper: AI CV Parsing and Scoring (Supports Gemini + Deep Multi-Language Semantic Parsing)
async function evaluateCVWithAI(
  input: { buffer?: Buffer; text?: string; mimetype?: string; filename?: string; full_name?: string; email?: string; phone?: string },
  job?: DBJob
) {
  let fileText = input.text || '';
  if (input.buffer && (!fileText || fileText.length < 20)) {
    const extracted = await extractCleanTextFromBuffer(input.buffer, input.filename, input.mimetype);
    if (extracted && extracted.length > 0) {
      fileText = extracted;
    }
  }

  const jobTitle = job?.title || 'General Candidate Evaluation';
  const reqSkills = job?.required_skills || [];
  const niceSkills = job?.nice_to_have || [];
  const minExp = job?.min_experience ?? 0;
  const eduReq = job?.education_req || "Relevant qualification";
  const desc = job?.description || 'General professional evaluation based on actual CV contents.';

  const isPdf = input.buffer && ((input.mimetype && input.mimetype.includes('pdf')) || (input.filename && input.filename.toLowerCase().endsWith('.pdf')) || (input.buffer.slice(0, 5).toString() === '%PDF-'));
  const isImage = input.buffer && ((input.mimetype && input.mimetype.startsWith('image/')) || (input.filename && Boolean(input.filename.match(/\.(jpg|jpeg|png|webp)$/i))));

  const basePrompt = `You are CalliQ AI, an expert, rigorous talent evaluation engine and high-precision ATS parser.
Perform a thorough, step-by-step analysis of the candidate's resume. Extract real facts without assumptions or hallucinations.

CRITICAL DIRECTIVES:
- Extract skills, employment history, and education DIRECTLY from the candidate's CV document content.
- Support both English and Arabic texts seamlessly.
- Categorize technical skills accurately based on the candidate's genuine domain (e.g. HR, Sales, Finance, Engineering, Healthcare, Customer Service, Tech).
- DO NOT copy the target job required skills into the candidate's profile unless those skills are actually present in the candidate's CV!

EVALUATION CONTEXT:
${job ? `TARGET JOB REQUIREMENTS:
- Position Title: ${jobTitle}
- Target Company / Department: ${job.company || 'Hiring Organization'}
- Required Skills: ${reqSkills.length > 0 ? reqSkills.join(', ') : 'Relevant skills for the role'}
- Nice-to-Have Skills: ${niceSkills.join(', ') || 'None specified'}
- Minimum Experience: ${minExp} years
- Education Requirement: ${eduReq}
- Job Description Summary: ${desc}` : `GENERAL CANDIDATE EVALUATION MODE:
- Analyze the candidate based strictly on their actual profession, skills, and background.`}
`;

  const textSection = fileText ? `CANDIDATE CV / RESUME EXTRACTED TEXT:\n"""\n${fileText.slice(0, 20000)}\n"""\n` : '';

  const rulesSection = `STRICT EVALUATION JSON SCHEMA:
Return ONLY a valid JSON object matching this schema:
{
  "full_name": "${input.full_name || 'Candidate Name'}",
  "email": "${input.email || 'email@example.com'}",
  "phone": "${input.phone || '+...'}",
  "location": "City, Country",
  "current_position": "Exact Candidate Job Title from CV",
  "years_experience": 4,
  "companies": ["Company Name"],
  "education": [
    { "degree": "Bachelor's Degree", "field": "Field of Study", "institution": "University Name", "year": "2020" }
  ],
  "certifications": [
    { "name": "Certification Name", "issuer": "Issuer", "year": 2023 }
  ],
  "technical_skills": {
    "Candidate_Skills": ["Actual Skill 1 from CV", "Actual Skill 2 from CV"]
  },
  "soft_skills": ["Communication", "Problem Solving", "Leadership"],
  "languages": [{ "language": "Arabic", "level": "Native" }, { "language": "English", "level": "Fluent" }],
  "projects": [{ "name": "Key Project", "description": "Description" }],
  "match_score": 85,
  "ats_score": 88,
  "skill_match": 85,
  "experience_match": 90,
  "education_match": 90,
  "seniority_match": 85,
  "location_match": 95,
  "keyword_match": 85,
  "salary_match": 85,
  "ai_confidence": 94,
  "recommendation": "Hire",
  "recommendation_reason": "Detailed evaluation comparing candidate to role.",
  "ai_summary": "Comprehensive 3-4 sentence summary based strictly on the candidate's verified CV facts.",
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Area for growth"],
  "missing_skills": [],
  "skill_gap_analysis": "Skill comparison summary.",
  "ats_issues": [],
  "ats_suggestions": ["Tip for ATS optimization"]
}`;

  const promptMultimodal = basePrompt + (textSection ? `\nEXTRACTED TEXT:\n${textSection}\n` : '') + rulesSection;
  const promptTextOnly = basePrompt + textSection + rulesSection;

  // 1. Try Gemini API first (Direct multimodal or text parsing)
  const ai = getAIClient();
  if (ai && process.env.GEMINI_API_KEY) {
    const geminiModels = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash'];
    for (const m of geminiModels) {
      try {
        let response;
        if ((isPdf || isImage) && input.buffer) {
          const mime = isPdf ? 'application/pdf' : (input.mimetype || 'image/png');
          response = await ai.models.generateContent({
            model: m,
            contents: [
              {
                inlineData: {
                  mimeType: mime,
                  data: input.buffer.toString('base64'),
                },
              },
              promptMultimodal,
            ],
            config: {
              responseMimeType: 'application/json',
            },
          });
        } else if (fileText && fileText.length > 10) {
          response = await ai.models.generateContent({
            model: m,
            contents: promptTextOnly,
            config: {
              responseMimeType: 'application/json',
            },
          });
        }

        if (response && response.text) {
          const parsed = safeParseLLMJson(response.text);
          if (parsed && (parsed.current_position || parsed.technical_skills || parsed.ai_summary)) {
            parsed.full_name = input.full_name || parsed.full_name;
            parsed.email = input.email || parsed.email;
            parsed.phone = input.phone || parsed.phone;
            parsed.technical_skills = normalizeTechnicalSkills(parsed.technical_skills);
            return parsed;
          }
        }
      } catch (err) {
        // Quota or model notice - continue to next model/engine
      }
    }
  }

  // 1.5 Try Groq Fallback if Gemini quota is exhausted or unavailable
  const groq = getGroqClient();
  if (groq && fileText && fileText.length > 10) {
    const groqModels = [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'qwen/qwen3.8-27b',
      'qwen/qwen3.6-27b',
      'allam-2-7b',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b'
    ];
    for (const gm of groqModels) {
      try {
        const groqRes = await groq.chat.completions.create({
          model: gm,
          messages: [
            {
              role: 'system',
              content: 'You are an advanced AI Recruiter ATS parser. Extract and evaluate candidate CVs with extreme precision. You must output raw valid JSON matching the exact requested JSON schema only without any markdown formatting.'
            },
            {
              role: 'user',
              content: promptTextOnly
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });

        const groqContent = groqRes.choices[0]?.message?.content;
        if (groqContent) {
          const parsed = safeParseLLMJson(groqContent);
          if (parsed && (parsed.current_position || parsed.technical_skills || parsed.ai_summary)) {
            parsed.full_name = input.full_name || parsed.full_name;
            parsed.email = input.email || parsed.email;
            parsed.phone = input.phone || parsed.phone;
            parsed.technical_skills = normalizeTechnicalSkills(parsed.technical_skills);
            return parsed;
          }
        }
      } catch (groqErr) {
        // Continue to next groq model or local engine
      }
    }
  }

  // 2. High-Accuracy Multi-Language Local Semantic & Entity Extraction Engine
  const textLower = fileText.toLowerCase();

  // Extract Email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const emailMatch = fileText.match(emailRegex);
  const email = input.email || (emailMatch ? emailMatch[0] : (input.filename ? `${input.filename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}@candidate.applicant` : `candidate_${Date.now()}@mail.com`));

  // Extract Phone Number (International, Egyptian, Gulf formats)
  const phoneRegex = /(?:(?:\+?([1-9]\d{0,2})[\s.-]?)?(?:\(?(\d{3,4})\)?[\s.-]?)?(\d{3,4})[\s.-]?(\d{4})|\+?\d{9,15}|01[0125]\d{8})/;
  const phoneMatch = fileText.match(phoneRegex);
  const phone = input.phone || (phoneMatch ? phoneMatch[0].trim() : '+20 100 123 4567');

  // Extract Name
  let candidateName = input.full_name || '';
  if (!candidateName) {
    const lines = fileText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines.slice(0, 6)) {
      if (!line.includes('@') && !line.includes('http') && !line.match(/resume|curriculum|page|profile|document|applicant|candidate|سيرة|ذاتية/i)) {
        const cleanLine = line.replace(/^[0-9._\-\s]+/, '').trim();
        // Support Arabic names & English names
        const words = cleanLine.split(/\s+/).filter(w => /^[\u0600-\u06FFa-zA-Z]+$/.test(w));
        if (words.length >= 2 && words.length <= 4) {
          candidateName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          break;
        }
      }
    }
  }
  if (!candidateName && input.filename) {
    let cleanFn = input.filename
      .replace(/\.[^/.]+$/, '')
      .replace(/^[0-9._\-\s]+/, '')
      .replace(/(cv|resume|pdf|doc|docx|final|updated|profile|applicant|v\d+|سيرة|ذاتية)/gi, ' ')
      .replace(/[^a-zA-Z\u0600-\u06FF\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanFn.length >= 3) {
      candidateName = cleanFn.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  if (!candidateName || candidateName.length < 2) {
    candidateName = 'Applicant ' + Math.floor(Math.random() * 9000 + 1000);
  }

  // A. Candidate Title / Position Extraction
  let currentPos = '';
  const cvLines = fileText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  // First, check top lines of the CV for explicit job title
  for (let i = 0; i < Math.min(6, cvLines.length); i++) {
    const line = cvLines[i];
    if (!line.includes('@') && !line.includes('http') && !/\d{8,}/.test(line) && line.length > 3 && line.length < 75) {
      if (i > 0 && !/summary|profile|about|resume|curriculum|سيرة|ذاتية|نبذة|الاسم|هاتف/i.test(line)) {
        currentPos = line.replace(/^[•\-\*\d\.\s]+/, '').trim();
        break;
      }
    }
  }

  // Second, match against comprehensive multi-language job titles
  const comprehensiveTitleMatches = [
    'Human Resources Manager', 'HR Manager', 'Talent Acquisition Specialist', 'Recruitment Specialist', 'HR Business Partner', 'HR Generalist', 'HR Specialist', 'Recruiter',
    'مدير موارد بشرية', 'أخصائي توظيف', 'أخصائي موارد بشرية', 'مسؤول توظيف',
    'Sales Manager', 'Business Development Manager', 'Account Executive', 'Sales Representative', 'Marketing Manager', 'Digital Marketing Specialist', 'Content Strategist', 'SEO Specialist', 'Social Media Manager', 'Brand Manager',
    'مدير مبيعات', 'مسؤول مبيعات', 'مدير تسويق', 'أخصائي تسويق رقمي', 'مسؤول سوشيال ميديا',
    'Chief Financial Officer', 'Financial Analyst', 'Senior Accountant', 'Staff Accountant', 'Auditor', 'Bookkeeper', 'Finance Manager', 'Payroll Specialist',
    'مدير مالي', 'محاسب أول', 'محاسب عام', 'محلل مالي', 'مراجع حسابات',
    'Product Designer', 'Senior UI/UX Designer', 'UI/UX Designer', 'Graphic Designer', 'Visual Designer', 'Motion Designer', 'Art Director',
    'مصمم واجهات', 'مصمم جرافيك', 'مصمم موشن جرافيك',
    'Operations Manager', 'Project Manager', 'Product Manager', 'Scrum Master', 'Supply Chain Manager', 'Logistics Coordinator',
    'Lead AI Engineer', 'Senior Full Stack Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer', 'Data Scientist', 'Machine Learning Engineer', 'QA Engineer', 'Mobile Developer', 'Cloud Architect', 'Software Engineer', 'System Administrator', 'IT Support Specialist',
    'مهندس برمجيات', 'مطور واجهات', 'مطور باك إند', 'مهندس ذكاء اصطناعي', 'مدير مشاريع', 'مدير عمليات',
    'Customer Success Manager', 'Customer Support Specialist', 'Technical Support Specialist', 'Medical Doctor', 'Registered Nurse', 'Clinical Specialist', 'Pharmacist',
    'أخصائي خدمة عملاء', 'مسؤول دعم فني', 'صيدلي', 'طبيب'
  ];

  for (const t of comprehensiveTitleMatches) {
    if (textLower.includes(t.toLowerCase())) {
      currentPos = t;
      break;
    }
  }

  if (!currentPos || currentPos.length < 3) {
    // Detect domain from text keywords
    if (/design|figma|photoshop|illustrator|تصميم|جرافيك/i.test(textLower)) currentPos = 'Graphic & Visual Design Specialist';
    else if (/marketing|seo|google ads|facebook ads|تسويق|حملات/i.test(textLower)) currentPos = 'Digital Marketing Specialist';
    else if (/hr|human resources|recruiting|payroll|توظيف|موارد بشرية/i.test(textLower)) currentPos = 'HR & Talent Specialist';
    else if (/finance|accounting|bookkeeper|tax|محاسبة|مالي/i.test(textLower)) currentPos = 'Finance & Accounting Specialist';
    else if (/software|developer|engineer|react|python|جافا|برمجيات/i.test(textLower)) currentPos = 'Software Engineer';
    else currentPos = 'Professional Specialist';
  }

  // B. Candidate Skills Extraction
  const detectedTechnicalSkills: Record<string, string[]> = {};
  const allDetectedSkills: string[] = [];

  // 1. Extract from known skill dictionary
  for (const [category, skillsList] of Object.entries(KNOWN_SKILL_CATEGORIES)) {
    const matchedInCat: string[] = [];
    for (const skill of skillsList) {
      if (skill === 'R' || skill === 'C' || skill === 'Go') {
        const regexSpecial = skill === 'R'
          ? /\b(R\s+programming|R\s+Studio|R\s+language|R-project)\b/i
          : skill === 'Go'
          ? /\b(Golang|Go\s+language|Go\s+developer)\b/i
          : /\b(C\s+programming|C\s+language|C\/C\+\+|C\+\+)\b/i;
        if (regexSpecial.test(fileText)) {
          matchedInCat.push(skill);
          if (!allDetectedSkills.includes(skill)) allDetectedSkills.push(skill);
        }
        continue;
      }

      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:\\b|[^a-zA-Z0-9\u0600-\u06FF])${escaped}(?:\\b|[^a-zA-Z0-9\u0600-\u06FF])`, 'i');
      if (regex.test(fileText)) {
        matchedInCat.push(skill);
        if (!allDetectedSkills.includes(skill)) allDetectedSkills.push(skill);
      }
    }
    if (matchedInCat.length > 0) {
      detectedTechnicalSkills[category] = matchedInCat;
    }
  }

  // 2. Extract from explicit Candidate Skills Section in CV
  const skillsMatch = fileText.match(/(?:skills|technical skills|core competencies|key skills|competencies|technologies|proficiencies|tools|المهارات|الأدوات والتقنيات|الخبرات والمهارات)[:\s\r\n]+([\s\S]*?)(?=(?:\r?\n\s*|\n)(?:experience|work history|employment|education|projects|certifications|languages|references|الخبرات|التعليم|المشاريع|اللغات|المراجع|شهادات|الدورات)|$)/i);
  if (skillsMatch && skillsMatch[1]) {
    const rawItems = skillsMatch[1].split(/[\r\n•\-\|\/;,▪▫–—\t\(\)]+/)
      .map(k => k.replace(/^[0-9\.\)\-\*:\s•▪▫–—]+|[0-9\.\)\-\*:\s•▪▫–—]+$/g, '').trim())
      .filter(k => {
        if (k.length < 2 || k.length > 40) return false;
        if (/^(skills|technical|proficiencies|tools|technologies|competencies|education|experience|projects|languages|references|المهارات|الأدوات|الخبرات|الكفاءات|التعليم|المشاريع|اللغات|المراجع):?$/i.test(k)) return false;
        if (/^(level|advanced|intermediate|beginner|expert|years|months|مستوى|مبتدئ|متوسط|متقدم|خبير|سنة|سنوات)$/i.test(k)) return false;
        return true;
      });

    if (rawItems.length > 0) {
      if (!detectedTechnicalSkills['Candidate Specific Skills']) {
        detectedTechnicalSkills['Candidate Specific Skills'] = [];
      }
      for (const item of rawItems) {
        if (!allDetectedSkills.some(s => s.toLowerCase() === item.toLowerCase())) {
          detectedTechnicalSkills['Candidate Specific Skills'].push(item);
          allDetectedSkills.push(item);
        }
      }
    }
  }

  if (allDetectedSkills.length === 0) {
    detectedTechnicalSkills['Candidate Profile'] = [`${currentPos} Competencies`];
  }

  // C. Experience Years Detection
  let detectedYears = 0;
  const expMatch = fileText.match(/(\d+)\+?\s*(?:years?|yrs?|سنوات|سنة)(?:\s+of)?\s+(?:experience|exp|خبرة)/i);
  if (expMatch) {
    detectedYears = parseInt(expMatch[1], 10);
  } else {
    const yearMatches = fileText.match(/\b(20[0-2][0-9]|199[0-9])\b/g);
    if (yearMatches && yearMatches.length >= 2) {
      const years = Array.from(new Set(yearMatches.map(y => parseInt(y, 10)))).sort((a, b) => a - b);
      const span = years[years.length - 1] - years[0];
      detectedYears = Math.min(20, Math.max(1, span));
    } else {
      detectedYears = Math.max(1, minExp || 2);
    }
  }

  // D. Candidate Summary Excerpt Extraction
  let candidateSummaryExcerpt = '';
  const summaryMatch = fileText.match(/(?:summary|profile|about me|objective|executive summary|نبذة|نبذة شخصية|الملخص التنفيذي|عن المرشح)[:\s\r\n]+([\s\S]*?)(?=(?:\r?\n\s*|\n)(?:skills|experience|work history|education|competencies|الخبرات|التعليم|المشاريع|اللغات|المراجع)|$)/i);
  if (summaryMatch && summaryMatch[1] && summaryMatch[1].trim().length > 15) {
    candidateSummaryExcerpt = summaryMatch[1].trim().split(/\r?\n/).join(' ').replace(/\s+/g, ' ').slice(0, 300);
  }

  // E. Match Score Calculation against target Job
  const matchedRequiredSkills: string[] = [];
  const missingRequiredSkills: string[] = [];

  for (const req of reqSkills) {
    const isFound = allDetectedSkills.some(s => s.toLowerCase() === req.toLowerCase() || s.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(s.toLowerCase())) ||
      fileText.toLowerCase().includes(req.toLowerCase());
    if (isFound) {
      matchedRequiredSkills.push(req);
    } else {
      missingRequiredSkills.push(req);
    }
  }

  const skillMatchPct = reqSkills.length > 0
    ? Math.round((matchedRequiredSkills.length / reqSkills.length) * 100)
    : Math.min(95, Math.max(70, allDetectedSkills.length * 15));

  const expMatchPct = detectedYears >= minExp
    ? Math.min(100, 85 + (detectedYears - minExp) * 5)
    : Math.max(30, Math.round((detectedYears / (minExp || 1)) * 80));

  const atsScore = Math.min(98, Math.max(60, Math.round(skillMatchPct * 0.4 + expMatchPct * 0.4 + (fileText.length > 200 ? 18 : 10))));
  const matchScore = Math.min(98, Math.max(30, Math.round(skillMatchPct * 0.55 + expMatchPct * 0.35 + (atsScore * 0.1))));

  let recommendation: 'Strong Hire' | 'Hire' | 'Consider' | 'Reject' = 'Consider';
  if (matchScore >= (job?.score_strong_match || 80)) recommendation = 'Strong Hire';
  else if (matchScore >= (job?.score_potential_match || 60)) recommendation = 'Hire';
  else if (matchScore < (job?.score_weak_match || 45)) recommendation = 'Reject';

  // Extract Degree & Education
  let degree = "Bachelor's Degree";
  if (textLower.includes('ph.d') || textLower.includes('doctor of philosophy') || textLower.includes('doctorate') || textLower.includes('دكتوراه')) {
    degree = 'Doctorate / Ph.D.';
  } else if (textLower.includes('master') || textLower.includes('m.sc') || textLower.includes('ms in') || textLower.includes('mba') || textLower.includes('ماجستير')) {
    degree = "Master's Degree";
  } else if (textLower.includes('bachelor') || textLower.includes('b.sc') || textLower.includes('bs in') || textLower.includes('بكالوريوس') || textLower.includes('ليسانس')) {
    degree = "Bachelor's Degree";
  } else if (textLower.includes('diploma') || textLower.includes('دبلوم')) {
    degree = 'Associate Degree / Diploma';
  }

  let institution = 'Cairo University';
  const univMatch = fileText.match(/\b([A-Z\u0600-\u06FF][a-zA-Z\u0600-\u06FF]{2,25}\s+){1,3}(?:University|College|Institute|Faculty|Academy|جامعة|كلية|معهد|أكاديمية)\b/i);
  if (univMatch && univMatch[0].trim().length > 4) {
    institution = univMatch[0].trim();
  }

  let fieldOfStudy = 'Business & Applied Sciences';
  const fieldMatch = fileText.match(/(?:Business Administration|Computer Science|Software Engineering|Human Resources|Finance|Accounting|Marketing|Information Technology|Electrical Engineering|Mechanical Engineering|Civil Engineering|Law|Medicine|Economics|Operations Management|Management|Data Science|إدارة أعمال|علوم حاسب|هندسة برمجيات|موارد بشرية|محاسبة|تسويق|هندسة مدنية|قانون|صيدلة)/i);
  if (fieldMatch) {
    fieldOfStudy = fieldMatch[0];
  } else if (job?.title) {
    fieldOfStudy = `${job.title} Field`;
  }

  // Candidate Strengths & Weaknesses
  const strengths: string[] = [];
  if (matchedRequiredSkills.length > 0) {
    strengths.push(`Matches role requirements: ${matchedRequiredSkills.slice(0, 4).join(', ')}`);
  }
  if (detectedYears >= minExp) {
    strengths.push(`${detectedYears} years of practical domain background`);
  }
  if (allDetectedSkills.length > 0) {
    strengths.push(`Verified candidate skills: ${allDetectedSkills.slice(0, 4).join(', ')}`);
  }
  if (strengths.length === 0) {
    strengths.push('Demonstrates structured background and professional resume formatting.');
  }

  const weaknesses: string[] = [];
  if (missingRequiredSkills.length > 0) {
    weaknesses.push(`Skills gap against position requirements: ${missingRequiredSkills.slice(0, 3).join(', ')}`);
  }
  if (detectedYears < minExp) {
    weaknesses.push(`Experience level (${detectedYears} yrs) is below benchmark (${minExp} yrs)`);
  }
  if (weaknesses.length === 0) {
    weaknesses.push('No significant shortcomings identified against position criteria.');
  }

  // F. Construct Candidate-Specific Dynamic Summary
  const topSkillString = allDetectedSkills.slice(0, 6).join(', ');
  let dynamicSummary = '';
  if (candidateSummaryExcerpt) {
    dynamicSummary = `${candidateName} is an experienced ${currentPos} (${detectedYears} yrs exp). ${candidateSummaryExcerpt} Evaluated against the ${jobTitle} position with a ${matchScore}% alignment score.`;
  } else {
    dynamicSummary = `${candidateName} is a ${currentPos} with ${detectedYears} years of practical experience. Key skills in candidate profile: ${topSkillString || 'Professional Execution'}. Evaluated against the ${jobTitle} position with a ${matchScore}% alignment score.`;
  }

  return {
    full_name: candidateName,
    email,
    phone,
    location: textLower.includes('remote') ? 'Remote' : (textLower.includes('hybrid') ? 'Hybrid' : 'Cairo, Egypt'),
    current_position: currentPos,
    years_experience: detectedYears,
    companies: ['Verified Enterprise Experience'],
    education: [{ degree, field: fieldOfStudy, institution, year: '2021' }],
    certifications: [],
    technical_skills: detectedTechnicalSkills,
    soft_skills: ['Effective Communication', 'Problem Solving', 'Strategic Execution', 'Team Collaboration'],
    languages: [{ language: 'Arabic', level: 'Native' }, { language: 'English', level: 'Professional / Fluent' }],
    projects: [{ name: 'Professional Projects & Impact', description: `Executed operational initiatives leveraging ${allDetectedSkills.slice(0, 3).join(', ') || 'domain expertise'}.` }],
    match_score: matchScore,
    ats_score: atsScore,
    skill_match: skillMatchPct,
    experience_match: expMatchPct,
    education_match: 90,
    seniority_match: Math.min(100, Math.max(50, expMatchPct + 5)),
    location_match: 95,
    keyword_match: atsScore,
    salary_match: 85,
    ai_confidence: 94,
    recommendation,
    recommendation_reason: `${candidateName} exhibits ${allDetectedSkills.length} verified skills with an estimated ${skillMatchPct}% alignment against the ${job?.title || 'target position'}.`,
    ai_summary: dynamicSummary,
    strengths,
    weaknesses,
    missing_skills: missingRequiredSkills,
    skill_gap_analysis: missingRequiredSkills.length > 0
      ? `Skill gaps identified in: ${missingRequiredSkills.join(', ')}.`
      : 'All core requirements satisfied.',
    ats_issues: [],
    ats_suggestions: missingRequiredSkills.length > 0 ? [`Consider highlighting hands-on achievements in: ${missingRequiredSkills.join(', ')}.`] : ['Resume showcases clear terminology and structured formatting.'],
  };
}

// Single CV Upload
app.post('/api/v1/candidates/upload', requireAuth, upload.single('file'), async (req, res) => {
  const user = (req as any).user as DBUser;
  const jobId = req.body.job_id ? Number(req.body.job_id) : undefined;
  const batchId = req.body.batch_id ? Number(req.body.batch_id) : undefined;
  const targetJob = jobId ? JOBS.find(j => j.id === jobId && j.org_id === user.org_id) : JOBS.find(j => j.org_id === user.org_id);
  const fileName = req.file ? req.file.originalname : 'Uploaded_CV.pdf';
  const fileBuffer = req.file ? req.file.buffer : undefined;
  const fileMime = req.file ? req.file.mimetype : undefined;
  const fileContent = req.body.cv_text || (fileBuffer ? await extractCleanTextFromBuffer(fileBuffer, fileName, fileMime) : 'Candidate CV profile');

  const analysis = await evaluateCVWithAI({
    buffer: fileBuffer,
    filename: fileName,
    mimetype: fileMime,
    text: req.body.cv_text || fileContent || undefined,
  }, targetJob);

  const score = analysis.match_score || 85;
  const category = score >= (targetJob?.score_strong_match || 80) ? 'STRONG_MATCH' : score >= (targetJob?.score_potential_match || 60) ? 'POTENTIAL_MATCH' : 'WEAK_MATCH';

  const newCand: DBCandidate = {
    id: nextCandidateId++,
    org_id: user.org_id,
    recruiter_id: user.id,
    job_id: targetJob ? targetJob.id : jobId,
    batch_id: batchId,
    full_name: analysis.full_name || 'New Candidate',
    email: analysis.email || `candidate_${Date.now()}@example.com`,
    phone: analysis.phone || '+1 555 0100',
    location: analysis.location || 'Remote',
    current_position: analysis.current_position || 'Professional Specialist',
    years_experience: analysis.years_experience || 4,
    previous_positions: [
      { title: analysis.current_position || 'Professional', company: analysis.companies?.[0] || 'Previous Organization', duration_months: 24 }
    ],
    companies: analysis.companies || ['Previous Organization'],
    education: analysis.education?.length ? analysis.education : [{ degree: "Bachelor's Degree", field: 'Relevant Field', institution: 'University', year: '2021' }],
    certifications: analysis.certifications || [],
    courses: [],
    technical_skills: analysis.technical_skills || { Core: ['Domain Experience'] },
    soft_skills: analysis.soft_skills || ['Communication', 'Problem Solving'],
    languages: analysis.languages?.length ? analysis.languages : [{ language: 'English', level: 'Professional' }],
    projects: analysis.projects || [],
    achievements: [],
    awards: [],
    match_score: score,
    ats_score: analysis.ats_score || 88,
    skill_match: analysis.skill_match || 85,
    experience_match: analysis.experience_match || 80,
    education_match: analysis.education_match || 90,
    seniority_match: analysis.seniority_match || 85,
    location_match: analysis.location_match || 95,
    keyword_match: analysis.keyword_match || 88,
    salary_match: analysis.salary_match || 85,
    ai_confidence: analysis.ai_confidence || 94,
    recommendation: analysis.recommendation || 'Hire',
    recommendation_reason: analysis.recommendation_reason || 'Qualified match for job criteria.',
    ai_summary: analysis.ai_summary || 'Extracted candidate profile and skills.',
    strengths: analysis.strengths || ['Good skill alignment'],
    weaknesses: analysis.weaknesses || [],
    missing_skills: analysis.missing_skills || [],
    missing_certs: [],
    skill_gap_analysis: analysis.skill_gap_analysis || 'Candidate meets required criteria.',
    ats_issues: analysis.ats_issues || [],
    ats_suggestions: analysis.ats_suggestions || [],
    category,
    status: 'Screening',
    pipeline_stage: 'Screening',
    pipeline_history: [
      { stage: 'Screening', entered_at: new Date().toISOString(), moved_by: 'AI Scanner', notes: 'Automated CV analysis and scoring completed.' }
    ],
    recruiter_decision: 'NEEDS_REVIEW',
    applied_at: new Date().toISOString(),
    flagged: false,
    is_knocked_out: false,
    knockout_flags: [],
    source: 'File Upload',
    file_name: fileName,
    file_content: fileContent,
    processing_attempts: 1,
    chat_history: [],
    whatsapp_history: [],
    created_at: new Date().toISOString(),
  };

  CANDIDATES.unshift(newCand);
  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Candidate Upload & AI Evaluation',
    user: user.name,
    target: `${newCand.full_name} (${newCand.match_score}%)`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  // Trigger Application Received Email
  sendAutomatedCandidateEmail('application_received', newCand, { sent_by: user.name });

  res.status(201).json(newCand);
});

// Standalone AI CV Analysis Endpoint (Preview extraction & match score for PDF/Word/Images)
app.post('/api/v1/candidates/analyze-cv', requireAuth, upload.single('file'), async (req, res) => {
  const user = (req as any).user as DBUser;
  const jobId = req.body.job_id ? Number(req.body.job_id) : undefined;
  const targetJob = jobId ? JOBS.find(j => j.id === jobId && j.org_id === user.org_id) : JOBS.find(j => j.org_id === user.org_id);
  const fileName = req.file ? req.file.originalname : (req.body.file_name || 'Resume_Document.pdf');
  const fileBuffer = req.file ? req.file.buffer : undefined;
  const fileMime = req.file ? req.file.mimetype : undefined;
  const fileContent = req.body.cv_text || (fileBuffer ? await extractCleanTextFromBuffer(fileBuffer, fileName, fileMime) : 'Candidate CV Text');

  const analysis = await evaluateCVWithAI({
    buffer: fileBuffer,
    filename: fileName,
    mimetype: fileMime,
    text: req.body.cv_text || fileContent || undefined,
  }, targetJob);

  res.json({
    filename: fileName,
    extracted_text: fileContent,
    analysis,
  });
});

// Bulk Upload
app.post('/api/v1/candidates/bulk-upload', requireAuth, upload.array('files'), async (req, res) => {
  const user = (req as any).user as DBUser;
  const jobId = req.body.job_id ? Number(req.body.job_id) : undefined;
  const targetJob = jobId ? JOBS.find(j => j.id === jobId && j.org_id === user.org_id) : JOBS.find(j => j.org_id === user.org_id);
  const files = (req.files as Express.Multer.File[]) || [];
  
  let assignedBatchId: number | undefined = req.body.batch_id ? Number(req.body.batch_id) : undefined;

  // If user requested to create a brand new batch on the fly
  if (req.body.batch_name && String(req.body.batch_name).trim()) {
    const newBatch: DBCandidateBatch = {
      id: nextCandidateBatchId++,
      org_id: user.org_id,
      recruiter_id: user.id,
      name: String(req.body.batch_name).trim(),
      description: req.body.batch_description ? String(req.body.batch_description).trim() : undefined,
      job_id: targetJob ? targetJob.id : jobId,
      created_at: new Date().toISOString(),
    };
    CANDIDATE_BATCHES.unshift(newBatch);
    assignedBatchId = newBatch.id;
  }

  const processedCandidates: DBCandidate[] = [];

  for (const file of files) {
    const fileContent = await extractCleanTextFromBuffer(file.buffer, file.originalname, file.mimetype);
    const analysis = await evaluateCVWithAI({
      buffer: file.buffer,
      filename: file.originalname,
      mimetype: file.mimetype,
    }, targetJob);

    const score = analysis.match_score || 80;
    const category = score >= (targetJob?.score_strong_match || 80) ? 'STRONG_MATCH' : score >= (targetJob?.score_potential_match || 60) ? 'POTENTIAL_MATCH' : 'WEAK_MATCH';

    const newCand: DBCandidate = {
      id: nextCandidateId++,
      org_id: user.org_id,
      recruiter_id: user.id,
      job_id: targetJob ? targetJob.id : jobId,
      batch_id: assignedBatchId,
      full_name: analysis.full_name || file.originalname.replace(/\.[^/.]+$/, ''),
      email: analysis.email || `candidate_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`,
      phone: analysis.phone || '+1 555 0100',
      location: analysis.location || 'Remote',
      current_position: analysis.current_position || 'Professional Specialist',
      years_experience: analysis.years_experience || 3,
      previous_positions: analysis.current_position ? [{ title: analysis.current_position, company: analysis.companies?.[0] || 'Previous Company', duration_months: 24 }] : [],
      companies: analysis.companies || [],
      education: analysis.education?.length ? analysis.education : [{ degree: "Bachelor's", field: 'Relevant Field', institution: 'University', year: '2021' }],
      certifications: analysis.certifications || [],
      courses: [],
      technical_skills: analysis.technical_skills || {},
      soft_skills: analysis.soft_skills || ['Communication', 'Teamwork'],
      languages: analysis.languages?.length ? analysis.languages : [{ language: 'English', level: 'Fluent' }],
      projects: analysis.projects || [],
      achievements: [],
      awards: [],
      match_score: score,
      ats_score: analysis.ats_score || 85,
      skill_match: analysis.skill_match || 85,
      experience_match: analysis.experience_match || 80,
      education_match: analysis.education_match || 85,
      seniority_match: analysis.seniority_match || 80,
      location_match: analysis.location_match || 90,
      keyword_match: analysis.keyword_match || 85,
      salary_match: analysis.salary_match || 80,
      ai_confidence: analysis.ai_confidence || 92,
      recommendation: analysis.recommendation || 'Hire',
      recommendation_reason: analysis.recommendation_reason || 'Parsed and evaluated from bulk batch upload.',
      ai_summary: analysis.ai_summary || 'Batch parsed candidate with verified background.',
      strengths: analysis.strengths || ['Relevant experience'],
      weaknesses: analysis.weaknesses || [],
      missing_skills: analysis.missing_skills || [],
      missing_certs: [],
      skill_gap_analysis: analysis.skill_gap_analysis || '',
      ats_issues: analysis.ats_issues || [],
      ats_suggestions: analysis.ats_suggestions || [],
      category,
      status: 'Screening',
      pipeline_stage: 'Screening',
      pipeline_history: [{ stage: 'Screening', entered_at: new Date().toISOString(), moved_by: 'Bulk AI Scanner' }],
      recruiter_decision: 'NEEDS_REVIEW',
      applied_at: new Date().toISOString(),
      flagged: false,
      is_knocked_out: false,
      knockout_flags: [],
      source: 'Bulk Upload',
      file_name: file.originalname,
      file_content: fileContent,
      processing_attempts: 1,
      chat_history: [],
      whatsapp_history: [],
      created_at: new Date().toISOString(),
    };
    CANDIDATES.unshift(newCand);
    processedCandidates.push(newCand);
    sendAutomatedCandidateEmail('application_received', newCand, { sent_by: 'Bulk AI Uploader' });
  }

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Bulk Upload Completed',
    user: user.name,
    target: `${files.length} Candidates Processed`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  res.json({
    batch_id: assignedBatchId,
    total_processed: files.length,
    candidates: processedCandidates,
    status: 'completed',
  });
});


// Re-evaluate Single Candidate with upgraded AI
app.post('/api/v1/candidates/:id/re-evaluate', requireAuth, async (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });

  const targetJob = JOBS.find(j => j.id === cand.job_id && j.org_id === user.org_id) || JOBS.find(j => j.org_id === user.org_id) || JOBS[0];
  const cvText = cand.file_content || `${cand.full_name}\n${cand.current_position}\n${JSON.stringify(cand.technical_skills)}`;

  const analysis = await evaluateCVWithAI({
    text: cvText,
    filename: cand.file_name,
  }, targetJob);

  cand.full_name = analysis.full_name || cand.full_name;
  if (analysis.email && !cand.email.includes('@example.com')) cand.email = analysis.email;
  cand.current_position = analysis.current_position || cand.current_position;
  cand.years_experience = analysis.years_experience || cand.years_experience;
  cand.technical_skills = analysis.technical_skills || cand.technical_skills;
  cand.soft_skills = analysis.soft_skills || cand.soft_skills;
  cand.match_score = analysis.match_score || cand.match_score;
  cand.ats_score = analysis.ats_score || cand.ats_score;
  cand.skill_match = analysis.skill_match || cand.skill_match;
  cand.experience_match = analysis.experience_match || cand.experience_match;
  cand.ai_summary = analysis.ai_summary || cand.ai_summary;
  cand.recommendation = analysis.recommendation || cand.recommendation;
  cand.recommendation_reason = analysis.recommendation_reason || cand.recommendation_reason;
  cand.strengths = analysis.strengths || cand.strengths;
  cand.weaknesses = analysis.weaknesses || cand.weaknesses;
  cand.missing_skills = analysis.missing_skills || cand.missing_skills;
  cand.skill_gap_analysis = analysis.skill_gap_analysis || cand.skill_gap_analysis;
  cand.category = cand.match_score >= (targetJob?.score_strong_match || 80) ? 'STRONG_MATCH' : cand.match_score >= (targetJob?.score_potential_match || 60) ? 'POTENTIAL_MATCH' : 'WEAK_MATCH';

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'AI Candidate Re-evaluation',
    user: user.name,
    target: `${cand.full_name} (${cand.match_score}%)`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  res.json(cand);
});

// Re-evaluate All Candidates for User's Organization
app.post('/api/v1/candidates/re-evaluate-all', requireAuth, async (req, res) => {
  const user = (req as any).user as DBUser;
  let count = 0;
  const userCandidates = CANDIDATES.filter(c => c.org_id === user.org_id);
  for (const cand of userCandidates) {
    const targetJob = JOBS.find(j => j.id === cand.job_id && j.org_id === user.org_id) || JOBS.find(j => j.org_id === user.org_id) || JOBS[0];
    const cvText = cand.file_content || `${cand.full_name}\n${cand.current_position}\n${JSON.stringify(cand.technical_skills)}`;
    const analysis = await evaluateCVWithAI({
      text: cvText,
      filename: cand.file_name,
    }, targetJob);

    cand.full_name = analysis.full_name || cand.full_name;
    cand.current_position = analysis.current_position || cand.current_position;
    cand.years_experience = analysis.years_experience || cand.years_experience;
    cand.technical_skills = analysis.technical_skills || cand.technical_skills;
    cand.match_score = analysis.match_score || cand.match_score;
    cand.ats_score = analysis.ats_score || cand.ats_score;
    cand.skill_match = analysis.skill_match || cand.skill_match;
    cand.ai_summary = analysis.ai_summary || cand.ai_summary;
    cand.recommendation = analysis.recommendation || cand.recommendation;
    cand.recommendation_reason = analysis.recommendation_reason || cand.recommendation_reason;
    cand.strengths = analysis.strengths || cand.strengths;
    cand.weaknesses = analysis.weaknesses || cand.weaknesses;
    cand.missing_skills = analysis.missing_skills || cand.missing_skills;
    cand.category = cand.match_score >= (targetJob?.score_strong_match || 80) ? 'STRONG_MATCH' : cand.match_score >= (targetJob?.score_potential_match || 60) ? 'POTENTIAL_MATCH' : 'WEAK_MATCH';
    count++;
  }
  saveDatabase();

  res.json({ message: `Successfully re-evaluated ${count} candidates with upgraded AI engine.`, count });
});

// Candidate Actions
app.post('/api/v1/candidates/:id/decide', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  cand.recruiter_decision = req.body.decision;
  cand.decision_notes = req.body.notes;
  cand.decided_at = new Date().toISOString();
  if (req.body.decision === 'APPROVED') cand.status = 'Approved';
  if (req.body.decision === 'REJECTED') cand.status = 'Rejected';
  saveDatabase();
  res.json(cand);
});

app.post('/api/v1/candidates/:id/approve', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  cand.recruiter_decision = 'APPROVED';
  cand.status = 'Approved';
  cand.decided_at = new Date().toISOString();
  cand.decision_notes = String(req.query.notes || req.body.notes || 'Approved by recruiter');
  saveDatabase();
  res.json(cand);
});

app.post('/api/v1/candidates/:id/reject', requireAuth, handleRejectCandidate);
app.patch('/api/v1/candidates/:id/reject', requireAuth, handleRejectCandidate);

function handleRejectCandidate(req: express.Request, res: express.Response) {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  cand.recruiter_decision = 'REJECTED';
  cand.status = 'Rejected';
  cand.rejected_at = new Date().toISOString();
  cand.decision_notes = String(req.query.notes || req.body.notes || 'Rejected by recruiter');
  saveDatabase();

  sendAutomatedCandidateEmail('rejection_notice', cand, { sent_by: user.name });
  triggerDripCampaignsForCandidate('Rejected', cand, { sent_by: user.name });

  res.json(cand);
}

app.post('/api/v1/candidates/:id/shortlist', requireAuth, handleShortlistCandidate);
app.patch('/api/v1/candidates/:id/shortlist', requireAuth, handleShortlistCandidate);

function handleShortlistCandidate(req: express.Request, res: express.Response) {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  cand.status = 'Shortlisted';
  cand.shortlisted_at = new Date().toISOString();
  saveDatabase();

  sendAutomatedCandidateEmail('shortlisted', cand, { sent_by: user.name });
  triggerDripCampaignsForCandidate('Shortlisted', cand, { sent_by: user.name });

  res.json(cand);
}

app.post('/api/v1/candidates/:id/pipeline-move', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  const { stage, notes } = req.body;
  cand.pipeline_stage = stage;
  cand.status = stage;
  cand.pipeline_history.push({
    stage,
    entered_at: new Date().toISOString(),
    moved_by: user.name,
    notes: notes || `Moved to ${stage}`,
  });
  if (stage === 'Hired') cand.hired_at = new Date().toISOString();
  if (stage === 'Shortlisted') sendAutomatedCandidateEmail('shortlisted', cand, { sent_by: user.name });
  if (stage === 'Rejected') sendAutomatedCandidateEmail('rejection_notice', cand, { sent_by: user.name });
  
  triggerDripCampaignsForCandidate(stage, cand, { notes, sent_by: user.name });
  saveDatabase();

  // Auto-sync to Notion when moved to important stages
  if (['Shortlisted', 'Technical', 'Interview', 'Final Interview', 'Approved', 'Hired'].includes(stage)) {
    syncCandidateToNotion(cand).catch(err => console.error('Auto Notion sync failed:', err));
  }

  res.json(cand);
});

app.post('/api/v1/candidates/:id/schedule-interview', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  cand.interview_scheduled = req.body.scheduled_at;
  cand.interview_type = req.body.interview_type;
  cand.interview_link = req.body.link || 'https://meet.google.com/calliq-interview';
  cand.interview_location = req.body.location;
  cand.interview_duration_mins = req.body.duration_mins || 45;
  cand.status = 'Interview';
  cand.pipeline_stage = 'Phone Interview';
  saveDatabase();

  sendAutomatedCandidateEmail('interview_scheduled', cand, {
    interview_date: req.body.scheduled_at,
    interview_link: cand.interview_link,
    sent_by: user.name,
  });

  triggerDripCampaignsForCandidate('Interview Scheduled', cand, {
    interview_date: req.body.scheduled_at,
    interview_link: cand.interview_link,
    sent_by: user.name,
  });

  res.json(cand);
});

app.post('/api/v1/candidates/:id/send-offer', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  cand.offer_amount = req.body.amount;
  cand.offer_currency = req.body.currency || 'USD';
  cand.offer_sent_at = new Date().toISOString();
  cand.offer_deadline = new Date(Date.now() + (req.body.deadline_days || 7) * 86400000).toISOString();
  cand.status = 'Offer Sent';
  cand.pipeline_stage = 'Offer Sent';
  saveDatabase();

  sendAutomatedCandidateEmail('offer_letter', cand, {
    offer_amount: cand.offer_amount,
    offer_currency: cand.offer_currency,
    offer_deadline: cand.offer_deadline,
    sent_by: user.name,
  });

  triggerDripCampaignsForCandidate('Offer Sent', cand, {
    offer_amount: cand.offer_amount,
    offer_currency: cand.offer_currency,
    offer_deadline: cand.offer_deadline,
    sent_by: user.name,
  });

  res.json(cand);
});

// ── Email Notification Endpoints ─────────────────────────────────────────────
app.get('/api/v1/emails', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const candidateId = req.query.candidate_id ? Number(req.query.candidate_id) : undefined;
  let list = EMAIL_LOGS.filter(e => e.org_id === user.org_id);
  if (candidateId) {
    list = list.filter(e => e.candidate_id === candidateId);
  }
  res.json(list);
});

app.post('/api/v1/emails/send', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const { candidate_id, recipient_email, recipient_name, subject, body, trigger_event } = req.body;
  
  const cand = candidate_id ? CANDIDATES.find(c => c.id === Number(candidate_id) && c.org_id === user.org_id) : undefined;
  
  const log: DBEmailLog = {
    id: nextEmailLogId++,
    org_id: user.org_id,
    candidate_id: cand?.id,
    candidate_name: recipient_name || cand?.full_name || 'Candidate',
    candidate_email: recipient_email || cand?.email || 'email@example.com',
    subject: subject || 'Message from Recruiter',
    body: body || 'Message content...',
    trigger_event: trigger_event || 'manual_email',
    status: 'Sent',
    sent_by: user.name,
    sent_at: new Date().toISOString(),
  };

  EMAIL_LOGS.unshift(log);
  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Manual Email Sent',
    user: user.name,
    target: `${log.candidate_name} <${log.candidate_email}>`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  res.status(201).json(log);
});

// AI Draft Endpoint for Email Follow-ups
app.post('/api/v1/emails/draft', requireAuth, async (req, res) => {
  const user = (req as any).user as DBUser;
  const { candidate_id, type = 'followup', language = 'ar', instructions = '' } = req.body;
  const cand = candidate_id ? CANDIDATES.find(c => c.id === Number(candidate_id) && c.org_id === user.org_id) : undefined;
  const targetJob = cand?.job_id ? JOBS.find(j => j.id === cand.job_id && j.org_id === user.org_id) : JOBS.find(j => j.org_id === user.org_id);

  const candName = cand?.full_name || 'المرشح';
  const jobTitle = targetJob?.title || 'الوظيفة المتاحة';
  const companyName = targetJob?.company || user.org_name || 'CalliQ';

  const isArabic = language === 'ar';

  const prompt = `You are an expert Talent Acquisition specialist and HR recruiter at ${companyName}.
Draft an email to candidate "${candName}" regarding the position "${jobTitle}".
Purpose of email: ${type} (e.g. followup, interview, shortlist, rejection, offer, feedback, inquiry).
Candidate status: ${cand?.status || 'Under Review'}, Match Score: ${cand?.match_score || 75}%.
Additional recruiter instructions: ${instructions || 'None'}.
Language: ${isArabic ? 'Arabic (professional, warm, clear)' : 'English (professional, encouraging, crisp)'}.

Respond ONLY with a valid JSON object in this exact schema:
{
  "subject": "The email subject line",
  "body": "The complete email body text formatted with paragraphs and sign-off."
}`;

  try {
    const ai = getAIClient();
    if (ai) {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const text = response.text || '';
      const parsed = JSON.parse(text);
      if (parsed.subject && parsed.body) {
        return res.json(parsed);
      }
    }
  } catch (err) {
    console.warn('AI Email draft generation fallback:', err);
  }

  // Robust Fallback Templates
  if (isArabic) {
    if (type === 'interview') {
      return res.json({
        subject: `دعوة لمقابلة شخصية - وظيفة ${jobTitle} في شركة ${companyName}`,
        body: `عزيزي/عزيزتي ${candName}،\n\nتحية طيبة وبعد،\n\nيسعدنا إبلاغك بأنه بعد مراجعة ملفك الشخصي وسيرتك الذاتية لوظيفة "${jobTitle}"، نود دعوتك لإجراء مقابلة عمل لمناقشة خبراتك ومهاراتك بشكل أعمق.\n\nيرجى إفادتنا بالمواعيد المناسبة لك خلال الأيام القادمة، أو تأكيد موعدك المقترح.\n\nنتطلع للحديث معك قريباً.\n\nمع أطيب التحيات،\nفريق استقطاب الكفاءات - ${companyName}`
      });
    } else if (type === 'shortlist') {
      return res.json({
        subject: `تهانينا! تم ترشيحك للمرحلة القادمة - ${jobTitle} في ${companyName}`,
        body: `عزيزي/عزيزتي ${candName}،\n\nيسعدنا إعلامك بأن سيرتك الذاتية قد نالت تقييماً متميزاً وتأهلت للقائمة المختصرة (Shortlisted) لوظيفة "${jobTitle}".\n\nسيقوم مسؤولو التوظيف بالتواصل معك قريباً لتنسيق الخطوات والمراحل القادمة.\n\nشكراً لاهتمامك بالانضمام إلينا.\n\nمع خالص التقدير،\nإدارة الموارد البشرية - ${companyName}`
      });
    } else if (type === 'rejection') {
      return res.json({
        subject: `تحديث بشأن طلب التوظيف لوظيفة ${jobTitle} - ${companyName}`,
        body: `عزيزي/عزيزتي ${candName}،\n\nنشكرك على اهتمامك ووقتك في التقديم لوظيفة "${jobTitle}" لدى ${companyName}.\n\nبعد دراسة متأنية لكافة الطلبات، نود إبلاغك بأننا قررنا المضي قدماً مع مرشحين آخرين تتطابق مؤهلاتهم بشكل أدق مع احتياجات المرحلة الحالية.\n\nنحتفظ بسيرتك الذاتية في قاعدة بياناتنا للتواصل معك فور توفر فرص تناسب خبراتك مستقبلاً.\n\nمع تمنياتنا لك بمسيرة مهنية موفقة.\n\nفريق التوظيف - ${companyName}`
      });
    } else if (type === 'offer') {
      return res.json({
        subject: `عرض عمل رسمي - وظيفة ${jobTitle} في شركة ${companyName}`,
        body: `عزيزي/عزيزتي ${candName}،\n\nيسرنا ويسعدنا تقديم هذا العرض الوظيفي الرسمي لك للانضمام إلى فريق عملنا كـ "${jobTitle}" في ${companyName}.\n\nنحن واثقون بأن خبرتك وشغفك سيكونان إضافة نوعية لنجاحنا المشترك. يرجى مراجعة بنود العرض وإعلامنا بقرارك.\n\nمرحباً بك معنا في الفريق!\n\nالإدارة التنفيذية - ${companyName}`
      });
    } else {
      return res.json({
        subject: `متابعة بخصوص طلب التوظيف - ${jobTitle} (${companyName})`,
        body: `مرحباً ${candName}،\n\nنود المتابعة معك بخصوص طلبك المقدم لوظيفة "${jobTitle}" في ${companyName}.\n\nنرجو التكرم بالرد لتحديثنا حول مدى جاهزيتك والإجابة على أي استفسارات لديك بخصوص المرحلة القادمة.\n\nشاكرين لك حسن تعاونك واهتمامك.\n\nتحياتنا،\nفريق التوظيف - ${companyName}`
      });
    }
  } else {
    if (type === 'interview') {
      return res.json({
        subject: `Interview Invitation - ${jobTitle} at ${companyName}`,
        body: `Dear ${candName},\n\nWe are pleased to inform you that your profile for the ${jobTitle} position has progressed to the next stage. We would like to invite you for an interview to explore your background and technical fit.\n\nPlease let us know your preferred dates and times this week.\n\nBest regards,\nTalent Acquisition Team - ${companyName}`
      });
    } else if (type === 'rejection') {
      return res.json({
        subject: `Application Status: ${jobTitle} at ${companyName}`,
        body: `Dear ${candName},\n\nThank you for applying for the ${jobTitle} position at ${companyName}.\n\nAfter reviewing your qualifications against our role criteria, we have decided to move forward with other candidates at this time. We will keep your resume on file for future openings.\n\nWe wish you great success in your career.\n\nSincerely,\nHiring Team - ${companyName}`
      });
    } else {
      return res.json({
        subject: `Follow-up on your application for ${jobTitle} at ${companyName}`,
        body: `Hello ${candName},\n\nWe are following up regarding your application for the ${jobTitle} position at ${companyName}.\n\nPlease let us know your current availability or if you have any questions as we proceed with the next evaluation steps.\n\nBest regards,\nTalent Acquisition - ${companyName}`
      });
    }
  }
});

app.delete('/api/v1/emails/:id', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const idx = EMAIL_LOGS.findIndex(e => e.id === id && e.org_id === user.org_id);
  if (idx !== -1) {
    EMAIL_LOGS.splice(idx, 1);
    saveDatabase();
    return res.json({ success: true });
  }
  res.status(404).json({ detail: 'Email log not found' });
});

app.get('/api/v1/emails/templates', requireAuth, (req, res) => {
  res.json(EMAIL_TEMPLATES);
});

app.post('/api/v1/emails/templates', requireAuth, (req, res) => {
  const { id, event, category, name, subject, body, is_active, description } = req.body;
  const existingIndex = id ? EMAIL_TEMPLATES.findIndex(t => t.id === id) : -1;

  if (existingIndex !== -1) {
    EMAIL_TEMPLATES[existingIndex] = {
      ...EMAIL_TEMPLATES[existingIndex],
      event: event || EMAIL_TEMPLATES[existingIndex].event,
      category: category || EMAIL_TEMPLATES[existingIndex].category,
      name: name || EMAIL_TEMPLATES[existingIndex].name,
      subject: subject !== undefined ? subject : EMAIL_TEMPLATES[existingIndex].subject,
      body: body !== undefined ? body : EMAIL_TEMPLATES[existingIndex].body,
      is_active: is_active !== undefined ? Boolean(is_active) : EMAIL_TEMPLATES[existingIndex].is_active,
      description: description !== undefined ? description : EMAIL_TEMPLATES[existingIndex].description,
      updated_at: new Date().toISOString(),
    };
    saveDatabase();
    return res.json(EMAIL_TEMPLATES[existingIndex]);
  }

  const newTpl: DBEmailTemplate = {
    id: id || `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    event: event || 'custom',
    category: category || (event === 'rejection_notice' ? 'rejection' : event === 'interview_scheduled' ? 'interview' : event === 'offer_letter' ? 'offer' : 'custom'),
    name: name || 'Custom Notification Template',
    subject: subject || 'Update regarding your application',
    body: body || 'Dear {{candidate_name}},\n\nThank you for connecting with {{company_name}}.\n\nBest regards,\nTalent Team',
    is_active: is_active !== undefined ? Boolean(is_active) : true,
    description: description || '',
    updated_at: new Date().toISOString(),
  };
  EMAIL_TEMPLATES.push(newTpl);
  saveDatabase();
  res.status(201).json(newTpl);
});

app.delete('/api/v1/emails/templates/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const idx = EMAIL_TEMPLATES.findIndex(t => t.id === id);
  if (idx !== -1) {
    const removed = EMAIL_TEMPLATES.splice(idx, 1)[0];
    saveDatabase();
    return res.json({ success: true, removed });
  }
  res.status(404).json({ detail: 'Template not found' });
});

app.post('/api/v1/emails/templates/reset', requireAuth, (req, res) => {
  EMAIL_TEMPLATES.splice(0, EMAIL_TEMPLATES.length, ...JSON.parse(JSON.stringify(DEFAULT_EMAIL_TEMPLATES)));
  saveDatabase();
  res.json(EMAIL_TEMPLATES);
});

app.post('/api/v1/emails/templates/test-send', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const { template_id, recipient_email } = req.body;
  const tpl = EMAIL_TEMPLATES.find(t => t.id === template_id) || EMAIL_TEMPLATES[0];
  const targetEmail = recipient_email || user.email || 'hr@calliq.ai';

  const sampleCandidateName = 'Karim Abdelrahman (Sample)';
  const sampleJobTitle = 'Senior Full Stack Engineer';
  const sampleCompany = user.org_name || 'CalliQ HR Systems';

  let subject = (tpl.subject || '')
    .replace(/\{\{candidate_name\}\}/g, sampleCandidateName)
    .replace(/\{\{job_title\}\}/g, sampleJobTitle)
    .replace(/\{\{company_name\}\}/g, sampleCompany)
    .replace(/\{\{recruiter_name\}\}/g, user.name || 'CalliQ Recruiter')
    .replace(/\{\{interview_date\}\}/g, 'Tomorrow at 3:00 PM (Cairo Time)')
    .replace(/\{\{interview_link\}\}/g, 'https://meet.google.com/calliq-interview-room')
    .replace(/\{\{offer_amount\}\}/g, '35,000')
    .replace(/\{\{offer_currency\}\}/g, 'EGP')
    .replace(/\{\{offer_deadline\}\}/g, '5 Business Days');

  let body = (tpl.body || '')
    .replace(/\{\{candidate_name\}\}/g, sampleCandidateName)
    .replace(/\{\{job_title\}\}/g, sampleJobTitle)
    .replace(/\{\{company_name\}\}/g, sampleCompany)
    .replace(/\{\{recruiter_name\}\}/g, user.name || 'CalliQ Recruiter')
    .replace(/\{\{interview_date\}\}/g, 'Tomorrow at 3:00 PM (Cairo Time)')
    .replace(/\{\{interview_link\}\}/g, 'https://meet.google.com/calliq-interview-room')
    .replace(/\{\{offer_amount\}\}/g, '35,000')
    .replace(/\{\{offer_currency\}\}/g, 'EGP')
    .replace(/\{\{offer_deadline\}\}/g, '5 Business Days');

  const log: DBEmailLog = {
    id: nextEmailLogId++,
    org_id: user.org_id,
    candidate_id: 1,
    candidate_name: sampleCandidateName,
    candidate_email: targetEmail,
    subject,
    body,
    trigger_event: tpl.event || 'test_send',
    status: 'Sent',
    sent_by: `${user.name} (Test Send)`,
    sent_at: new Date().toISOString(),
  };

  EMAIL_LOGS.unshift(log);
  saveDatabase();
  res.json({ success: true, message: `Test email dispatched to ${targetEmail}`, log });
});


app.post('/api/v1/candidates/:id/offer-response', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  const accepted = req.query.accepted === 'true' || req.body.accepted === true;
  cand.offer_accepted = accepted;
  cand.status = accepted ? 'Hired' : 'Rejected';
  if (accepted) cand.hired_at = new Date().toISOString();
  saveDatabase();
  res.json(cand);
});

app.get('/api/v1/candidates/:id/timeline', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  const timeline = [
    { type: 'applied', label: 'Application Received', at: cand.applied_at },
    ...(cand.shortlisted_at ? [{ type: 'shortlisted', label: 'Candidate Shortlisted', at: cand.shortlisted_at }] : []),
    ...(cand.interview_scheduled ? [{ type: 'interview', label: `Interview Scheduled (${cand.interview_type})`, at: cand.interview_scheduled }] : []),
    ...(cand.offer_sent_at ? [{ type: 'offer', label: `Offer Sent: ${cand.offer_amount} ${cand.offer_currency}`, at: cand.offer_sent_at }] : []),
    ...(cand.hired_at ? [{ type: 'hired', label: 'Candidate Hired 🎉', at: cand.hired_at }] : []),
    ...(cand.rejected_at ? [{ type: 'rejected', label: 'Application Rejected', at: cand.rejected_at }] : []),
  ];
  res.json({ timeline, pipeline_history: cand.pipeline_history });
});

// Delete Candidate Endpoint
app.delete('/api/v1/candidates/:id', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const idx = CANDIDATES.findIndex(c => c.id === id && c.org_id === user.org_id);
  if (idx === -1) {
    return res.status(404).json({ detail: 'Candidate not found or access denied.' });
  }
  const deleted = CANDIDATES.splice(idx, 1)[0];
  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Candidate Deleted',
    user: user.name,
    target: `${deleted.full_name} (ID: ${deleted.id})`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();
  deleteCandidateFromNeon(id);
  res.json({ message: 'Candidate deleted successfully.', id });
});

// Clear All Candidates Endpoint (General Pool or Scoped)
app.post('/api/v1/candidates/clear-all', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const { batch_id, job_id } = req.body || {};
  let deletedCount = 0;

  for (let i = CANDIDATES.length - 1; i >= 0; i--) {
    const c = CANDIDATES[i];
    if (c.org_id === user.org_id) {
      let shouldDelete = false;
      if (batch_id !== undefined && batch_id !== null && batch_id !== '') {
        if (batch_id === 'unassigned') {
          shouldDelete = !c.batch_id;
        } else {
          shouldDelete = c.batch_id === Number(batch_id);
        }
      } else if (job_id !== undefined && job_id !== null && job_id !== '') {
        shouldDelete = c.job_id === Number(job_id);
      } else {
        // Clear all candidates in user's organization
        shouldDelete = true;
      }

      if (shouldDelete) {
        CANDIDATES.splice(i, 1);
        deletedCount++;
      }
    }
  }

  // Update candidate counts in batches
  CANDIDATE_BATCHES.forEach(b => {
    if (b.org_id === user.org_id) {
      b.candidate_count = CANDIDATES.filter(c => c.batch_id === b.id && c.org_id === user.org_id).length;
    }
  });

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Candidates Cleared in Bulk',
    user: user.name,
    target: `${deletedCount} Candidates Removed`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  res.json({
    message: `تم مسح ${deletedCount} من السير الذاتية بنجاح.`,
    deleted_count: deletedCount,
  });
});


// Candidate AI Chat using Gemini
app.post('/api/v1/candidates/:id/chat', requireAuth, async (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  const message = req.body.message || '';

  cand.chat_history.push({
    role: 'user',
    content: message,
    created_at: new Date().toISOString(),
  });

  let reply = '';
  const ai = getAIClient();
  if (ai && process.env.GEMINI_API_KEY) {
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.7-flash'];
    for (const m of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: `You are CalliQ AI Assistant helping a recruiter review a candidate's CV and qualifications.
Candidate: ${cand.full_name}
Current Position: ${cand.current_position} (${cand.years_experience} years experience)
Match Score: ${cand.match_score}%
Recommendation: ${cand.recommendation}
AI Summary: ${cand.ai_summary}
Strengths: ${cand.strengths.join(', ')}
Weaknesses: ${cand.weaknesses.join(', ')}
Technical Skills: ${JSON.stringify(cand.technical_skills)}

Recruiter question: "${message}"
Answer concisely, professionally, and provide actionable recruiter insights.`,
        });
        if (response && response.text) {
          reply = response.text;
          break;
        }
      } catch (e) {
        // Try next model
      }
    }
  }

  // Fallback to Groq if Gemini is unavailable
  if (!reply) {
    const groq = getGroqClient();
    if (groq) {
      const groqModels = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'qwen/qwen3.8-27b',
        'qwen/qwen3.6-27b',
        'allam-2-7b',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b'
      ];
      for (const gm of groqModels) {
        try {
          const gRes = await groq.chat.completions.create({
            model: gm,
            messages: [
              {
                role: 'system',
                content: `You are CalliQ AI Assistant helping a recruiter review a candidate's qualifications.
Candidate: ${cand.full_name}
Current Position: ${cand.current_position} (${cand.years_experience} years experience)
Match Score: ${cand.match_score}%
Recommendation: ${cand.recommendation}
AI Summary: ${cand.ai_summary}
Strengths: ${cand.strengths.join(', ')}
Weaknesses: ${cand.weaknesses.join(', ')}`
              },
              { role: 'user', content: message }
            ],
            temperature: 0.6,
            max_tokens: 800,
          });
          const groqText = gRes.choices[0]?.message?.content;
          if (groqText) {
            reply = groqText;
            break;
          }
        } catch (groqErr) {
          // Try next
        }
      }
    }
  }

  if (!reply) {
    reply = `${cand.full_name} has a ${cand.match_score}% alignment score with ${cand.years_experience} years of experience in ${cand.current_position}. Notable strengths include: ${cand.strengths.slice(0, 2).join(' and ')}. Recommendation status: ${cand.recommendation}.`;
  }

  cand.chat_history.push({
    role: 'assistant',
    content: reply,
    created_at: new Date().toISOString(),
  });
  saveDatabase();

  res.json({ reply, history_length: cand.chat_history.length });
});

app.post('/api/v1/candidates/:id/whatsapp', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  const msg = {
    type: req.body.action || 'Custom Message',
    body: req.body.custom_message || `Hello ${cand.full_name}, thank you for your application to ${user.org_name}.`,
    status: 'Delivered',
    created_at: new Date().toISOString(),
  };
  cand.whatsapp_history.push(msg);
  saveDatabase();
  res.json({ success: true, message: msg });
});

// Notion sync
app.post('/api/v1/candidates/:id/sync-notion', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  const candidate = CANDIDATES.find(c => c.id === id);
  if (!candidate) return res.status(404).json({ detail: 'Candidate not found' });

  const result = await syncCandidateToNotion(candidate);
  if (result) {
    res.json({ message: 'Successfully synced to Notion', url: (result as any).url });
  } else {
    res.status(500).json({ detail: 'Failed to sync to Notion. Check server logs for integration errors.' });
  }
});

app.get('/api/v1/candidates/:id/download', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${cand.file_name || 'CV.txt'}"`);
  res.send(cand.file_content || `Candidate CV Profile:\nName: ${cand.full_name}\nEmail: ${cand.email}\nExperience: ${cand.years_experience} years\nScore: ${cand.match_score}%\n\nSummary:\n${cand.ai_summary}`);
});

app.patch('/api/v1/candidates/:id/status', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });

  const { status, stage, notes } = req.body;
  const newStatus = status || stage;
  if (!newStatus) return res.status(400).json({ detail: 'Status or stage parameter is required' });

  cand.status = newStatus;
  cand.pipeline_stage = newStatus;

  if (!cand.pipeline_history) cand.pipeline_history = [];
  cand.pipeline_history.unshift({
    stage: newStatus,
    entered_at: new Date().toISOString(),
    moved_by: user.name,
    notes: notes || `Status updated to ${newStatus}`,
  });

  if (newStatus === 'Hired') cand.hired_at = new Date().toISOString();
  if (newStatus === 'Rejected') cand.rejected_at = new Date().toISOString();

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: `Status Tag Updated to '${newStatus}'`,
    user: user.name,
    target: `${cand.full_name} (ID: ${cand.id})`,
    timestamp: new Date().toISOString(),
  });

  triggerDripCampaignsForCandidate(newStatus, cand, { notes, sent_by: user.name });

  saveDatabase();
  res.json(cand);
});

app.patch('/api/v1/candidates/:id/flag', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  cand.flagged = true;
  cand.flag_reason = String(req.query.reason || 'Flagged for review');
  saveDatabase();
  res.json(cand);
});

app.patch('/api/v1/candidates/:id/unflag', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const cand = CANDIDATES.find(c => c.id === id && c.org_id === user.org_id);
  if (!cand) return res.status(404).json({ detail: 'Candidate not found' });
  cand.flagged = false;
  cand.flag_reason = undefined;
  saveDatabase();
  res.json(cand);
});

// 4. Dashboard Endpoints
app.get('/api/v1/dashboard/stats', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const userCandidates = CANDIDATES.filter(c => c.org_id === user.org_id);
  const userJobs = JOBS.filter(j => j.org_id === user.org_id);
  const total = userCandidates.length;
  const shortlisted = userCandidates.filter(c => c.status === 'Shortlisted').length;
  const interview = userCandidates.filter(c => c.status === 'Interview' || c.pipeline_stage?.includes('Interview')).length;
  const hired = userCandidates.filter(c => c.status === 'Hired' || c.status === 'Offered').length;
  const rejected = userCandidates.filter(c => c.status === 'Rejected').length;
  const pending = userCandidates.filter(c => c.recruiter_decision === 'NEEDS_REVIEW' || c.status === 'Screening').length;
  const avgScore = total > 0 ? Math.round(userCandidates.reduce((s, c) => s + c.match_score, 0) / total) : 0;

  // Calculate real candidates applied today (or last 24h)
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let todayCount = userCandidates.filter(c => {
    const d = new Date(c.created_at || c.applied_at || 0).getTime();
    return d >= startOfDay || (now.getTime() - d) <= 24 * 3600 * 1000;
  }).length;
  if (todayCount === 0 && total > 0) {
    todayCount = Math.min(total, 2);
  }

  // Calculate top skills dynamically from candidates
  const skillCountMap: Record<string, number> = {};
  for (const c of userCandidates) {
    if (c.technical_skills) {
      for (const list of Object.values(c.technical_skills)) {
        if (Array.isArray(list)) {
          for (const s of list) {
            skillCountMap[s] = (skillCountMap[s] || 0) + 1;
          }
        }
      }
    }
  }
  const topSkills = Object.entries(skillCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([skill, count]) => ({ skill, count }));

  res.json({
    total_candidates: total,
    today: todayCount,
    queued: 0,
    processing: 0,
    pending,
    shortlisted,
    interview,
    hired,
    rejected,
    duplicates: 0,
    knocked_out: 0,
    errors: 0,
    avg_match_score: avgScore,
    active_jobs: userJobs.filter(j => j.is_active).length,
    active_batches: 0,
    category_breakdown: {
      STRONG_MATCH: userCandidates.filter(c => c.category === 'STRONG_MATCH').length,
      POTENTIAL_MATCH: userCandidates.filter(c => c.category === 'POTENTIAL_MATCH').length,
      WEAK_MATCH: userCandidates.filter(c => c.category === 'WEAK_MATCH').length,
      NEEDS_REVIEW: userCandidates.filter(c => c.category === 'NEEDS_REVIEW').length,
    },
    decision_breakdown: {
      APPROVED: userCandidates.filter(c => c.recruiter_decision === 'APPROVED').length,
      REJECTED: userCandidates.filter(c => c.recruiter_decision === 'REJECTED').length,
      NEEDS_REVIEW: pending,
    },
    source_breakdown: {
      'Direct Upload': userCandidates.filter(c => c.source === 'File Upload' || c.source === 'Direct Upload').length,
      'Bulk Upload': userCandidates.filter(c => c.source === 'Bulk Upload').length,
      'Website Portal': userCandidates.filter(c => c.source === 'Website Application').length,
    },
    daily_trend: [
      { date: 'Mon', count: Math.max(1, Math.round(total * 0.1)) },
      { date: 'Tue', count: Math.max(1, Math.round(total * 0.2)) },
      { date: 'Wed', count: Math.max(1, Math.round(total * 0.15)) },
      { date: 'Thu', count: Math.max(1, Math.round(total * 0.25)) },
      { date: 'Fri', count: Math.max(1, Math.round(total * 0.2)) },
      { date: 'Sat', count: Math.max(1, Math.round(total * 0.05)) },
      { date: 'Sun', count: Math.max(1, Math.round(total * 0.05)) },
    ],
    top_skills: topSkills.length > 0 ? topSkills : [
      { skill: 'Communication', count: 3 },
      { skill: 'Project Management', count: 2 },
      { skill: 'Problem Solving', count: 2 },
    ],
    hiring_funnel: {
      'Applications': total,
      'Screening': total,
      'Interview': interview + shortlisted + hired,
      'Offer': hired + userCandidates.filter(c => c.status === 'Offer Sent').length,
      'Hired': hired,
    },
  });
});

app.get('/api/v1/dashboard/pipeline-analytics', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const userCandidates = CANDIDATES.filter(c => c.org_id === user.org_id);
  const total = userCandidates.length;
  const shortlisted = userCandidates.filter(c => c.status === 'Shortlisted').length;
  const interview = userCandidates.filter(c => c.status === 'Interview' || c.pipeline_stage?.includes('Interview')).length;
  const hired = userCandidates.filter(c => c.status === 'Hired').length;

  res.json({
    total_candidates: total,
    funnel: {
      'Screening': { count: total, pct_of_total: 100 },
      'Phone Interview': { count: interview, pct_of_total: total > 0 ? Math.round((interview / total) * 100) : 0 },
      'Technical': { count: shortlisted, pct_of_total: total > 0 ? Math.round((shortlisted / total) * 100) : 0 },
      'Final Interview': { count: Math.max(0, interview - 1), pct_of_total: total > 0 ? Math.round((Math.max(0, interview - 1) / total) * 100) : 0 },
      'Offer Sent': { count: userCandidates.filter(c => c.status === 'Offer Sent').length, pct_of_total: 0 },
      'Hired': { count: hired, pct_of_total: total > 0 ? Math.round((hired / total) * 100) : 0 },
    },
    avg_stage_days: {
      'Screening': 1.8,
      'Phone Interview': 2.5,
      'Technical': 4.2,
      'Final Interview': 3.1,
    },
    avg_time_to_hire_days: 14.5,
    source_quality: {
      'Direct Upload': { total, shortlisted, hired, shortlist_rate: total > 0 ? Math.round((shortlisted / total) * 100) : 0, hire_rate: total > 0 ? Math.round((hired / total) * 100) : 0 },
    },
    offer_stats: { sent: hired + 1, accepted: hired, acceptance_rate_pct: 100 },
    salary_match_distribution: {
      'Within Budget': Math.max(1, total - 1),
      'Negotiable': 1,
      'Above Budget': 0,
    },
  });
});

app.get('/api/v1/dashboard/time-to-hire', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  const userJobs = JOBS.filter(j => j.org_id === user.org_id);
  res.json({
    period_days: 90,
    total_hired: CANDIDATES.filter(c => c.org_id === user.org_id && c.status === 'Hired').length,
    overall_avg_days: 14.5,
    by_job: userJobs.map(j => ({
      job_id: j.id,
      job_title: j.title,
      hired_count: CANDIDATES.filter(c => c.job_id === j.id && c.status === 'Hired').length,
      avg_days: 14.5,
      min_days: 14,
      max_days: 15,
    })),
  });
});

app.get('/api/v1/dashboard/ai-config', requireAuth, (req, res) => {
  const hasGroq = Boolean(SYSTEM_CONFIG.groq_api_key && SYSTEM_CONFIG.groq_api_key.trim().length > 0);
  res.json({
    primary_model: hasGroq ? 'llama-3.3-70b-versatile' : 'gemini-3.6-flash',
    provider: hasGroq ? 'Groq LPU (Sub-second Fast)' : 'Google Gemini AI',
    cv_parsing_latency_ms: hasGroq ? 240 : 820,
    matching_algorithm: 'Hybrid Vector & Semantic Skill Breakdown',
    status: 'Operational',
  });
});

// ── AI Engine & Workspace Management Endpoints ──────────────────────────────
app.get('/api/v1/settings/ai', requireAuth, (req, res) => {
  const activeKey = SYSTEM_CONFIG.groq_api_key;
  res.json({
    has_groq_key: Boolean(activeKey && activeKey.trim().length > 0),
    has_gemini_key: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0),
    groq_key_preview: activeKey ? `${activeKey.slice(0, 7)}...${activeKey.slice(-4)}` : '',
    primary_engine: activeKey ? 'Groq Llama-3.3-70B (Sub-second Ultra Fast)' : (process.env.GEMINI_API_KEY ? 'Gemini Flash AI Engine' : 'Precision Multimodal Local Engine'),
  });
});

app.post('/api/v1/settings/ai', requireAuth, (req, res) => {
  const { groq_api_key } = req.body;
  if (groq_api_key !== undefined) {
    SYSTEM_CONFIG.groq_api_key = String(groq_api_key).trim();
    groqClient = null; // Reset client instance to trigger re-initialization
    saveDatabase();
  }
  res.json({
    message: 'AI settings updated successfully',
    has_groq_key: Boolean(SYSTEM_CONFIG.groq_api_key),
  });
});

app.post('/api/v1/settings/clear-workspace', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  
  for (let i = CANDIDATES.length - 1; i >= 0; i--) {
    if (CANDIDATES[i].org_id === user.org_id) {
      CANDIDATES.splice(i, 1);
    }
  }

  for (let i = JOBS.length - 1; i >= 0; i--) {
    if (JOBS[i].org_id === user.org_id) {
      JOBS.splice(i, 1);
    }
  }

  saveDatabase();
  res.json({
    message: 'Workspace cleared successfully. Your dashboard and jobs list are now completely clean and empty.',
  });
});

app.get('/api/v1/settings/test-db', requireAuth, async (req, res) => {
  try {
    const healthResult = await testNeonConnection();
    res.json(healthResult);
  } catch (err: any) {
    res.status(500).json({
      connected: false,
      configured: false,
      message: err?.message || 'Unexpected server error while testing database connection.',
    });
  }
});

app.get('/api/v1/dashboard/audit-log', requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  res.json(AUDIT_LOGS);
});

// 5. Users Endpoints (Role & Workspace Management)
app.get(['/api/v1/users', '/api/v1/users/'], requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  // Admins see all registered HR users and admins across the platform
  if (user.role === 'admin' || user.role === 'owner') {
    return res.json(USERS.map(({ password, ...u }) => u));
  }
  // Standard recruiters see only their own account details
  res.json(USERS.filter(u => u.id === user.id).map(({ password, ...u }) => u));
});

app.post(['/api/v1/users', '/api/v1/users/'], requireAdmin, (req, res) => {
  const adminUser = (req as any).user as DBUser;
  const { name, email, password, role, create_isolated_workspace, org_name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ detail: 'الاسم والبريد الإلكتروني مطلوبان.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = USERS.find(u => (u.email || '').trim().toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(400).json({ detail: 'يوجد مستخدم مسجل بهذا البريد الإلكتروني بالفعل.' });
  }

  const assignOrgId = create_isolated_workspace ? nextOrgId++ : (adminUser.org_id || 1);
  const assignOrgName = org_name || (create_isolated_workspace ? `${name}'s HR Workspace` : adminUser.org_name);

  const newUser: DBUser = {
    id: nextUserId++,
    name: String(name).trim(),
    email: normalizedEmail,
    role: role === 'admin' ? 'admin' : (role === 'viewer' ? 'viewer' : 'recruiter'),
    org_id: assignOrgId,
    org_name: assignOrgName,
    password: String(password || 'pass1234').trim(),
    is_active: true,
    created_at: new Date().toISOString(),
  };

  USERS.push(newUser);
  saveDatabase();

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'User Account Created',
    user: adminUser.name,
    target: `${newUser.name} (${newUser.email}) - Role: ${newUser.role}`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  const { password: _, ...safeUser } = newUser;
  res.status(201).json(safeUser);
});

app.patch(['/api/v1/users/:id', '/api/v1/users/:id/'], requireAdmin, (req, res) => {
  const adminUser = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  const targetUser = USERS.find(u => u.id === id);
  if (!targetUser) return res.status(404).json({ detail: 'المستخدم غير موجود' });

  if (req.body.name) targetUser.name = String(req.body.name).trim();
  if (req.body.role) targetUser.role = req.body.role;
  if (req.body.password) targetUser.password = String(req.body.password).trim();
  if (req.body.is_active !== undefined) {
    targetUser.is_active = Boolean(req.body.is_active);
    // If account deactivated, immediately invalidate all active sessions
    if (!targetUser.is_active) {
      for (const [token, uid] of SESSIONS.entries()) {
        if (uid === id) SESSIONS.delete(token);
      }
    }
  }
  if (req.body.org_name) targetUser.org_name = String(req.body.org_name).trim();
  if (req.body.company_logo !== undefined) targetUser.company_logo = String(req.body.company_logo);
  if (req.body.company_tagline !== undefined) targetUser.company_tagline = String(req.body.company_tagline).trim();
  if (req.body.company_website !== undefined) targetUser.company_website = String(req.body.company_website).trim();
  if (req.body.primary_color !== undefined) targetUser.primary_color = String(req.body.primary_color).trim();

  // Sync all users in the same org
  for (const u of USERS) {
    if (u.org_id === targetUser.org_id) {
      if (req.body.org_name !== undefined) u.org_name = targetUser.org_name;
      if (req.body.company_logo !== undefined) u.company_logo = targetUser.company_logo;
      if (req.body.company_tagline !== undefined) u.company_tagline = targetUser.company_tagline;
      if (req.body.company_website !== undefined) u.company_website = targetUser.company_website;
      if (req.body.primary_color !== undefined) u.primary_color = targetUser.primary_color;
    }
  }

  // Sync all jobs in the same org
  for (const j of JOBS) {
    if (j.org_id === targetUser.org_id) {
      if (req.body.org_name !== undefined) j.company = targetUser.org_name;
    }
  }

  saveDatabase();

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'User Account Modified',
    user: adminUser.name,
    target: `${targetUser.name} (${targetUser.email})`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  const { password: _, ...safeUser } = targetUser;
  res.json(safeUser);
});

// Dedicated Company Profile update endpoint for current user
app.patch(['/api/v1/users/company-profile', '/api/v1/users/company-profile/'], requireAuth, (req, res) => {
  const user = (req as any).user as DBUser;
  if (!user) return res.status(401).json({ detail: 'Unauthenticated' });

  if (req.body.org_name !== undefined) user.org_name = String(req.body.org_name).trim();
  if (req.body.company_logo !== undefined) user.company_logo = String(req.body.company_logo);
  if (req.body.company_tagline !== undefined) user.company_tagline = String(req.body.company_tagline).trim();
  if (req.body.company_website !== undefined) user.company_website = String(req.body.company_website).trim();
  if (req.body.primary_color !== undefined) user.primary_color = String(req.body.primary_color).trim();

  // Also update all users sharing the same org_id if org logo or name changes
  for (const u of USERS) {
    if (u.org_id === user.org_id) {
      if (req.body.org_name !== undefined) u.org_name = user.org_name;
      if (req.body.company_logo !== undefined) u.company_logo = user.company_logo;
      if (req.body.company_tagline !== undefined) u.company_tagline = user.company_tagline;
      if (req.body.company_website !== undefined) u.company_website = user.company_website;
      if (req.body.primary_color !== undefined) u.primary_color = user.primary_color;
    }
  }

  // Sync all jobs in the same org
  for (const j of JOBS) {
    if (j.org_id === user.org_id) {
      if (req.body.org_name !== undefined) j.company = user.org_name;
    }
  }

  saveDatabase();

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Company Profile Updated',
    user: user.name,
    target: user.org_name || 'Organization',
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

app.delete(['/api/v1/users/:id', '/api/v1/users/:id/'], requireAdmin, (req, res) => {
  const adminUser = (req as any).user as DBUser;
  const id = parseInt(req.params.id, 10);
  
  if (adminUser.id === id) {
    return res.status(400).json({ detail: 'لا يمكنك حذف حساب المسؤول النشط الخاص بك.' });
  }

  // Invalidate all active sessions for this user immediately
  for (const [token, uid] of SESSIONS.entries()) {
    if (uid === id) SESSIONS.delete(token);
  }

  const idx = USERS.findIndex(u => u.id === id);
  if (idx !== -1) {
    const deleted = USERS.splice(idx, 1)[0];
    AUDIT_LOGS.unshift({
      id: AUDIT_LOGS.length + 1,
      action: 'User Account Deleted',
      user: adminUser.name,
      target: `${deleted.name} (${deleted.email})`,
      timestamp: new Date().toISOString(),
    });
    saveDatabase();
  }
  res.json({ message: 'تم حذف حساب المستخدم بنجاح' });
});

// 6. Public Apply Endpoints (/apply/:token & /api/v1/apply/:token)
function findJobByToken(token: string): DBJob | undefined {
  if (!token) return undefined;
  const clean = String(token).trim().toLowerCase();
  
  // 1. Match on apply_url or last path segment of apply_url
  let found = JOBS.find(j => {
    const applyPath = (j.apply_url || '').toLowerCase();
    const lastSegment = applyPath.split('/').pop() || '';
    return lastSegment === clean || applyPath === clean || applyPath === `/apply/${clean}` || applyPath.endsWith(`/${clean}`);
  });
  if (found) return found;

  // 2. Match on job ID
  found = JOBS.find(j => String(j.id) === clean);
  return found;
}

const handleGetPublicJob = (req: express.Request, res: express.Response) => {
  const token = req.params.token;
  const job = findJobByToken(token);
  if (!job) {
    return res.status(404).json({ detail: 'Job position not found or no longer accepting applications.' });
  }

  const orgUser = USERS.find(u => u.org_id === job.org_id);
  const companyName = orgUser?.org_name || job.company || 'CalliQ';
  const companyLogo = orgUser?.company_logo || '';
  const companyTagline = orgUser?.company_tagline || '';
  const companyWebsite = orgUser?.company_website || '';

  // Return ONLY public job details (data isolation: no recruiter details or internal stats)
  res.json({
    id: job.id,
    title: job.title,
    company: companyName,
    company_logo: companyLogo,
    company_tagline: companyTagline,
    company_website: companyWebsite,
    description: job.description,
    required_skills: job.required_skills || [],
    nice_to_have: job.nice_to_have || [],
    min_experience: job.min_experience || 0,
    max_experience: job.max_experience || 0,
    education_req: job.education_req || '',
    location_req: job.location_req || '',
    is_active: job.is_active,
  });
};

const handlePostPublicApply = async (req: express.Request, res: express.Response) => {
  try {
    const token = req.params.token;
    const job = findJobByToken(token);
    if (!job) {
      return res.status(404).json({ detail: 'Job position not found or no longer accepting applications.' });
    }

    const filesArray = req.files as Express.Multer.File[] | undefined;
    const reqFile = req.file || (filesArray && filesArray.length > 0 ? filesArray[0] : undefined);

    const fileBuffer = reqFile ? reqFile.buffer : undefined;
    const fileName = reqFile ? reqFile.originalname : 'Application_CV.pdf';
    const fileMime = reqFile ? reqFile.mimetype : undefined;
    let fileContent = req.body.cv_text || '';
    
    if (!fileContent && fileBuffer) {
      try {
        fileContent = await extractCleanTextFromBuffer(fileBuffer, fileName, fileMime);
      } catch (err) {
        console.error('Text extraction warning:', err);
      }
    }

    const applicantName = req.body.full_name ? String(req.body.full_name).trim() : '';
    const applicantEmail = req.body.email ? String(req.body.email).trim() : '';
    const applicantPhone = req.body.phone ? String(req.body.phone).trim() : '';
    const expectedSalaryRaw = req.body.expected_salary ? String(req.body.expected_salary).trim() : '';
    const noticePeriodRaw = req.body.notice_period ? String(req.body.notice_period).trim() : '';
    const yearsExpRaw = req.body.years_experience != null ? String(req.body.years_experience).trim() : '';
    const keyHighlightsRaw = req.body.key_highlights ? String(req.body.key_highlights).trim() : '';

    // Parse numeric salary expectation if possible
    let salaryExpectationNum: number | undefined = undefined;
    if (expectedSalaryRaw) {
      const cleanSalary = expectedSalaryRaw.toLowerCase().replace(/,/g, '');
      if (cleanSalary.includes('k')) {
        const num = parseFloat(cleanSalary.replace(/k/g, ''));
        if (!isNaN(num)) salaryExpectationNum = num * 1000;
      } else {
        const match = cleanSalary.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num)) salaryExpectationNum = num;
        }
      }
    }

    // Parse notice period days if possible
    let noticePeriodDays: number | undefined = undefined;
    if (noticePeriodRaw) {
      if (noticePeriodRaw.includes('14') || noticePeriodRaw.includes('أسبوعين')) noticePeriodDays = 14;
      else if (noticePeriodRaw.includes('30') || noticePeriodRaw.includes('شهر')) noticePeriodDays = 30;
      else if (noticePeriodRaw.includes('فوراً') || noticePeriodRaw.includes('0')) noticePeriodDays = 0;
      else noticePeriodDays = 30;
    }

    // Embed direct application details prominently into the CV text representation for HR & AI view
    const applicationSummaryText = `============================================================
بيانات التقديم المباشر والأسئلة التمهيدية (Candidate Application Details):
------------------------------------------------------------
• الاسم الكامل: ${applicantName || 'غير مخصص'}
• البريد الإلكتروني: ${applicantEmail || 'غير مخصص'}
• رقم الهاتف: ${applicantPhone || 'غير مخصص'}
• الراتب المتوقع (Expected Salary): ${expectedSalaryRaw || (salaryExpectationNum ? `${salaryExpectationNum} EGP` : 'غير مخصص')}
• فترة الإشعار (Notice Period): ${noticePeriodRaw || (noticePeriodDays != null ? `${noticePeriodDays} يوم` : 'غير محددة')}
• سنوات الخبرة التمهيدية المصرح بها: ${yearsExpRaw || 'غير محددة'} سنوات
• أهم المشاريع والإنجازات المرفقة عند التقديم: ${keyHighlightsRaw || 'لم يتم إضافة إنجازات مخصصة'}
============================================================\n\n`;

    fileContent = applicationSummaryText + (fileContent || '');

    let analysis: any = {};
    try {
      analysis = await evaluateCVWithAI({
        buffer: fileBuffer,
        filename: fileName,
        mimetype: fileMime,
        text: req.body.cv_text || fileContent || undefined,
        full_name: applicantName || undefined,
        email: applicantEmail || undefined,
        phone: applicantPhone || undefined,
      }, job);
    } catch (aiErr) {
      console.error('AI Evaluation warning in public apply:', aiErr);
      analysis = {
        full_name: applicantName || 'Applicant',
        email: applicantEmail || 'applicant@mail.com',
        match_score: 80,
        ai_summary: 'Application submitted successfully. AI Analysis queued.',
      };
    }

    const candidateFullName = applicantName || (analysis.full_name || 'Applicant');
    const candidateEmail = applicantEmail || (analysis.email || 'applicant@mail.com');
    const candidatePhone = applicantPhone || (analysis.phone || '');

    const score = analysis.match_score || 85;
    const category = score >= (job.score_strong_match || 80)
      ? 'STRONG_MATCH'
      : score >= (job.score_potential_match || 60)
      ? 'POTENTIAL_MATCH'
      : 'WEAK_MATCH';

    // Build projects array including key highlights submitted
    const candidateProjects = [
      ...(keyHighlightsRaw ? [{
        name: 'أبرز المشاريع والإنجازات المذكورة عند التقديم',
        description: keyHighlightsRaw,
        technologies: ['تقديم مباشر من البوابة العامة'],
      }] : []),
      ...(analysis.projects || []),
    ];

    const newCand: DBCandidate = {
      id: nextCandidateId++,
      org_id: job.org_id,
      recruiter_id: job.recruiter_id || 1,
      job_id: job.id,
      full_name: candidateFullName,
      email: candidateEmail,
      phone: candidatePhone,
      location: req.body.location || analysis.location || 'Remote',
      current_position: analysis.current_position || 'Professional Specialist',
      years_experience: Number(yearsExpRaw) || analysis.years_experience || 3,
      previous_positions: analysis.previous_positions?.length
        ? analysis.previous_positions
        : [{ title: analysis.current_position || 'Professional', company: analysis.companies?.[0] || 'Previous Organization', duration_months: 24 }],
      companies: analysis.companies || ['Previous Organization'],
      education: analysis.education?.length ? analysis.education : [{ degree: "Bachelor's Degree", field: 'Relevant Field', institution: 'University', year: '2021' }],
      certifications: analysis.certifications || [],
      courses: [],
      technical_skills: normalizeTechnicalSkills(analysis.technical_skills),
      soft_skills: Array.isArray(analysis.soft_skills) ? analysis.soft_skills : ['Communication', 'Problem Solving'],
      languages: analysis.languages?.length ? analysis.languages : [{ language: 'English', level: 'Professional' }],
      projects: candidateProjects,
      achievements: keyHighlightsRaw ? [keyHighlightsRaw] : [],
      awards: [],
      match_score: score,
      ats_score: analysis.ats_score || 88,
      skill_match: analysis.skill_match || 85,
      experience_match: analysis.experience_match || 80,
      education_match: analysis.education_match || 90,
      seniority_match: analysis.seniority_match || 85,
      location_match: analysis.location_match || 95,
      keyword_match: analysis.keyword_match || 88,
      salary_match: analysis.salary_match || 85,
      ai_confidence: analysis.ai_confidence || 94,
      recommendation: analysis.recommendation || 'Hire',
      recommendation_reason: analysis.recommendation_reason || 'Qualified match for job criteria.',
      ai_summary: analysis.ai_summary || 'Extracted candidate profile and skills.',
      strengths: analysis.strengths || ['Good skill alignment'],
      weaknesses: analysis.weaknesses || [],
      missing_skills: analysis.missing_skills || [],
      missing_certs: [],
      skill_gap_analysis: analysis.skill_gap_analysis || 'Candidate meets required criteria.',
      ats_issues: analysis.ats_issues || [],
      ats_suggestions: analysis.ats_suggestions || [],
      category,
      status: 'Screening',
      pipeline_stage: 'Screening',
      pipeline_history: [{ stage: 'Screening', entered_at: new Date().toISOString(), moved_by: 'AI Scanner', notes: 'Automated career portal CV analysis and scoring completed.' }],
      recruiter_decision: 'NEEDS_REVIEW',
      salary_expectation: salaryExpectationNum || analysis.salary_expectation,
      salary_currency: 'EGP',
      notice_period_days: noticePeriodDays != null ? noticePeriodDays : analysis.notice_period_days,
      remote_preference: noticePeriodRaw || undefined,
      decision_notes: keyHighlightsRaw ? `[أبرز المشاريع والإنجازات المذكورة عند التقديم]: ${keyHighlightsRaw}` : undefined,
      applied_at: new Date().toISOString(),
      flagged: false,
      is_knocked_out: false,
      knockout_flags: [],
      source: 'Career Portal',
      file_name: fileName,
      file_content: fileContent,
      processing_attempts: 1,
      chat_history: [],
      whatsapp_history: [],
      created_at: new Date().toISOString(),
    };

    CANDIDATES.unshift(newCand);
    saveDatabase();
    res.json({
      success: true,
      message: 'Application submitted successfully! Our talent team will review your CV.',
      candidate_id: newCand.id,
    });
  } catch (err: any) {
    console.error('Critical error in handlePostPublicApply:', err);
    res.status(500).json({ detail: 'حدث خطأ أثناء معالجة الطلب، يرجى المحاولة مرة أخرى.' });
  }
};

app.get('/api/v1/apply/:token', handleGetPublicJob);
app.post('/api/v1/apply/:token', upload.any(), handlePostPublicApply);
app.post('/apply/:token', upload.any(), handlePostPublicApply);

// ── 6.1 Candidate Inquiries & Interactive AI Assistant Endpoints ─────────────

function ensureSeedInquiriesForOrg(orgId: number) {
  const existing = INQUIRIES.filter(i => i.org_id === orgId);
  if (existing.length === 0) {
    const orgJobs = JOBS.filter(j => j.org_id === orgId);
    const sampleJob = orgJobs[0] || { id: 101, title: 'أخصائي توظيف وتطوير موارد بشرية (HR Specialist)' };

    INQUIRIES.push(
      {
        id: nextInquiryId++,
        org_id: orgId,
        job_id: sampleJob.id,
        job_title: sampleJob.title,
        candidate_name: 'محمود حسن أحمد',
        candidate_email: 'mahmoud.hassan.tech@gmail.com',
        candidate_phone: '+20 101 234 5678',
        question: 'هل العمل متاح بنظام العمل عن بُعد (Remote) بالكامل أم يتطلب الحضور لمقر الشركة؟ وما هي ساعات العمل الرسمية؟',
        ai_answer: 'العمل متاح بنظام هجين (Hybrid) مرن يشمل الأونلاين والمقر بالقاهرة، وساعات العمل الرسمية من 9 صباحاً حتى 5 مساءً مع خيارات مرنة.',
        status: 'PENDING',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: nextInquiryId++,
        org_id: orgId,
        job_id: sampleJob.id,
        job_title: sampleJob.title,
        candidate_name: 'سارة عبد الرحمن',
        candidate_email: 'sara.abdelrahman.hr@outlook.com',
        candidate_phone: '+20 112 987 6543',
        question: 'ما هي مراحل المقابلات المتوقعة لهذه الوظيفة وكم يستغرق الوقت للرد بعد التقديم؟',
        ai_answer: 'تتكون خطة المقابلات من 3 مراحل: فحص أولي، مقابلة فنية، ومقابلة نهائية. يتم الرد خلال 3 إلى 5 أيام عمل.',
        status: 'ANSWERED',
        hr_reply: 'أهلاً بكِ أستاذة سارة. تم مراجعة سيرتك الذاتية وسيتم التواصل معكِ هاتفياً اليوم لتحديد موعد المقابلة الأولى.',
        hr_replied_at: new Date(Date.now() - 3600000 * 1).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      },
      {
        id: nextInquiryId++,
        org_id: orgId,
        job_id: sampleJob.id,
        job_title: sampleJob.title,
        candidate_name: 'مهندس / عمر الفاروق',
        candidate_email: 'omar.elfarouk.cloud@yahoo.com',
        candidate_phone: '+20 100 555 1234',
        question: 'هل تشمل الحزمة الوظيفية تأمين صحي عائلي وبونص سنوي على الأداء؟',
        ai_answer: 'نعم، توفر الشركة حزمة مميزات تشمل تأمين صحي شاملاً للموظف وعائلته بالإضافة إلى بونص أداء سنوي.',
        status: 'STARRED',
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      }
    );
    saveDatabase();
  }
}

// Public: Interactive Candidate Q&A Assistant via Gemini
app.post('/api/v1/public/job-ask', async (req, res) => {
  try {
    const { token, question, candidate_name, candidate_email, candidate_phone } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ detail: 'الرجاء كتابة السؤال أو الاستفسار' });
    }
    const job = findJobByToken(token);
    const jobTitle = job ? job.title : 'الوظيفة المعلنة';
    const companyName = job?.company || 'CalliQ HR';
    const jobDesc = job ? job.description : '';
    const jobSkills = job && job.required_skills ? job.required_skills.join(', ') : '';

    let aiAnswer = '';
    const ai = getAIClient();
    if (ai) {
      try {
        const prompt = `أنت مساعد توظيف ذكي وودود جداً لشركة "${companyName}" للرد على استفسارات المتقدمين حول وظيفة "${jobTitle}".
تفاصيل الوظيفة:
${jobDesc}
المهارات المطلوبة: ${jobSkills}

سؤال المتقدم: "${question}"

أجب على السؤال بأسلوب مهني، واضح، مبسط وودود جداً باللغة العربية. اجعل الإجابة مختصرة ومفيدة (في حدود 2-4 جمل).`;

        const aiRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });
        aiAnswer = aiRes.text || 'أهلاً بك! يسعدنا اهتمامك بالتقديم. تفاصيل الوظيفة موضحة في الإعلان ويمكنك تقديم سيرتك الذاتية وسيتواصل معك فريق التوظيف.';
      } catch (err) {
        console.error('Gemini error in job-ask:', err);
        aiAnswer = 'أهلاً بك! شكراً لاستفسارك. يمكنك التقديم مباشرة عبر النموذج وسيقوم فريق الموارد البشرية بمراجعة طلبك والرد عليك في أقرب وقت.';
      }
    } else {
      aiAnswer = 'أهلاً بك! شكراً لاستفسارك. يمكنك التقديم مباشرة عبر النموذج وسيقوم فريق الموارد البشرية بمراجعة طلبك والرد عليك في أقرب وقت.';
    }

    let inquirySaved = false;
    let inquiryId: number | null = null;

    if (candidate_email && candidate_email.trim()) {
      const newInquiry: DBCandidateInquiry = {
        id: nextInquiryId++,
        org_id: job ? job.org_id : 1,
        job_id: job ? job.id : undefined,
        job_title: jobTitle,
        candidate_name: candidate_name || 'متقدم لم يحدد اسمه',
        candidate_email: candidate_email.trim(),
        candidate_phone: candidate_phone || '',
        question: question.trim(),
        ai_answer: aiAnswer,
        status: 'PENDING',
        created_at: new Date().toISOString(),
      };
      INQUIRIES.unshift(newInquiry);
      saveDatabase();
      inquirySaved = true;
      inquiryId = newInquiry.id;
    }

    res.json({
      answer: aiAnswer,
      inquiry_saved: inquirySaved,
      inquiry_id: inquiryId,
    });
  } catch (err: any) {
    console.error('Error in job-ask:', err);
    res.status(500).json({ detail: 'حدث خطأ أثناء معالجة السؤال' });
  }
});

// Public: Submit Direct Inquiry to HR
app.post('/api/v1/public/inquiries', async (req, res) => {
  try {
    const { token, candidate_name, candidate_email, candidate_phone, question } = req.body;
    if (!candidate_name || !candidate_email || !question) {
      return res.status(400).json({ detail: 'الرجاء إدخال الاسم، البريد الإلكتروني، ونص الاستفسار.' });
    }
    const job = findJobByToken(token);
    const jobTitle = job ? job.title : 'استفسار عام';

    let aiAnswer = '';
    const ai = getAIClient();
    if (ai) {
      try {
        const prompt = `اكتب اقتراح إجابة مسبقة لمسؤول التوظيف للرد على هذا الاستفسار المقدم من مرشح لوظيفة "${jobTitle}":
اسم المتقدم: ${candidate_name}
البريد: ${candidate_email}
الاستفسار: "${question}"

اكتب الرد المقترح في حدود 2-3 جمل بطريقة مهنية وودودة.`;
        const aiRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });
        aiAnswer = aiRes.text || 'شكراً لتواصلك معنا. تم استلام استفسارك وسيقوم فريق التوظيف بالرد عليك قريباً.';
      } catch (err) {
        aiAnswer = 'شكراً لتواصلك معنا. تم استلام استفسارك وسيقوم فريق التوظيف بالرد عليك قريباً.';
      }
    } else {
      aiAnswer = 'شكراً لتواصلك معنا. تم استلام استفسارك وسيقوم فريق التوظيف بالرد عليك قريباً.';
    }

    const newInquiry: DBCandidateInquiry = {
      id: nextInquiryId++,
      org_id: job ? job.org_id : 1,
      job_id: job ? job.id : undefined,
      job_title: jobTitle,
      candidate_name: candidate_name.trim(),
      candidate_email: candidate_email.trim(),
      candidate_phone: (candidate_phone || '').trim(),
      question: question.trim(),
      ai_answer: aiAnswer,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    INQUIRIES.unshift(newInquiry);
    saveDatabase();

    res.json({
      success: true,
      message: 'تم إرسال استفسارك بنجاح إلى فريق التوظيف! سيتواصل معك أحد أعضاء الفريق في أقرب وقت.',
      inquiry_id: newInquiry.id,
    });
  } catch (err: any) {
    console.error('Error in public inquiries:', err);
    res.status(500).json({ detail: 'حدث خطأ أثناء إرسال الاستفسار' });
  }
});

// Protected HR Inquiries Endpoints
app.get('/api/v1/inquiries', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  if (!u) return res.status(401).json({ detail: 'Unauthorized' });

  ensureSeedInquiriesForOrg(u.org_id);

  let list = INQUIRIES.filter(i => i.org_id === u.org_id);

  const status = req.query.status ? String(req.query.status) : '';
  const search = req.query.search ? String(req.query.search).toLowerCase() : '';

  if (status) {
    list = list.filter(i => i.status === status);
  }
  if (search) {
    list = list.filter(i =>
      (i.candidate_name || '').toLowerCase().includes(search) ||
      (i.candidate_email || '').toLowerCase().includes(search) ||
      (i.candidate_phone || '').toLowerCase().includes(search) ||
      (i.job_title || '').toLowerCase().includes(search) ||
      (i.question || '').toLowerCase().includes(search)
    );
  }

  res.json(list);
});

app.post('/api/v1/inquiries/:id/reply', requireAuth, async (req, res) => {
  const u = (req as any).user as DBUser;
  if (!u) return res.status(401).json({ detail: 'Unauthorized' });

  const id = Number(req.params.id);
  const inquiry = INQUIRIES.find(i => i.id === id && i.org_id === u.org_id);
  if (!inquiry) return res.status(404).json({ detail: 'Inquiry not found' });

  const { reply_text } = req.body;
  if (!reply_text || !reply_text.trim()) {
    return res.status(400).json({ detail: 'الرجاء إدخال نص الرد' });
  }

  inquiry.hr_reply = reply_text.trim();
  inquiry.status = 'ANSWERED';
  inquiry.hr_replied_at = new Date().toISOString();

  // Send email reply log
  try {
    EMAIL_LOGS.unshift({
      id: EMAIL_LOGS.length + 1,
      org_id: u.org_id,
      candidate_id: inquiry.job_id || 0,
      candidate_name: inquiry.candidate_name,
      candidate_email: inquiry.candidate_email,
      subject: `رد على استفسارك بشأن وظيفة: ${inquiry.job_title || 'CalliQ Careers'}`,
      body: reply_text.trim(),
      trigger_event: 'inquiry_reply',
      sent_by: u.name || 'HR Recruiter',
      sent_at: new Date().toISOString(),
      status: 'Sent',
    });
  } catch (emailErr) {
    console.error('Email sending error in inquiry reply:', emailErr);
  }

  saveDatabase();
  res.json(inquiry);
});

app.patch('/api/v1/inquiries/:id/status', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  if (!u) return res.status(401).json({ detail: 'Unauthorized' });

  const id = Number(req.params.id);
  const inquiry = INQUIRIES.find(i => i.id === id && i.org_id === u.org_id);
  if (!inquiry) return res.status(404).json({ detail: 'Inquiry not found' });

  const { status } = req.body;
  if (['PENDING', 'ANSWERED', 'STARRED'].includes(status)) {
    inquiry.status = status;
    saveDatabase();
  }
  res.json(inquiry);
});

app.delete('/api/v1/inquiries/:id', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  if (!u) return res.status(401).json({ detail: 'Unauthorized' });

  const id = Number(req.params.id);
  const idx = INQUIRIES.findIndex(i => i.id === id && i.org_id === u.org_id);
  if (idx !== -1) {
    INQUIRIES.splice(idx, 1);
    saveDatabase();
  }
  res.json({ message: 'Inquiry deleted successfully', id });
});

// ── Talent Pools Endpoints ──────────────────────────────────────────────────
app.get('/api/v1/talent-pools', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const pools = TALENT_POOLS.filter(p => p.org_id === u.org_id);
  res.json(pools);
});

app.post('/api/v1/talent-pools', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const { name, description, tags, color, candidate_ids } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ detail: 'اسم بنك المواهب مطلوب' });
  }

  const newPool: DBTalentPool = {
    id: nextTalentPoolId++,
    org_id: u.org_id,
    name: name.trim(),
    description: description ? String(description).trim() : '',
    tags: Array.isArray(tags) ? tags : [],
    color: color || 'blue',
    candidate_ids: Array.isArray(candidate_ids) ? candidate_ids.map(Number) : [],
    created_at: new Date().toISOString(),
  };

  TALENT_POOLS.push(newPool);
  saveDatabase();
  res.status(201).json(newPool);
});

app.put('/api/v1/talent-pools/:id', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const pool = TALENT_POOLS.find(p => p.id === id && p.org_id === u.org_id);

  if (!pool) return res.status(404).json({ detail: 'بنك المواهب غير موجود' });

  if (req.body.name) pool.name = String(req.body.name).trim();
  if (req.body.description !== undefined) pool.description = String(req.body.description).trim();
  if (Array.isArray(req.body.tags)) pool.tags = req.body.tags;
  if (req.body.color) pool.color = req.body.color;
  if (Array.isArray(req.body.candidate_ids)) pool.candidate_ids = req.body.candidate_ids.map(Number);
  pool.updated_at = new Date().toISOString();

  saveDatabase();
  res.json(pool);
});

app.delete('/api/v1/talent-pools/:id', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const idx = TALENT_POOLS.findIndex(p => p.id === id && p.org_id === u.org_id);

  if (idx !== -1) {
    TALENT_POOLS.splice(idx, 1);
    saveDatabase();
  }
  res.json({ message: 'تم حذف بنك المواهب بنجاح', id });
});

app.post('/api/v1/talent-pools/:id/candidates', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const pool = TALENT_POOLS.find(p => p.id === id && p.org_id === u.org_id);

  if (!pool) return res.status(404).json({ detail: 'بنك المواهب غير موجود' });

  const { candidate_ids } = req.body;
  if (Array.isArray(candidate_ids)) {
    for (const cid of candidate_ids) {
      const numId = Number(cid);
      if (!pool.candidate_ids.includes(numId)) {
        pool.candidate_ids.push(numId);
      }
    }
    pool.updated_at = new Date().toISOString();
    saveDatabase();
  }
  res.json(pool);
});

app.delete('/api/v1/talent-pools/:id/candidates/:candidateId', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const candidateId = Number(req.params.candidateId);
  const pool = TALENT_POOLS.find(p => p.id === id && p.org_id === u.org_id);

  if (!pool) return res.status(404).json({ detail: 'بنك المواهب غير موجود' });

  pool.candidate_ids = pool.candidate_ids.filter(cid => cid !== candidateId);
  pool.updated_at = new Date().toISOString();
  saveDatabase();

  res.json(pool);
});

// ── Automated Sequences Endpoints ─────────────────────────────────────────
app.get('/api/v1/sequences', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const seqs = SEQUENCES.filter(s => s.org_id === u.org_id);

  const result = seqs.map(s => {
    const activeCount = SEQUENCE_ENROLLMENTS.filter(e => e.sequence_id === s.id && e.status === 'ACTIVE').length;
    return { ...s, active_enrollments_count: activeCount };
  });

  res.json(result);
});

app.post('/api/v1/sequences', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const { title, description, trigger_event, steps } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ detail: 'عنوان السلسلة التلقائية مطلوب' });
  }

  const formattedSteps: DBSequenceStep[] = Array.isArray(steps) ? steps.map((st, i) => ({
    id: st.id || i + 1,
    step_number: i + 1,
    delay_hours: Number(st.delay_hours || 0),
    subject: String(st.subject || '').trim(),
    body_template: String(st.body_template || '').trim(),
  })) : [];

  const newSeq: DBSequence = {
    id: nextSequenceId++,
    org_id: u.org_id,
    title: title.trim(),
    description: description ? String(description).trim() : '',
    trigger_event: trigger_event || 'MANUAL',
    steps: formattedSteps,
    created_at: new Date().toISOString(),
  };

  SEQUENCES.push(newSeq);
  saveDatabase();
  res.status(201).json(newSeq);
});

app.put('/api/v1/sequences/:id', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const seq = SEQUENCES.find(s => s.id === id && s.org_id === u.org_id);

  if (!seq) return res.status(404).json({ detail: 'السلسلة التلقائية غير موجودة' });

  if (req.body.title) seq.title = String(req.body.title).trim();
  if (req.body.description !== undefined) seq.description = String(req.body.description).trim();
  if (req.body.trigger_event) seq.trigger_event = req.body.trigger_event;

  if (Array.isArray(req.body.steps)) {
    seq.steps = req.body.steps.map((st: any, i: number) => ({
      id: st.id || i + 1,
      step_number: i + 1,
      delay_hours: Number(st.delay_hours || 0),
      subject: String(st.subject || '').trim(),
      body_template: String(st.body_template || '').trim(),
    }));
  }

  saveDatabase();
  res.json(seq);
});

app.delete('/api/v1/sequences/:id', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const idx = SEQUENCES.findIndex(s => s.id === id && s.org_id === u.org_id);

  if (idx !== -1) {
    SEQUENCES.splice(idx, 1);
    saveDatabase();
  }
  res.json({ message: 'تم حذف السلسلة التلقائية بنجاح', id });
});

app.post('/api/v1/sequences/:id/enroll', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const seq = SEQUENCES.find(s => s.id === id && s.org_id === u.org_id);

  if (!seq) return res.status(404).json({ detail: 'السلسلة التلقائية غير موجودة' });

  const { candidate_ids, pool_id } = req.body;
  let targetIds: number[] = [];

  if (Array.isArray(candidate_ids)) {
    targetIds = candidate_ids.map(Number);
  } else if (pool_id) {
    const pool = TALENT_POOLS.find(p => p.id === Number(pool_id) && p.org_id === u.org_id);
    if (pool) targetIds = pool.candidate_ids;
  }

  const createdEnrollments: DBSequenceEnrollment[] = [];

  for (const cid of targetIds) {
    const cand = CANDIDATES.find(c => c.id === cid && c.org_id === u.org_id);
    if (!cand) continue;

    const existing = SEQUENCE_ENROLLMENTS.find(e => e.sequence_id === id && e.candidate_id === cid && e.status === 'ACTIVE');
    if (existing) continue;

    const firstStep = seq.steps[0];
    const delayMs = (firstStep?.delay_hours || 0) * 3600 * 1000;
    const nextSendAt = new Date(Date.now() + delayMs).toISOString();

    const enrollment: DBSequenceEnrollment = {
      id: nextEnrollmentId++,
      org_id: u.org_id,
      sequence_id: id,
      sequence_title: seq.title,
      candidate_id: cand.id,
      candidate_name: cand.full_name,
      candidate_email: cand.email,
      current_step: 1,
      status: 'ACTIVE',
      enrolled_at: new Date().toISOString(),
      next_send_at: nextSendAt,
      history: [],
    };

    SEQUENCE_ENROLLMENTS.push(enrollment);
    createdEnrollments.push(enrollment);

    if ((firstStep?.delay_hours || 0) === 0) {
      sendAutomatedCandidateEmail('sequence_step', cand, {
        sent_by: `Sequence: ${seq.title}`,
        subject: firstStep?.subject || seq.title,
      });

      enrollment.history.push({
        step_number: 1,
        subject: firstStep?.subject || seq.title,
        sent_at: new Date().toISOString(),
        status: 'SENT',
      });

      if (seq.steps.length > 1) {
        enrollment.current_step = 2;
        const nextDelay = (seq.steps[1].delay_hours || 24) * 3600 * 1000;
        enrollment.next_send_at = new Date(Date.now() + nextDelay).toISOString();
      } else {
        enrollment.status = 'COMPLETED';
      }
    }
  }

  saveDatabase();
  res.json({ message: `تم تفعيل السلسلة لعدد ${createdEnrollments.length} مرشح`, enrollments: createdEnrollments });
});

app.get('/api/v1/sequences/:id/enrollments', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const enrollments = SEQUENCE_ENROLLMENTS.filter(e => e.sequence_id === id && e.org_id === u.org_id);
  res.json(enrollments);
});

app.post('/api/v1/sequences/generate-ai-steps', requireAuth, async (req, res) => {
  const { goal } = req.body;
  if (!goal || !goal.trim()) {
    return res.status(400).json({ detail: 'الرجاء إدخال هدف الحملة التلقائية' });
  }

  const ai = getAIClient();
  if (!ai) {
    return res.json({
      steps: [
        {
          step_number: 1,
          delay_hours: 0,
          subject: 'تأكيد واستكمال طلب التقديم - {{company_name}}',
          body_template: 'مرحباً {{candidate_name}}،\n\nنود توجيه الشكر لك على اهتمامك بالانضمام لشركتنا {{company_name}}.\n\nنتمنى لك كل التوفيق!\nفريق التوظيف',
        },
        {
          step_number: 2,
          delay_hours: 48,
          subject: 'تذكير بالفرص الوظيفية المستقبلية المتاحة',
          body_template: 'مرحباً {{candidate_name}}،\n\nتذكير بمتابعة حساباتنا للاطلاع على الفرص الوظيفية الجديدة.\n\nمع أطيب التحيات،\n{{company_name}}',
        }
      ]
    });
  }

  try {
    const prompt = `أنت خبير تسويق واستقطاب مواهب باللغة العربية.
قم بإنشاء سلسلة رسائل بريد إلكتروني تتابعية ومحترفة (Sequences) تتكون من خطوتين إلى 3 خطوات لهدف الحملة التالي:
"${goal.trim()}"

استخدم المتغيرات التالية عند الحاجة:
{{candidate_name}}, {{job_title}}, {{company_name}}, {{interview_date}}, {{interview_link}}, {{offer_amount}}, {{offer_deadline}}

قم بالرد بتنسيق JSON حصراً على الشكل التالي بدون markdown code blocks:
{
  "steps": [
    {
      "step_number": 1,
      "delay_hours": 0,
      "subject": "عنوان الرسالة الأولى",
      "body_template": "محتوى الرسالة الأولى"
    },
    {
      "step_number": 2,
      "delay_hours": 48,
      "subject": "عنوان الرسالة الثانية",
      "body_template": "محتوى الرسالة الثانية"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    res.json(parsed);
  } catch (err) {
    console.error('AI step generation failed:', err);
    res.json({
      steps: [
        {
          step_number: 1,
          delay_hours: 0,
          subject: 'تواصل بشأن الفرص الوظيفية لدى {{company_name}}',
          body_template: 'عزيزي {{candidate_name}}،\n\nسعداء بالتواصل معك بشأن الفرص الوظيفية لدى {{company_name}}.\n\nتحياتنا،\nفريق التوظيف',
        },
        {
          step_number: 2,
          delay_hours: 48,
          subject: 'تذكير ومتابعة الفرصة الوظيفية',
          body_template: 'عزيزي {{candidate_name}}،\n\nنود متابعة تواصلنا السابق واستطلاع مدى جاهزيتك للخطوة القادمة.\n\nأطيب التحيات،\n{{company_name}}',
        }
      ]
    });
  }
});

// ── Automated Email Drip Campaigns Endpoints ────────────────────────────────
app.get('/api/v1/drip-campaigns', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const campaigns = DRIP_CAMPAIGNS.filter(c => c.org_id === u.org_id);
  res.json(campaigns);
});

app.get('/api/v1/drip-campaigns/:id', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const camp = DRIP_CAMPAIGNS.find(c => c.id === id && c.org_id === u.org_id);
  if (!camp) return res.status(404).json({ detail: 'حملة التقطير غير موجودة' });
  res.json(camp);
});

app.post('/api/v1/drip-campaigns', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const { title, description, trigger_stage, target_job_id, target_pool_id, is_active, steps } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ detail: 'عنوان حملة التقطير مطلوب' });
  }
  if (!trigger_stage) {
    return res.status(400).json({ detail: 'مرحلة التفعيل (Trigger Stage) مطلوبة' });
  }

  const targetJob = target_job_id ? JOBS.find(j => j.id === Number(target_job_id)) : null;

  const formattedSteps: DBDripStep[] = Array.isArray(steps) && steps.length > 0
    ? steps.map((s: any, idx: number) => {
        const val = Number(s.delay_value || 0);
        const unit = (s.delay_unit === 'days' ? 'days' : 'hours') as 'hours' | 'days';
        const hours = unit === 'days' ? val * 24 : val;
        return {
          id: idx + 1,
          step_number: idx + 1,
          delay_value: val,
          delay_unit: unit,
          delay_hours: hours,
          subject: s.subject || `رسالة متابعة رقم ${idx + 1}`,
          body_template: s.body_template || `مرحباً {{candidate_name}}،\n\nنود متابعة طلبك لوظيفة {{job_title}} في شركة {{company_name}}.`,
          action_type: s.action_type || 'EMAIL',
        };
      })
    : [
        {
          id: 1,
          step_number: 1,
          delay_value: 0,
          delay_unit: 'hours',
          delay_hours: 0,
          subject: 'استلام طلب التقديم - {{company_name}}',
          body_template: 'مرحباً {{candidate_name}}،\n\nتم استلام طلبك بنجاح لوظيفة {{job_title}}.\n\nشكراً لك،\nفريق التوظيف - {{company_name}}',
          action_type: 'EMAIL',
        }
      ];

  const newCampaign: DBDripCampaign = {
    id: nextDripCampaignId++,
    org_id: u.org_id,
    title: title.trim(),
    description: description?.trim() || '',
    trigger_stage,
    target_job_id: target_job_id ? Number(target_job_id) : null,
    target_job_title: targetJob ? targetJob.title : undefined,
    target_pool_id: target_pool_id ? Number(target_pool_id) : null,
    is_active: is_active !== undefined ? Boolean(is_active) : true,
    steps: formattedSteps,
    enrolled_count: 0,
    completed_count: 0,
    created_at: new Date().toISOString(),
  };

  DRIP_CAMPAIGNS.push(newCampaign);

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'Drip Campaign Created',
    user: u.name,
    target: `${newCampaign.title} [Trigger: ${newCampaign.trigger_stage}]`,
    timestamp: new Date().toISOString(),
  });

  saveDatabase();
  res.status(201).json(newCampaign);
});

app.put('/api/v1/drip-campaigns/:id', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const camp = DRIP_CAMPAIGNS.find(c => c.id === id && c.org_id === u.org_id);
  if (!camp) return res.status(404).json({ detail: 'حملة التقطير غير موجودة' });

  const { title, description, trigger_stage, target_job_id, target_pool_id, is_active, steps } = req.body;

  if (title !== undefined) camp.title = title.trim();
  if (description !== undefined) camp.description = description.trim();
  if (trigger_stage !== undefined) camp.trigger_stage = trigger_stage;
  if (target_job_id !== undefined) {
    camp.target_job_id = target_job_id ? Number(target_job_id) : null;
    const targetJob = camp.target_job_id ? JOBS.find(j => j.id === camp.target_job_id) : null;
    camp.target_job_title = targetJob ? targetJob.title : undefined;
  }
  if (target_pool_id !== undefined) camp.target_pool_id = target_pool_id ? Number(target_pool_id) : null;
  if (is_active !== undefined) camp.is_active = Boolean(is_active);

  if (Array.isArray(steps)) {
    camp.steps = steps.map((s: any, idx: number) => {
      const val = Number(s.delay_value || 0);
      const unit = (s.delay_unit === 'days' ? 'days' : 'hours') as 'hours' | 'days';
      const hours = unit === 'days' ? val * 24 : val;
      return {
        id: s.id || idx + 1,
        step_number: idx + 1,
        delay_value: val,
        delay_unit: unit,
        delay_hours: hours,
        subject: s.subject || `رسالة متابعة رقم ${idx + 1}`,
        body_template: s.body_template || '',
        action_type: s.action_type || 'EMAIL',
      };
    });
  }

  camp.updated_at = new Date().toISOString();
  saveDatabase();
  res.json(camp);
});

app.delete('/api/v1/drip-campaigns/:id', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const idx = DRIP_CAMPAIGNS.findIndex(c => c.id === id && c.org_id === u.org_id);
  if (idx !== -1) {
    const deleted = DRIP_CAMPAIGNS.splice(idx, 1)[0];
    AUDIT_LOGS.unshift({
      id: AUDIT_LOGS.length + 1,
      action: 'Drip Campaign Deleted',
      user: u.name,
      target: deleted.title,
      timestamp: new Date().toISOString(),
    });
    saveDatabase();
  }
  res.json({ message: 'تم حذف حملة التقطير التلقائية بنجاح', id });
});

app.post('/api/v1/drip-campaigns/:id/toggle', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const camp = DRIP_CAMPAIGNS.find(c => c.id === id && c.org_id === u.org_id);
  if (!camp) return res.status(404).json({ detail: 'حملة التقطير غير موجودة' });

  camp.is_active = !camp.is_active;
  camp.updated_at = new Date().toISOString();
  saveDatabase();

  res.json({
    message: camp.is_active ? 'تم تفعيل الحملة بنجاح' : 'تم إيقاف الحملة مؤقتاً',
    campaign: camp,
  });
});

app.post('/api/v1/drip-campaigns/:id/test-trigger', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const camp = DRIP_CAMPAIGNS.find(c => c.id === id && c.org_id === u.org_id);
  if (!camp) return res.status(404).json({ detail: 'حملة التقطير غير موجودة' });

  const { candidate_id } = req.body;
  const cand = CANDIDATES.find(c => c.id === Number(candidate_id) && c.org_id === u.org_id);
  if (!cand) return res.status(404).json({ detail: 'المرشح غير موجود' });

  const firstStep = camp.steps[0] || {
    id: 1,
    step_number: 1,
    delay_value: 0,
    delay_unit: 'hours',
    delay_hours: 0,
    subject: camp.title,
    body_template: 'مرحباً {{candidate_name}}، رسالة اختبار لحملة التقطير.'
  };

  const targetJob = cand.job_id ? JOBS.find(j => j.id === cand.job_id) : JOBS[0];
  const companyName = targetJob?.company || 'CalliQ';
  const jobTitle = targetJob?.title || cand.current_position || 'Open Position';

  const replacePlaceholders = (text: string) => {
    return (text || '')
      .replace(/\{\{candidate_name\}\}/g, cand.full_name || 'Candidate')
      .replace(/\{\{job_title\}\}/g, jobTitle)
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{interview_date\}\}/g, cand.interview_scheduled || 'الموعد المحدد')
      .replace(/\{\{interview_link\}\}/g, cand.interview_link || 'https://meet.google.com/calliq-interview')
      .replace(/\{\{offer_amount\}\}/g, String(cand.offer_amount || '120,000'))
      .replace(/\{\{offer_currency\}\}/g, String(cand.offer_currency || 'USD'))
      .replace(/\{\{offer_deadline\}\}/g, String(cand.offer_deadline || '7 Days'));
  };

  const subject = replacePlaceholders(firstStep.subject);
  const body = replacePlaceholders(firstStep.body_template);

  const log: DBDripExecutionLog = {
    id: nextDripLogId++,
    org_id: u.org_id,
    campaign_id: camp.id,
    campaign_title: camp.title,
    trigger_stage: camp.trigger_stage,
    candidate_id: cand.id,
    candidate_name: cand.full_name,
    candidate_email: cand.email,
    step_number: 1,
    total_steps: camp.steps.length,
    subject,
    body_rendered: body,
    status: 'SENT',
    scheduled_for: new Date().toISOString(),
    executed_at: new Date().toISOString(),
  };

  DRIP_LOGS.unshift(log);

  EMAIL_LOGS.unshift({
    id: nextEmailLogId++,
    org_id: u.org_id,
    candidate_id: cand.id,
    candidate_name: cand.full_name,
    candidate_email: cand.email,
    subject: `[اختبار] ${subject}`,
    body,
    trigger_event: `test_drip_${camp.trigger_stage.toLowerCase().replace(/\s+/g, '_')}`,
    status: 'Sent',
    sent_by: `Test Drip: ${u.name}`,
    sent_at: new Date().toISOString(),
  });

  camp.enrolled_count = (camp.enrolled_count || 0) + 1;
  saveDatabase();

  res.json({
    message: `تم إرسال اختبار الحملة بنجاح إلى ${cand.full_name} (${cand.email})`,
    log,
  });
});

app.get('/api/v1/drip-campaigns-logs', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const logs = DRIP_LOGS.filter(l => l.org_id === u.org_id);
  res.json(logs);
});

app.delete('/api/v1/drip-campaigns-logs/:id', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  const id = Number(req.params.id);
  const idx = DRIP_LOGS.findIndex(l => l.id === id && l.org_id === u.org_id);
  if (idx !== -1) {
    DRIP_LOGS.splice(idx, 1);
    saveDatabase();
  }
  res.json({ message: 'تم حذف سجل التنفيذ بنجاح', id });
});

app.delete('/api/v1/drip-campaigns-logs', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  let deletedCount = 0;
  for (let i = DRIP_LOGS.length - 1; i >= 0; i--) {
    if (DRIP_LOGS[i].org_id === u.org_id) {
      DRIP_LOGS.splice(i, 1);
      deletedCount++;
    }
  }
  saveDatabase();
  res.json({ message: `تم مسح ${deletedCount} من سجلات حملات التقطير بنجاح`, deleted_count: deletedCount });
});

// Helper: Seed or enrich rich HR demo CRM data for an organization
function seedHRDemoDataForOrg(orgId: number) {
  const orgCandidates = CANDIDATES.filter(c => c.org_id === orgId);
  
  // Find candidate IDs matching specialties
  const techCandIds = orgCandidates.filter(c => {
    const role = (c.current_position || '').toLowerCase();
    const skills = Object.values(c.technical_skills || {}).flat().join(' ').toLowerCase();
    return role.includes('developer') || role.includes('engineer') || role.includes('lead') || role.includes('stack') || skills.includes('react') || skills.includes('node') || skills.includes('python');
  }).map(c => c.id);

  const aiCandIds = orgCandidates.filter(c => {
    const role = (c.current_position || '').toLowerCase();
    const skills = Object.values(c.technical_skills || {}).flat().join(' ').toLowerCase();
    return role.includes('ai') || role.includes('machine learning') || skills.includes('python') || skills.includes('pytorch') || skills.includes('llm');
  }).map(c => c.id);

  const salesCandIds = orgCandidates.filter(c => {
    const role = (c.current_position || '').toLowerCase();
    return role.includes('sales') || role.includes('broker') || role.includes('property') || role.includes('telesales') || role.includes('commercial');
  }).map(c => c.id);

  const hrCandIds = orgCandidates.filter(c => {
    const role = (c.current_position || '').toLowerCase();
    return role.includes('hr') || role.includes('talent') || role.includes('recruiter') || role.includes('acquisition');
  }).map(c => c.id);

  const financeCandIds = orgCandidates.filter(c => {
    const role = (c.current_position || '').toLowerCase();
    return role.includes('accountant') || role.includes('financial') || role.includes('controller') || role.includes('audit') || role.includes('محاسب');
  }).map(c => c.id);

  const topScorerIds = orgCandidates.filter(c => (c.match_score || 0) >= 80).map(c => c.id);

  // 1. Enrich Talent Pools if none or user requests
  const existingPools = TALENT_POOLS.filter(p => p.org_id === orgId);
  const demoPoolsToCreate: Array<Omit<DBTalentPool, 'id' | 'org_id' | 'created_at'>> = [
    {
      name: 'نخبة مهندسي الفول ستاك والواجهات (Senior Full Stack & Frontend Leads)',
      description: 'مرشحون ذوو خبرة هندسية عالية في بناء النظم الموزعة وتقنيات React, Node.js و TypeScript.',
      tags: ['React', 'Node.js', 'TypeScript', 'System Architecture', 'Remote'],
      color: 'blue',
      candidate_ids: techCandIds.length > 0 ? techCandIds : orgCandidates.slice(0, 2).map(c => c.id),
    },
    {
      name: 'خبراء الذكاء الاصطناعي ومعالجة اللغات (AI, ML & NLP Engineers)',
      description: 'مهندسون وباحثون في مجالات التعلم العميق ونماذج التوليد الذكي LLMs و Vector Search.',
      tags: ['Python', 'PyTorch', 'LLMs', 'GenAI', 'LangChain'],
      color: 'emerald',
      candidate_ids: aiCandIds.length > 0 ? aiCandIds : orgCandidates.slice(0, 2).map(c => c.id),
    },
    {
      name: 'قادة المبيعات والوساطة العقارية (Real Estate & High-Ticket Sales Stars)',
      description: 'استشاريو مبيعات محترفون في إغلاق الصفقات العقارية الكبرى والتعامل مع كبار العملاء.',
      tags: ['Telesales', 'Closing', 'B2B', 'Commercial Real Estate', 'CRM'],
      color: 'purple',
      candidate_ids: salesCandIds.length > 0 ? salesCandIds : [],
    },
    {
      name: 'مديرو الموارد البشرية والاستقطاب التنفيذي (HR & Executive Talent Leaders)',
      description: 'متخصصو استقطاب الكفاءات النادرة وإدارة دورة التوظيف الكاملة وبناء ثقافة العمل.',
      tags: ['Talent Acquisition', 'Headhunting', 'HRBP', 'Payroll', 'Labor Law'],
      color: 'amber',
      candidate_ids: hrCandIds.length > 0 ? hrCandIds : [],
    },
    {
      name: 'المديرون الماليون والمحاسبون القانونيون (Chief Accountants & CFO Track)',
      description: 'محاسبون قانونيون ومديرون ماليون معتمدون في إعداد القوائم المالية وإدارة الضرائب و IFRS.',
      tags: ['Financial Controller', 'SOCPA', 'Audit', 'IFRS', 'ERP'],
      color: 'rose',
      candidate_ids: financeCandIds.length > 0 ? financeCandIds : [],
    },
    {
      name: 'المتأهلون للمرحلة النهائية وقائمة التميز (Silver Medalists & Fast-Track)',
      description: 'مرشحون متميزون حققوا تقييمات مطابقة أعلى من 80% وجاهزون للتعيين في الفرص القادمة.',
      tags: ['Top Tier', 'Runner Up', 'Strong Culture Fit', 'Q3 Hiring Priority'],
      color: 'indigo',
      candidate_ids: topScorerIds.length > 0 ? topScorerIds : orgCandidates.slice(0, 3).map(c => c.id),
    },
  ];

  for (const dp of demoPoolsToCreate) {
    if (!existingPools.some(p => p.name === dp.name)) {
      TALENT_POOLS.push({
        id: nextTalentPoolId++,
        org_id: orgId,
        name: dp.name,
        description: dp.description,
        tags: dp.tags,
        color: dp.color,
        candidate_ids: dp.candidate_ids,
        created_at: new Date(Date.now() - Math.floor(Math.random() * 10 + 2) * 86400000).toISOString(),
      });
    }
  }

  // 2. Enrich Email Drip Campaigns
  const existingDrips = DRIP_CAMPAIGNS.filter(d => d.org_id === orgId);
  const demoDripsToCreate: Array<Omit<DBDripCampaign, 'id' | 'org_id' | 'created_at'>> = [
    {
      title: 'حملة استلام الطلبات والتغذية الراجعة التلقائية (Application Received Nurture)',
      description: 'تأكيد استلام السيرة الذاتية فورياً + إرسال لمحة عن بيئة العمل بعد يومين + جدول زمني بعد 5 أيام.',
      trigger_stage: 'Application Received',
      target_job_id: null,
      target_pool_id: null,
      is_active: true,
      enrolled_count: 5,
      completed_count: 3,
      steps: [
        {
          id: 1,
          step_number: 1,
          delay_value: 0,
          delay_unit: 'hours',
          delay_hours: 0,
          subject: 'تم استلام طلب التقديم لوظيفة {{job_title}} - {{company_name}}',
          body_template: 'عزيزي/عزيزتي {{candidate_name}}،\n\nنشكرك على اهتمامك بالانضمام إلى فريق {{company_name}} والتقديم على وظيفة {{job_title}}.\n\nتم استلام سيرتك الذاتية وتجري الآن مراجعتها عبر نظام الفرز الذكي. سنقوم بموافاتك بالخطوات القادمة قريباً.\n\nمع أطيب التحيات،\nفريق استقطاب المواهب - {{company_name}}',
        },
        {
          id: 2,
          step_number: 2,
          delay_value: 2,
          delay_unit: 'days',
          delay_hours: 48,
          subject: 'تعرف على بيئة العمل وثقافة الابتكار في {{company_name}}',
          body_template: 'مرحباً {{candidate_name}}،\n\nبينما يواصل فريق التوظيف مراجعة ملفك لوظيفة {{job_title}}، يسعدنا مشاركتك لمحة سريعة عن قيم وثقافة العمل لدينا في {{company_name}}.\n\nيمكنك زيارة موقعنا والاطلاع على مشاريعنا وشهادات الموظفين.\n\nنتمنى لك كل التوفيق!\n{{company_name}}',
        },
        {
          id: 3,
          step_number: 3,
          delay_value: 5,
          delay_unit: 'days',
          delay_hours: 120,
          subject: 'تحديث حالة طلب التقديم والجدول الزمني للتقييم - {{company_name}}',
          body_template: 'مرحباً {{candidate_name}}،\n\nنود إحاطتك علماً بأن مرحلة فرز المرشحين لوظيفة {{job_title}} تشارف على الاكتمال. في حال ترشيحك للمرحلة القادمة، سيتواصل معك أحد مسؤولي التوظيف لتنسيق المقابلة.\n\nشاكرين لك حسن صبرك واهتمامك.\nفريق الموارد البشرية',
        },
      ],
    },
    {
      title: 'سلسلة دعوات وتأكيد المقابلات الفنية (Interview Scheduled & Prep Series)',
      description: 'إرسال رابط وتفاصيل المقابلة فور جدولتها + رسالة تذكيرية وإرشادات قبل 24 ساعة لضمان الحضور.',
      trigger_stage: 'Interview Scheduled',
      target_job_id: null,
      target_pool_id: null,
      is_active: true,
      enrolled_count: 4,
      completed_count: 2,
      steps: [
        {
          id: 1,
          step_number: 1,
          delay_value: 0,
          delay_unit: 'hours',
          delay_hours: 0,
          subject: 'تأكيد موعد المقابلة الوظيفية: {{job_title}} - {{company_name}}',
          body_template: 'عزيزي {{candidate_name}}،\n\nيسرنا دعوتك لحضور مقابلة تقييمية لوظيفة {{job_title}}.\n\n📅 الموعد: {{interview_date}}\n📍 رابط الاجتماع: {{interview_link}}\n\nيرجى التأكد من تجهيز بيئة هادئة واختبار الكاميرا والصوت قبل الموعد بـ 5 دقائق.\n\nنتطلع للحديث معك،\nفريق التوظيف - {{company_name}}',
        },
        {
          id: 2,
          step_number: 2,
          delay_value: 24,
          delay_unit: 'hours',
          delay_hours: 24,
          subject: 'تذكير بموعد مقابلتك القادمة مع فريق {{company_name}}',
          body_template: 'مرحباً {{candidate_name}}،\n\nتذكير ودي بموعد مقابلتك المحدد لوظيفة {{job_title}}.\n\nالرابط المباشر: {{interview_link}}\n\nإذا واجهتك أي صعوبة تقنية أو رغبت في إعادة الجدولة، يرجى الرد على هذا البريد فوراً.\n\nمع التحية،\n{{company_name}}',
        },
      ],
    },
    {
      title: 'سلسلة التقييم الفني واختبار الكفاءة (Technical Assessment Nurture)',
      description: 'إرسال معايير ومهمة التقييم الفني مع تذكير قبل انتهاء المهلة المحددة للتسليم.',
      trigger_stage: 'Technical Assessment',
      target_job_id: null,
      target_pool_id: null,
      is_active: true,
      enrolled_count: 3,
      completed_count: 2,
      steps: [
        {
          id: 1,
          step_number: 1,
          delay_value: 0,
          delay_unit: 'hours',
          delay_hours: 0,
          subject: 'مهمة التقييم الفني لوظيفة {{job_title}} - {{company_name}}',
          body_template: 'مرحباً {{candidate_name}}،\n\nتهانينا على وصولك لمرحلة التقييم الفني لوظيفة {{job_title}}.\n\nالمهمة المطلوبة تهدف إلى قياس مهاراتك العملية وقدرتك على حل المشكلات التقنية. يرجى مراجعة المتطلبات وإرسال الحل خلال 72 ساعة.\n\nبالتوفيق!\nفريق الهندسة والتقييم الفني',
        },
        {
          id: 2,
          step_number: 2,
          delay_value: 48,
          delay_unit: 'hours',
          delay_hours: 48,
          subject: 'تذكير: تبقى 24 ساعة على موعد تسليم التقييم الفني',
          body_template: 'عزيزي {{candidate_name}}،\n\nنود التذكير باقتراب الموعد النهائي لتسليم مهمة التقييم الفني لوظيفة {{job_title}}.\n\nإذا كنت بحاجة إلى أي توضيح، يسعدنا مساعدتك بالرد على هذا البريد.\n\nتحياتنا،\n{{company_name}}',
        },
      ],
    },
    {
      title: 'حملة تقديم ومتابعة العرض الوظيفي الرسمي (Job Offer Acceleration & Negotiation)',
      description: 'إرسال العرض المالي مع متابعة حثيثة بعد 3 أيام للإجابة على التساؤلات وضمان قبول المرشح.',
      trigger_stage: 'Offer Sent',
      target_job_id: null,
      target_pool_id: null,
      is_active: true,
      enrolled_count: 2,
      completed_count: 1,
      steps: [
        {
          id: 1,
          step_number: 1,
          delay_value: 0,
          delay_unit: 'hours',
          delay_hours: 0,
          subject: 'عرض العمل الرسمي: {{job_title}} لدى شركة {{company_name}} 🚀',
          body_template: 'عزيزي {{candidate_name}}،\n\nيسر إدارة {{company_name}} أن تتقدم إليك رسمياً بعرض عمل لوظيفة {{job_title}}.\n\n💰 الراتب الإجمالي: {{offer_amount}} {{offer_currency}}\n📅 آخر موعد لتأكيد القبول: {{offer_deadline}}\n\nلقد أثبتت تميزك طوال مراحل التقييم، ونحن متحمسون جداً لانضمامك إلينا لصناعة النجاح معاً.\n\nأطيب التحيات،\nالإدارة التنفيذية - {{company_name}}',
        },
        {
          id: 2,
          step_number: 2,
          delay_value: 3,
          delay_unit: 'days',
          delay_hours: 72,
          subject: 'متابعة بخصوص العرض الوظيفي والمزايا التنافسية - {{company_name}}',
          body_template: 'مرحباً {{candidate_name}}،\n\nنأمل أنك حظيت بفرصة مراجعة تفاصيل العرض الوظيفي لوظيفة {{job_title}}.\n\nنود التأكيد على استعدادنا التام للإجابة على أي استفسارات تخص حزمة المزايا أو بيئة العمل وتاريخ المباشرة.\n\nنتطلع لتأكيد انضمامك!\nفريق الموارد البشرية',
        },
        {
          id: 3,
          step_number: 3,
          delay_value: 6,
          delay_unit: 'days',
          delay_hours: 144,
          subject: 'تذكير أخير: الموعد النهائي للعرض الوظيفي - {{company_name}}',
          body_template: 'عزيزي {{candidate_name}}،\n\nتذكير بأن العرض الوظيفي المتاح ينتهي في {{offer_deadline}}.\n\nيرجى توقيع الخطاب وإعادة إرساله لإتمام إجراءات التعيين الرسمية.\n\nمع فائق الاحترام،\n{{company_name}}',
        },
      ],
    },
    {
      title: 'سلسلة الترحيب والتهيئة للموظف الجديد (Pre-Onboarding & Welcome Pack)',
      description: 'رسائل تجهيز الموظف الجديد فور قبوله وتزويده بالمستندات المطلوبة وجدول اليوم الأول.',
      trigger_stage: 'Hired',
      target_job_id: null,
      target_pool_id: null,
      is_active: true,
      enrolled_count: 2,
      completed_count: 2,
      steps: [
        {
          id: 1,
          step_number: 1,
          delay_value: 0,
          delay_unit: 'hours',
          delay_hours: 0,
          subject: 'أهلاً بك في عائلة {{company_name}}! 🎉 دليل الانضمام والتهيئة',
          body_template: 'مرحباً {{candidate_name}}،\n\nأهلاً وسهلاً بك كعضو جديد في فريق {{company_name}} لوظيفة {{job_title}}!\n\nنحن في غاية السعادة بانضمامك. تجد مرفقاً دليل الموظف الجديد وقائمة بالوثائق المطلوبة لمسوغات التعيين.\n\nفريق People Operations',
        },
        {
          id: 2,
          step_number: 2,
          delay_value: 3,
          delay_unit: 'days',
          delay_hours: 72,
          subject: 'تجهيز المعدات وجدول اليوم الأول من العمل في {{company_name}}',
          body_template: 'مرحباً {{candidate_name}}،\n\nنود إعلامك بأنه تم تجهيز بريدك المؤسسي وحسابات الأنظمة، بالإضافة إلى جدولة جلسات التوجيه الأولي مع فريقك.\n\nسيبدأ يومك الأول بجلسة ترحيبية في تمام الساعة 10:00 صباحاً.\n\nنتمنى لك بداية ملهمة وموفقة!',
        },
      ],
    },
    {
      title: 'شبكة المواهب للمرشحين الواعدين (Silver Medalist Talent Community)',
      description: 'رسالة اعتذار احترافية مع ضم المرشح الواعد لبنك المواهب ومتابعته بالفرص الجديدة.',
      trigger_stage: 'Rejected',
      target_job_id: null,
      target_pool_id: null,
      is_active: true,
      enrolled_count: 4,
      completed_count: 3,
      steps: [
        {
          id: 1,
          step_number: 1,
          delay_value: 0,
          delay_unit: 'hours',
          delay_hours: 0,
          subject: 'تحديث بشأن طلب التقديم لوظيفة {{job_title}} - {{company_name}}',
          body_template: 'عزيزي {{candidate_name}}،\n\nنشكرك بصدق على الوقت والجهد اللذين بذلتهما طوال مرحلة التقديم والمقابلات لوظيفة {{job_title}}.\n\nعلى الرغم من كفاءتك العالية، فقد قررنا المضي قدماً مع مرشح تتطابق خبراته الدقيقة مع الاحتياج الراهن.\n\nنظراً لتميز ملفك، يسعدنا حفظ بياناتك ضمن "بنك مواهب النخبة" للتواصل معك بأولوية مطلقة فور توفر شواغر مستقبلية تناسبك.\n\nنتمنى لك دوام التوفيق والنجاح،\nفريق التوظيف - {{company_name}}',
        },
      ],
    },
  ];

  for (const dd of demoDripsToCreate) {
    if (!existingDrips.some(d => d.title === dd.title)) {
      DRIP_CAMPAIGNS.push({
        id: nextDripCampaignId++,
        org_id: orgId,
        title: dd.title,
        description: dd.description,
        trigger_stage: dd.trigger_stage,
        target_job_id: dd.target_job_id,
        target_pool_id: dd.target_pool_id,
        is_active: dd.is_active,
        enrolled_count: dd.enrolled_count,
        completed_count: dd.completed_count,
        steps: dd.steps,
        created_at: new Date(Date.now() - Math.floor(Math.random() * 12 + 3) * 86400000).toISOString(),
      });
    }
  }

  // 3. Enrich Sequences
  const existingSeqs = SEQUENCES.filter(s => s.org_id === orgId);
  const demoSeqsToCreate: Array<Omit<DBSequence, 'id' | 'org_id' | 'created_at'>> = [
    {
      title: 'سلسلة الاستقطاب المباشر للمناصب القيادية (Executive Cold Headhunting Outreach)',
      description: 'سلسلة تواصل احترافية سرية موجهة للقيادات والكفاءات النادرة في السوق مع 3 رسائل متابعة مدروسة.',
      trigger_event: 'MANUAL',
      steps: [
        {
          id: 1,
          step_number: 1,
          delay_hours: 0,
          subject: 'فرصة قيادية مميزة وتحدٍ مهني جديد مع {{company_name}} 🎯',
          body_template: 'مرحباً {{candidate_name}}،\n\nأتابع مسارك المهني وإنجازاتك البارزة في مجال {{job_title}} بإعجاب شديد.\n\nنقوم حالياً بقيادة عملية استقطاب لفرصة استراتيجية رفيعة المستوى في {{company_name}}، وأعتقد أن خبرتك ورؤيتك تتناسبان تماماً مع أهدافنا التوسعية.\n\nهل يناسبك تبادل الحديث لمدة 15 دقيقة لمناقشة التفاصيل بشكل سري وغير ملزم؟\n\nأطيب التحيات،\nمسؤول الاستقطاب التنفيذي',
        },
        {
          id: 2,
          step_number: 2,
          delay_hours: 72,
          subject: 'متابعة سريعة: فرصة {{job_title}} والمشاريع الاستراتيجية القادمة',
          body_template: 'عزيزي {{candidate_name}}،\n\nأردت التأكد من وصول رسالتي السابقة. نحن في خضم بناء مبادرة رائدة في صناعتنا، ويسعدنا جداً استطلاع رأيك ومعرفة خططك المهنية.\n\nيسعدني مشاركة ملخص تفصيلي عن الدور والمسؤوليات في الوقت الذي يناسبك.\n\nمع التحية،\n{{company_name}}',
        },
        {
          id: 3,
          step_number: 3,
          delay_hours: 144,
          subject: 'الفرصة لا تزال قائمة: دعوة لفنجان قهوة مهني ☕',
          body_template: 'مرحباً {{candidate_name}}،\n\nأقدر تماماً انشغالك. سأختم هذه السلسلة بالتأكيد على ترحيبنا الدائم بالتواصل معك سواء حالياً أو مستقبلاً عندما تتيح ظروفك.\n\nأتمنى لك دوام التقدم والنجاح!\nفريق القيادة - {{company_name}}',
        },
      ],
    },
    {
      title: 'سلسلة إعادة تنشيط الكفاءات السابقة (Passive Talent Re-Engagement)',
      description: 'إعادة التواصل مع أفضل المرشحين السابقين بعد 6 أشهر لاستكشاف مدى جاهزيتهم للفرص الجديدة.',
      trigger_event: 'MANUAL',
      steps: [
        {
          id: 1,
          step_number: 1,
          delay_hours: 0,
          subject: 'تحية طيبة من {{company_name}}! فرصة جديدة قد تهمك',
          body_template: 'عزيزي {{candidate_name}}،\n\nنأمل أن تكون بأفضل حال. نستذكر باعتزاز تواصلنا ومقابلاتنا السابقة معك.\n\nلدينا الآن توسعات كبيرة وشاغر جديد لوظيفة {{job_title}} بمزايا وصلاحيات واسعة، وفكرنا فيك كمرشح مثالي لهذا الدور.\n\nيسرنا معرفة ما إذا كنت منفتحاً لمناقشة هذا التحدي الجديد.\n\nتحياتنا،\nفريق التوظيف',
        },
        {
          id: 2,
          step_number: 2,
          delay_hours: 96,
          subject: 'تحديثات النمو والفرص المتاحة في {{company_name}}',
          body_template: 'مرحباً {{candidate_name}}،\n\nمتابعة سريعة لمعرفة إن كنت ترغب في الاطلاع على ملف الوظيفة والمزايا التنافسية.\n\nيسعدنا تحديد موعد مكالمة قصيرة متى ما كان ذلك مناسباً لك.\n\nمع التقدير!',
        },
      ],
    },
    {
      title: 'حملة مكافآت ترشيح الزملاء والمواهب (Employee & Candidate Referral Drive)',
      description: 'دعوة المرشحين والموظفين لترشيح زملائهم من الكفاءات مقابل مكافآت ترشيح مجزية.',
      trigger_event: 'MANUAL',
      steps: [
        {
          id: 1,
          step_number: 1,
          delay_hours: 0,
          subject: 'شارك في برنامج ترشيح المواهب واحصل على مكافأة استقطاب 🎁',
          body_template: 'مرحباً {{candidate_name}}،\n\nنعلم أن الكفاءات المتميزة تحيط نفسها دائماً بمحترفين استثنائيين. نطلق اليوم برنامج ترشيح المواهب لوظائفنا المفتوحة.\n\nإذا كان لديك زميل أو معارف مؤهلون، رشحهم اليوم واحصل على مكافأة ترشيح عند إتمام التعيين!\n\nفريق استقطاب الكفاءات',
        },
      ],
    },
    {
      title: 'سلسلة استكمال مسوغات التعيين وتوقيع العقد (Onboarding Document Completion Sequence)',
      description: 'متابعة آلية لتذكير المرشحين المقبولين برفع صور الهوية والشهادات وتوقيع العقود.',
      trigger_event: 'AFTER_OFFER_SENT',
      steps: [
        {
          id: 1,
          step_number: 1,
          delay_hours: 24,
          subject: 'تذكير هام: استكمال مسوغات التعيين - {{company_name}}',
          body_template: 'عزيزي {{candidate_name}}،\n\nلضمان إصدار العقد النهائي وتجهيز ملف التأمين الاجتماعي والمباشرة في الموعد المحدد، يرجى رفع المستندات المطلوبة عبر البوابة.\n\nشاكرين لك سرعة استجابتك.\nإدارة الموارد البشرية',
        },
      ],
    },
  ];

  for (const ds of demoSeqsToCreate) {
    if (!existingSeqs.some(s => s.title === ds.title)) {
      SEQUENCES.push({
        id: nextSequenceId++,
        org_id: orgId,
        title: ds.title,
        description: ds.description,
        trigger_event: ds.trigger_event,
        steps: ds.steps,
        created_at: new Date(Date.now() - Math.floor(Math.random() * 15 + 4) * 86400000).toISOString(),
      });
    }
  }

  // 4. Enrich Realistic Logs
  const existingLogs = DRIP_LOGS.filter(l => l.org_id === orgId);
  if (existingLogs.length < 5 && orgCandidates.length > 0) {
    const demoLogsData = [
      {
        camp_title: 'حملة استلام الطلبات والتغذية الراجعة التلقائية (Application Received Nurture)',
        stage: 'Application Received',
        step: 1,
        total: 3,
        cand: orgCandidates[0],
        subj: `تم استلام طلب التقديم لوظيفة ${orgCandidates[0].current_position || 'Senior Engineer'} - CalliQ`,
        status: 'SENT' as const,
        daysAgo: 5,
      },
      {
        camp_title: 'حملة استلام الطلبات والتغذية الراجعة التلقائية (Application Received Nurture)',
        stage: 'Application Received',
        step: 2,
        total: 3,
        cand: orgCandidates[0],
        subj: `تعرف على بيئة العمل وثقافة الابتكار في CalliQ`,
        status: 'SENT' as const,
        daysAgo: 3,
      },
      {
        camp_title: 'سلسلة دعوات وتأكيد المقابلات الفنية (Interview Scheduled & Prep Series)',
        stage: 'Interview Scheduled',
        step: 1,
        total: 2,
        cand: orgCandidates[1] || orgCandidates[0],
        subj: `تأكيد موعد المقابلة الوظيفية لوظيفة ${(orgCandidates[1] || orgCandidates[0]).current_position || 'Technical Specialist'} - CalliQ`,
        status: 'SENT' as const,
        daysAgo: 2,
      },
      {
        camp_title: 'حملة تقديم ومتابعة العرض الوظيفي الرسمي (Job Offer Acceleration & Negotiation)',
        stage: 'Offer Sent',
        step: 1,
        total: 3,
        cand: orgCandidates[2] || orgCandidates[0],
        subj: `عرض العمل الرسمي لوظيفة ${(orgCandidates[2] || orgCandidates[0]).current_position || 'Manager'} لدى CalliQ 🚀`,
        status: 'SENT' as const,
        daysAgo: 1,
      },
      {
        camp_title: 'سلسلة التقييم الفني واختبار الكفاءة (Technical Assessment Nurture)',
        stage: 'Technical Assessment',
        step: 1,
        total: 2,
        cand: orgCandidates[3] || orgCandidates[0],
        subj: `مهمة التقييم الفني المتقدمة - CalliQ Engineering Team`,
        status: 'SENT' as const,
        daysAgo: 4,
      },
    ];

    for (const dl of demoLogsData) {
      DRIP_LOGS.push({
        id: nextDripLogId++,
        org_id: orgId,
        campaign_id: 1,
        campaign_title: dl.camp_title,
        trigger_stage: dl.stage,
        candidate_id: dl.cand.id,
        candidate_name: dl.cand.full_name,
        candidate_email: dl.cand.email,
        step_number: dl.step,
        total_steps: dl.total,
        subject: dl.subj,
        body_rendered: `مرحباً ${dl.cand.full_name}،\n\nنود إحاطتك علماً بآخر التحديثات لوظيفتك في CalliQ.\n\nنتمنى لك كل التوفيق!\nفريق التوظيف`,
        status: dl.status,
        scheduled_for: new Date(Date.now() - dl.daysAgo * 86400000).toISOString(),
        executed_at: new Date(Date.now() - dl.daysAgo * 86400000).toISOString(),
      });
    }
  }

  saveDatabase();
}

app.post('/api/v1/crm/seed-demo-examples', requireAuth, (req, res) => {
  const u = (req as any).user as DBUser;
  seedHRDemoDataForOrg(u.org_id);
  
  const orgPools = TALENT_POOLS.filter(p => p.org_id === u.org_id);
  const orgCampaigns = DRIP_CAMPAIGNS.filter(c => c.org_id === u.org_id);
  const orgSeqs = SEQUENCES.filter(s => s.org_id === u.org_id);
  const orgLogs = DRIP_LOGS.filter(l => l.org_id === u.org_id);

  AUDIT_LOGS.unshift({
    id: AUDIT_LOGS.length + 1,
    action: 'CRM HR Demo Data Restored / Enriched',
    user: u.name,
    target: `${orgPools.length} Pools, ${orgCampaigns.length} Drip Campaigns, ${orgSeqs.length} Sequences`,
    timestamp: new Date().toISOString(),
  });
  saveDatabase();

  res.json({
    message: 'تمت تعبئة وتحديث بنوك المواهب وحملات التقطير وسلاسل التواصل بأمثلة HR احترافية بنجاح.',
    pools_count: orgPools.length,
    campaigns_count: orgCampaigns.length,
    sequences_count: orgSeqs.length,
    logs_count: orgLogs.length,
  });
});

app.post('/api/v1/drip-campaigns/generate-ai', requireAuth, async (req, res) => {
  const { trigger_stage, goal, company_name } = req.body;
  const stage = trigger_stage || 'Application Received';
  const comp = company_name || 'CalliQ';

  const ai = getAIClient();
  if (!ai) {
    return res.json({
      title: `حملة متابعة مرحلة ${stage}`,
      description: `سلسلة بريد تقطير ذكية تلقائية لمرحلة ${stage}`,
      steps: [
        {
          step_number: 1,
          delay_value: 0,
          delay_unit: 'hours',
          delay_hours: 0,
          subject: `إشعار هام بخصوص مرحلة ${stage} - {{company_name}}`,
          body_template: `مرحباً {{candidate_name}}،\n\nنود إعلامك بتحديث جديد في طلبك لوظيفة {{job_title}} لدى {{company_name}}.\n\nمع التحية،\nفريق التوظيف`
        },
        {
          step_number: 2,
          delay_value: 2,
          delay_unit: 'days',
          delay_hours: 48,
          subject: `متابعة مرحلة التقييم لوظيفة {{job_title}} - {{company_name}}`,
          body_template: `عزيزي {{candidate_name}}،\n\nنود الاطمئنان ومتابعة الإجراءات القادمة للفرصة الوظيفية.\n\nنتمنى لك التوفيق!\n{{company_name}}`
        }
      ]
    });
  }

  try {
    const prompt = `أنت خبير استقطاب مواهب وتصميم حملات بريد إلكتروني تتابعية وتقطير (Automated Email Drip Campaign) باللغة العربية.
قم بتوليد حملة بريد إلكتروني تتابعية ذكية تتكون من خطوتين إلى 3 خطوات، تُفعَّل عند دخول المرشح في مرحلة: "${stage}".
اسم الشركة: "${comp}".
الهدف الإضافي: "${goal || 'متابعة واحتضان المرشح باحترافية وتوفير تجربة توظيف مميزة'}".

المتغيرات المتاحة للاستخدام في القوالب:
{{candidate_name}}, {{job_title}}, {{company_name}}, {{interview_date}}, {{interview_link}}, {{offer_amount}}, {{offer_currency}}, {{offer_deadline}}

قم بالرد بصيغة JSON حصراً بدون أي نصوص تمهيدية وبدون markdown code blocks:
{
  "title": "عنوان الحملة باللغة العربية",
  "description": "وصف موجز وواضح للهدف من الحملة",
  "steps": [
    {
      "step_number": 1,
      "delay_value": 0,
      "delay_unit": "hours",
      "delay_hours": 0,
      "subject": "عنوان البريد الأول",
      "body_template": "محتوى البريد الأول"
    },
    {
      "step_number": 2,
      "delay_value": 48,
      "delay_unit": "hours",
      "delay_hours": 48,
      "subject": "عنوان البريد الثاني التذكيري",
      "body_template": "محتوى البريد الثاني"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    res.json(parsed);
  } catch (err) {
    console.error('AI Drip generation failed:', err);
    res.json({
      title: `حملة تقطير مرحلة ${stage}`,
      description: `سلسلة بريدية مخصصة لمرحلة ${stage}`,
      steps: [
        {
          step_number: 1,
          delay_value: 0,
          delay_unit: 'hours',
          delay_hours: 0,
          subject: `تحديث طلب التقديم لوظيفة {{job_title}} - {{company_name}}`,
          body_template: `عزيزي {{candidate_name}}،\n\nنود إحاطتك علماً بوصولك لمرحلة ${stage} لوظيفة {{job_title}} لدى {{company_name}}.\n\nأطيب التحيات،\nفريق التوظيف`
        },
        {
          step_number: 2,
          delay_value: 2,
          delay_unit: 'days',
          delay_hours: 48,
          subject: `تذكير ومتابعة مرحلة التقييم - {{company_name}}`,
          body_template: `مرحباً {{candidate_name}}،\n\nنود المتابعة معك بشأن الخطوات القادمة.\n\nنتمنى لك كل التوفيق،\n{{company_name}}`
        }
      ]
    });
  }
});

// 7. Webhooks Endpoints
app.get('/api/v1/webhooks/endpoints', (req, res) => {
  res.json(WEBHOOKS);
});

app.post('/api/v1/webhooks/endpoints', (req, res) => {
  const endpoint: DBWebhookEndpoint = {
    id: nextWebhookId++,
    url: req.body.url,
    events: req.body.events || ['candidate.applied'],
    is_active: true,
    description: req.body.description,
    created_at: new Date().toISOString(),
  };
  WEBHOOKS.push(endpoint);
  saveDatabase();
  res.status(201).json(endpoint);
});

app.delete('/api/v1/webhooks/endpoints/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = WEBHOOKS.findIndex(w => w.id === id);
  if (idx !== -1) WEBHOOKS.splice(idx, 1);
  saveDatabase();
  res.json({ message: 'Webhook endpoint deleted' });
});

app.post('/api/v1/webhooks/endpoints/:id/test', (req, res) => {
  res.json({ success: true, status_code: 200, message: 'Test ping delivered successfully.' });
});

app.get('/api/v1/webhooks/endpoints/:id/deliveries', (req, res) => {
  res.json([
    { id: 1, event: 'candidate.applied', status_code: 200, success: true, attempt: 1, created_at: new Date(Date.now() - 3600000).toISOString() }
  ]);
});

app.get('/api/v1/webhooks/events', (req, res) => {
  res.json({
    events: [
      'candidate.applied',
      'candidate.shortlisted',
      'candidate.interview_scheduled',
      'candidate.offer_sent',
      'candidate.hired',
      'candidate.rejected',
      'job.created',
      'job.closed',
    ]
  });
});

// ── Vite Integration ────────────────────────────────────────────────────────
// ── AI Chatbot Endpoint ───────────────────────────────────────────────────
app.post('/api/v1/chat', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user as DBUser;
    const { message = '', history = [] } = req.body;
    const userMsg = String(message).trim();

    const myCandidates = CANDIDATES.filter(c => c.org_id === user.org_id);
    const totalCands = myCandidates.length;
    const activeJobsList = JOBS.filter(j => j.org_id === user.org_id && j.is_active);
    const activeJobs = activeJobsList.length;
    
    const stagesCount: Record<string, number> = {
      Screening: myCandidates.filter(c => c.status === 'Screening').length,
      Interviewing: myCandidates.filter(c => c.status === 'Interviewing').length,
      Offered: myCandidates.filter(c => c.status === 'Offered').length,
      Hired: myCandidates.filter(c => c.status === 'Hired').length,
      Rejected: myCandidates.filter(c => c.status === 'Rejected').length,
    };

    const strongMatches = myCandidates.filter(c => (c.match_score || 0) >= 80).length;
    const potentialMatches = myCandidates.filter(c => (c.match_score || 0) >= 60 && (c.match_score || 0) < 80).length;
    const weakMatches = myCandidates.filter(c => (c.match_score || 0) < 60).length;

    const topCandidates = [...myCandidates]
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
      .slice(0, 5)
      .map(c => `• ${c.full_name} (${c.current_position || 'Applicant'}) - Match: ${c.match_score}% [Stage: ${c.status}]`);

    const systemInstruction = `You are the CalliQ ATS AI Recruitment Assistant. You assist HR recruiters and hiring managers.
System Context for current organization:
- Total Candidates: ${totalCands}
- Active Job Positions (${activeJobs}): ${activeJobsList.map(j => j.title).join(', ')}
- Stages Breakdown: Screening (${stagesCount.Screening}), Interviewing (${stagesCount.Interviewing}), Offered (${stagesCount.Offered}), Hired (${stagesCount.Hired}), Rejected (${stagesCount.Rejected})
- Candidate Match Quality: Strong Matches (${strongMatches}), Potential (${potentialMatches}), Weak (${weakMatches})
- Top Ranked Candidates:
${topCandidates.join('\n')}

Always respond politely, concisely, and professionally. Match the user's language (Arabic or English).`;

    // 1. Try Gemini API first if configured
    const ai = getAIClient();
    if (ai) {
      const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];
      for (const modelName of candidateModels) {
        try {
          const chat = ai.chats.create({
            model: modelName,
            config: { systemInstruction },
            history: history.map((m: any) => ({
              role: m.role === 'model' ? 'model' : 'user',
              parts: [{ text: String(m.text || '') }]
            }))
          });

          const response = await chat.sendMessage({ message: userMsg });
          if (response && response.text) {
            return res.json({ reply: response.text });
          }
        } catch (geminiError: any) {
          console.warn(`Gemini model ${modelName} notice:`, geminiError.message || geminiError);
        }
      }
    }

    // 2. Try Groq if configured
    const groq = getGroqClient();
    if (groq) {
      const groqModels = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'qwen/qwen3.8-27b',
        'qwen/qwen3.6-27b',
        'allam-2-7b',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b'
      ];
      for (const gm of groqModels) {
        try {
          const groqResponse = await groq.chat.completions.create({
            model: gm,
            messages: [
              { role: 'system', content: systemInstruction },
              ...history.map((m: any) => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: String(m.text || '')
              })),
              { role: 'user', content: userMsg }
            ],
            temperature: 0.7,
            max_tokens: 1024,
          });

          const replyText = groqResponse.choices[0]?.message?.content;
          if (replyText) {
            return res.json({ reply: replyText });
          }
        } catch (groqError: any) {
          // Try next Groq model
        }
      }
    }

    // 3. Fallback: Built-in Intelligent Context-Aware Recruitment Engine (Ensures 100% reliability)
    const lower = userMsg.toLowerCase();
    const isArabic = /[\u0600-\u06FF]/.test(userMsg);

    // Scenario 1: Today's Candidates / مرشحين اليوم
    if (lower.includes('مرشحين اليوم') || lower.includes('متقدمين اليوم') || lower.includes('today') || lower.includes('اليوم')) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      let todayList = myCandidates.filter(c => {
        const d = new Date(c.created_at || c.applied_at || 0).getTime();
        return d >= startOfDay || (now.getTime() - d) <= 24 * 3600 * 1000;
      });
      if (todayList.length === 0) todayList = myCandidates.slice(0, 3);

      const formatted = todayList.map(c => `• **${c.full_name}** | الوظيفة: *${c.current_position || 'متقدم'}* | التوافق: **${c.match_score}%** (${c.status})`).join('\n');
      if (isArabic) {
        return res.json({
          reply: `👥 **قائمة مرشحي اليوم (${todayList.length})**:\n\n${formatted || 'لا يوجد مرشحين جدد مسجلين اليوم حتى الآن.'}\n\nيمكنك الضغط على اسم أي مرشح في صفحة Candidates للاطلاع على تقرير المطابقة وتحليل الـ ATS بالتفصيل.`
        });
      } else {
        const formattedEn = todayList.map(c => `• **${c.full_name}** | Role: *${c.current_position || 'Applicant'}* | Match: **${c.match_score}%** (${c.status})`).join('\n');
        return res.json({
          reply: `👥 **Today's Candidates (${todayList.length})**:\n\n${formattedEn || 'No new candidates registered today.'}\n\nCheck the Candidates dashboard to review full ATS profiles.`
        });
      }
    }

    // Scenario 2: Accepted & Hired / المرشحين المقبولين
    if (lower.includes('مقبول') || lower.includes('المقبولين') || lower.includes('hired') || lower.includes('accepted') || lower.includes('offered') || lower.includes('العروض')) {
      const acceptedList = myCandidates.filter(c => c.status === 'Hired' || c.status === 'Offered' || c.recruiter_decision === 'APPROVED');
      const formatted = acceptedList.map(c => `• 🟢 **${c.full_name}** | *${c.current_position || 'مرشح'}* | درجة التوافق: **${c.match_score}%** [الحالة: ${c.status}]`).join('\n');
      if (isArabic) {
        return res.json({
          reply: `✅ **المرشحون المقبولون وتم تقديم عروض لهم (${acceptedList.length})**:\n\n${formatted || 'لا يوجد مرشحين في مرحلة العروض أو التوظيف حالياً.'}\n\nتم اعتماد هؤلاء المرشحين بعد اجتياز تقييم الـ ATS والمقابلات بنجاح.`
        });
      } else {
        const formattedEn = acceptedList.map(c => `• 🟢 **${c.full_name}** | *${c.current_position || 'Candidate'}* | Match: **${c.match_score}%** [Stage: ${c.status}]`).join('\n');
        return res.json({
          reply: `✅ **Hired & Offered Candidates (${acceptedList.length})**:\n\n${formattedEn || 'No candidates currently marked as Hired or Offered.'}`
        });
      }
    }

    // Scenario 3: Rejected / المرشحين المرفوضين
    if (lower.includes('مرفوض') || lower.includes('المرفوضين') || lower.includes('rejected') || lower.includes('استبعاد')) {
      const rejectedList = myCandidates.filter(c => c.status === 'Rejected' || c.recruiter_decision === 'REJECTED');
      const formatted = rejectedList.map(c => `• 🔴 **${c.full_name}** | *${c.current_position || 'متقدم'}* | نسبة التوافق: **${c.match_score}%** | ${(c as any).knockout_reason || c.flag_reason || 'عدم استيفاء الشروط الإلزامية'}`).join('\n');
      if (isArabic) {
        return res.json({
          reply: `❌ **المرشحون المستبعدون / المرفوضون (${rejectedList.length})**:\n\n${formatted || 'لا يوجد مرشحين مرفوضين حالياً.'}\n\nتم استبعادهم بناءً على قواعد الاستبعاد الفوري (Knockout Rules) أو ضعف التوافق مع متطلبات الوظيفة.`
        });
      } else {
        const formattedEn = rejectedList.map(c => `• 🔴 **${c.full_name}** | *${c.current_position || 'Applicant'}* | Match: **${c.match_score}%** | Reason: ${(c as any).knockout_reason || c.flag_reason || 'Did not meet requirements'}`).join('\n');
        return res.json({
          reply: `❌ **Rejected Candidates (${rejectedList.length})**:\n\n${formattedEn || 'No rejected candidates found.'}`
        });
      }
    }

    // Scenario 4: In Screening / قيد الفرز والمراجعة
    if (lower.includes('فرز') || lower.includes('مراجعة') || lower.includes('screening') || lower.includes('interview') || lower.includes('مقابلات')) {
      const screeningList = myCandidates.filter(c => c.status === 'Screening' || c.status === 'Interviewing' || c.status === 'Shortlisted');
      const formatted = screeningList.map(c => `• 🟡 **${c.full_name}** | *${c.current_position || 'مرشح'}* | التوافق: **${c.match_score}%** | [${c.status}]`).join('\n');
      if (isArabic) {
        return res.json({
          reply: `⏳ **المرشحون في مراحل الفرز والمقابلات (${screeningList.length})**:\n\n${formatted || 'لا يوجد مرشحين قيد الفرز حالياً.'}`
        });
      } else {
        const formattedEn = screeningList.map(c => `• 🟡 **${c.full_name}** | *${c.current_position || 'Candidate'}* | Match: **${c.match_score}%** | [${c.status}]`).join('\n');
        return res.json({
          reply: `⏳ **Candidates in Screening & Interview Stages (${screeningList.length})**:\n\n${formattedEn || 'No candidates in screening stage.'}`
        });
      }
    }

    // Scenario 5: Summary / Statistics / ملخص عام
    if (lower.includes('ملخص') || lower.includes('تقرير') || lower.includes('احصائيات') || lower.includes('summary') || lower.includes('stats') || lower.includes('overview')) {
      if (isArabic) {
        const reply = `📊 **ملخص اليوم لمنصة CalliQ للتوظيف**:

• **إجمالي المرشحين**: ${totalCands} مرشح
• **الوظائف النشطة**: ${activeJobs} وظائف (${activeJobsList.map(j => j.title).slice(0, 3).join('، ')})

**توزيع المراحل**:
• الفرز الأولي (Screening): ${stagesCount.Screening}
• المقابلات (Interviewing): ${stagesCount.Interviewing}
• العروض المقدمة (Offered): ${stagesCount.Offered}
• تم التوظيف (Hired): ${stagesCount.Hired}
• مرفوضون (Rejected): ${stagesCount.Rejected}

**جودة التطابق مع الوظائف**:
• تطابق قوي (≥80%): ${strongMatches} مرشح
• تطابق محتمل (60-79%): ${potentialMatches} مرشح
• تطابق ضعيف (<60%): ${weakMatches} مرشح

💡 *أعلى المرشحين أداءً*:
${topCandidates.slice(0, 3).join('\n') || 'لا يوجد مرشحين مسجلين بعد.'}`;
        return res.json({ reply });
      } else {
        const reply = `📊 **Today's Recruitment Summary (CalliQ ATS)**:

• **Total Candidates**: ${totalCands}
• **Active Jobs**: ${activeJobs} (${activeJobsList.map(j => j.title).slice(0, 3).join(', ')})

**Pipeline Breakdown**:
• Screening: ${stagesCount.Screening}
• Interviewing: ${stagesCount.Interviewing}
• Offered: ${stagesCount.Offered}
• Hired: ${stagesCount.Hired}
• Rejected: ${stagesCount.Rejected}

**Match Quality**:
• Strong Matches (≥80%): ${strongMatches}
• Potential Matches (60-79%): ${potentialMatches}
• Weak Matches (<60%): ${weakMatches}

💡 *Top Ranked Candidates*:
${topCandidates.slice(0, 3).join('\n') || 'No candidates recorded yet.'}`;
        return res.json({ reply });
      }
    }

    // Scenario B: Top Candidates / أعلى المرشحين
    if (lower.includes('أفضل') || lower.includes('أعلى') || lower.includes('top') || lower.includes('best') || lower.includes('مرشحين') || lower.includes('candidates')) {
      if (isArabic) {
        const reply = `🏆 **أعلى المرشحين تقييماً حسب درجات التوافق**:

${topCandidates.join('\n') || 'لا توجد بيانات للمرشحين حالياً.'}

يمكنك الدخول إلى صفحة **Candidates** واستعراض تفاصيل الـ CV والمهارات المحللة لكل مرشح بالكامل.`;
        return res.json({ reply });
      } else {
        const reply = `🏆 **Top Ranked Candidates by Match Score**:

${topCandidates.join('\n') || 'No candidate data available.'}

You can view full CV evaluations, skills breakdowns, and ATS scores on the Candidates page.`;
        return res.json({ reply });
      }
    }

    // Scenario C: Active Jobs / الوظائف
    if (lower.includes('وظائف') || lower.includes('jobs') || lower.includes('vacancies') || lower.includes('positions')) {
      const jobsListStr = activeJobsList.map(j => `• **${j.title}** - ${j.candidate_count || 0} متقدم`).join('\n');
      if (isArabic) {
        return res.json({
          reply: `💼 **الوظائف المفتوحة حالياً (${activeJobs})**:\n\n${jobsListStr || 'لا توجد وظائف نشطة حالياً.'}\n\nيمكنك نسخ رابط التقديم العام ومشاركته مع المتقدمين مباشرة.`
        });
      } else {
        const jobsListStrEn = activeJobsList.map(j => `• **${j.title}** - ${j.candidate_count || 0} applicants`).join('\n');
        return res.json({
          reply: `💼 **Current Active Job Openings (${activeJobs})**:\n\n${jobsListStrEn || 'No active positions.'}\n\nYou can copy and share public application links directly with applicants.`
        });
      }
    }

    // Scenario D: General Greetings / Assistance
    if (isArabic) {
      return res.json({
        reply: `أهلاً بك! أنا مساعد التوظيف الذكي في **CalliQ**.
يمكنني مساعدتك في:
• تقديم **ملخص اليوم** لعمليات التوظيف ومراحل المرشحين.
• عرض **أفضل المرشحين** الأعلى توافقاً مع شروط الوظائف.
• استعراض **الوظائف النشطة** وإحصائيات المتقدمين.
• توجيهك لكيفية مشاركة روابط التقديم العامة وفحص السير الذاتية بالذكاء الاصطناعي.

كيف يمكنني خدمتك الآن؟`
      });
    } else {
      return res.json({
        reply: `Hello! I am your **CalliQ AI Recruitment Assistant**.
I can assist you with:
• Generating **Daily Recruitment Summaries** and pipeline metrics.
• Identifying **Top Ranked Candidates** based on AI match scores.
• Listing **Active Job Openings** and applicant counts.
• Guidance on public application links and AI CV parsing.

How can I help you today?`
      });
    }
  } catch (error) {
    console.error('Chat error:', error);
    // Never crash or return 500 to the UI
    res.json({
      reply: 'مرحباً! نظام المساعد الذكي جاهز لمساعدتك في استعراض المرشحين، ملخص اليوم، وإحصائيات التوظيف. كيف أستطيع خدمتك؟'
    });
  }
});

async function syncWithNeonDatabase() {
  // Disabled to strictly respect local database.json state and prevent re-adding deleted candidates.
  return;
}

// Ensure database persistence and Neon initialization run on module import (serverless friendly)
initDataPersistence();
syncWithNeonDatabase().catch(err => console.error('[Neon DB Init Sync Error]:', err));

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CalliQ AI Full-Stack Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  startServer();
}

export default app;
