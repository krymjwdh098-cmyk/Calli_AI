import React from 'react';
import {
  User, Mail, Phone, MapPin, Briefcase, GraduationCap, Award,
  Sparkles, CheckCircle2, XCircle, ArrowUpRight, ChevronLeft,
  Calendar, Layers, FileText, Send, Clock
} from 'lucide-react';
import { Modal, Button, Badge } from '../ui';
import type { Candidate } from '../../types';

interface CandidateInspectModalProps {
  candidate: Candidate | null;
  open: boolean;
  onClose: () => void;
  onEnrollInSequence?: (candidate: Candidate) => void;
  onStageChange?: (candidateId: number, newStage: string) => void;
}

const HIRING_STAGES = [
  { id: 'Application Received', label: 'استلام طلب التقديم (Application Received)' },
  { id: 'Shortlisted', label: 'القائمة المختصرة (Shortlisted)' },
  { id: 'Phone Interview', label: 'المقابلة الهاتفية (Phone Interview)' },
  { id: 'Interview Scheduled', label: 'تحديد موعد المقابلة (Interview Scheduled)' },
  { id: 'Technical Assessment', label: 'التقييم الفني (Technical Assessment)' },
  { id: 'Final Interview', label: 'المقابلة النهائية (Final Interview)' },
  { id: 'Offer Sent', label: 'إرسال العرض الوظيفي (Offer Sent)' },
  { id: 'Hired', label: 'تم التوظيف (Hired)' },
  { id: 'Rejected', label: 'اعتذار / غير مؤهل (Rejected)' },
];

export const CandidateInspectModal: React.FC<CandidateInspectModalProps> = ({
  candidate,
  open,
  onClose,
  onEnrollInSequence,
  onStageChange,
}) => {
  if (!open || !candidate) return null;

  const matchScore = candidate.match_score || 0;
  const atsScore = candidate.ats_score || 0;

  // Flatten skills from object or array
  const allSkills: string[] = [];
  if (candidate.technical_skills) {
    if (Array.isArray(candidate.technical_skills)) {
      allSkills.push(...candidate.technical_skills);
    } else if (typeof candidate.technical_skills === 'object') {
      Object.values(candidate.technical_skills).forEach(val => {
        if (Array.isArray(val)) allSkills.push(...val);
      });
    }
  }

  const currentStage = candidate.pipeline_stage || candidate.status || 'Application Received';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`ملف المرشح الفني: ${candidate.full_name}`}
    >
      <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
        {/* Top Profile Card */}
        <div className="bg-gradient-to-r from-slate-50 to-blue-50/40 p-4 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xl flex items-center justify-center shadow-sm flex-shrink-0">
              {candidate.full_name?.charAt(0) || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-800">{candidate.full_name}</h3>
                <Badge
                  className={
                    matchScore >= 80
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : matchScore >= 60
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }
                >
                  مطابقة: {matchScore}%
                </Badge>
              </div>
              <p className="text-xs font-medium text-slate-600 mt-0.5">
                {candidate.current_position || 'مرشح معتمد'} • {candidate.years_experience || 0} سنوات خبرة
              </p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1.5 flex-wrap">
                {candidate.email && (
                  <span className="flex items-center gap-1">
                    <Mail size={12} className="text-slate-400" /> {candidate.email}
                  </span>
                )}
                {candidate.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={12} className="text-slate-400" /> {candidate.phone}
                  </span>
                )}
                {candidate.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-slate-400" /> {candidate.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onEnrollInSequence && (
              <Button
                size="sm"
                onClick={() => onEnrollInSequence(candidate)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Send size={13} /> إدراج في سلسلة تواصل
              </Button>
            )}
          </div>
        </div>

        {/* Pipeline Stage Movement */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700">مرحلة التوظيف الحالية في المسار:</label>
            <p className="text-[11px] text-slate-500 mt-0.5">
              تغيير المرحلة يؤدي تلقائياً إلى تفعيل حملات التقطير التتابعية المربوطة بهذه المرحلة.
            </p>
          </div>
          <select
            value={currentStage}
            onChange={(e) => onStageChange && onStageChange(candidate.id, e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
          >
            {HIRING_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* AI Analysis & Recommendation Box */}
        <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/70 p-4 rounded-xl border border-blue-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <Sparkles size={14} className="text-blue-600" /> تقييم الذكاء الاصطناعي (AI Assessment & Summary)
            </span>
            {candidate.recommendation && (
              <Badge className="bg-blue-600 text-white font-bold text-[11px]">
                {candidate.recommendation}
              </Badge>
            )}
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            {candidate.ai_summary || candidate.recommendation_reason || 'المرشح يتمتع بخلفية مهنية قوية ومطابقة عالية لمتطلبات الوظائف المستهدفة.'}
          </p>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {candidate.strengths && candidate.strengths.length > 0 && (
              <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200/60">
                <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 mb-1.5">
                  <CheckCircle2 size={12} className="text-emerald-600" /> نقاط القوة البارزة:
                </span>
                <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
                  {candidate.strengths.slice(0, 3).map((st, i) => (
                    <li key={i} className="truncate">{st}</li>
                  ))}
                </ul>
              </div>
            )}

            {candidate.weaknesses && candidate.weaknesses.length > 0 && (
              <div className="bg-white/80 p-2.5 rounded-lg border border-rose-200/60">
                <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1 mb-1.5">
                  <XCircle size={12} className="text-rose-600" /> جوانب التطوير أو الملاحظات:
                </span>
                <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
                  {candidate.weaknesses.slice(0, 3).map((w, i) => (
                    <li key={i} className="truncate">{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Technical Skills & Tags */}
        {allSkills.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Award size={14} className="text-indigo-600" /> المهارات التقنية والكفاءات ({allSkills.length}):
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {allSkills.map((sk, idx) => (
                <span
                  key={idx}
                  className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200"
                >
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Work Experience */}
        {candidate.previous_positions && candidate.previous_positions.length > 0 && (
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Briefcase size={14} className="text-blue-600" /> الخبرات المهنية السابقة:
            </h4>
            <div className="space-y-2">
              {candidate.previous_positions.map((pos, idx) => (
                <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-start justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{pos.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{pos.company}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {pos.start || ''} {pos.end ? ` - ${pos.end}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {candidate.education && candidate.education.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <GraduationCap size={14} className="text-purple-600" /> المؤهل الأكاديمي والتعليم:
            </h4>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
              <p className="font-bold text-slate-800">{candidate.education[0].degree} - {candidate.education[0].field}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{candidate.education[0].institution} {candidate.education[0].year ? `(${candidate.education[0].year})` : ''}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="text-[11px] text-slate-400">
            تاريخ التقديم: {candidate.applied_at ? new Date(candidate.applied_at).toLocaleDateString('ar-EG') : 'حديثاً'}
          </div>
          <Button variant="outline" onClick={onClose} className="text-xs">
            إغلاق الملف
          </Button>
        </div>
      </div>
    </Modal>
  );
};
