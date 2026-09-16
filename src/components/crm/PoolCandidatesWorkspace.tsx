import React, { useState } from 'react';
import {
  Users, Search, UserPlus, Sparkles, Trash2, Eye, Send,
  CheckCircle2, ArrowRight, Filter, Award, ChevronDown, Check,
  Briefcase, Mail, Phone, MapPin, X
} from 'lucide-react';
import { Modal, Button, Badge, Input } from '../ui';
import type { TalentPool, Candidate, Sequence } from '../../types';

interface PoolCandidatesWorkspaceProps {
  pool: TalentPool | null;
  open: boolean;
  onClose: () => void;
  allCandidates: Candidate[];
  onRemoveCandidate: (poolId: number, candidateId: number) => void;
  onAddCandidates: (poolId: number, candidateIds: number[]) => void;
  onInspectCandidate: (candidate: Candidate) => void;
  onEnrollCandidateInSeq: (candidate: Candidate) => void;
  onStageChange: (candidateId: number, stage: string) => void;
}

const HIRING_STAGES = [
  { id: 'Application Received', label: 'استلام طلب التقديم' },
  { id: 'Shortlisted', label: 'القائمة المختصرة' },
  { id: 'Phone Interview', label: 'المقابلة الهاتفية' },
  { id: 'Interview Scheduled', label: 'تحديد موعد المقابلة' },
  { id: 'Technical Assessment', label: 'التقييم الفني' },
  { id: 'Final Interview', label: 'المقابلة النهائية' },
  { id: 'Offer Sent', label: 'إرسال العرض الوظيفي' },
  { id: 'Hired', label: 'تم التوظيف' },
  { id: 'Rejected', label: 'اعتذار' },
];

export const PoolCandidatesWorkspace: React.FC<PoolCandidatesWorkspaceProps> = ({
  pool,
  open,
  onClose,
  allCandidates,
  onRemoveCandidate,
  onAddCandidates,
  onInspectCandidate,
  onEnrollCandidateInSeq,
  onStageChange,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'enrolled' | 'add'>('enrolled');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedCandidateIdsToAdd, setSelectedCandidateIdsToAdd] = useState<number[]>([]);

  if (!open || !pool) return null;

  const enrolledIds = pool.candidate_ids || [];
  const enrolledCandidates = allCandidates.filter(c => enrolledIds.includes(c.id));
  const availableCandidates = allCandidates.filter(c => !enrolledIds.includes(c.id));

  // Filter enrolled
  const filteredEnrolled = enrolledCandidates.filter(c => {
    const matchesSearch =
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.current_position || '').toLowerCase().includes(searchQuery.toLowerCase());
    const currentStage = c.pipeline_stage || c.status || 'Application Received';
    const matchesStage = stageFilter === 'all' || currentStage === stageFilter;
    return matchesSearch && matchesStage;
  });

  // Calculate AI match suggestions for non-enrolled candidates based on pool tags
  const poolTagsLower = (pool.tags || []).map(t => t.toLowerCase());
  const aiRecommendedCandidates = availableCandidates.filter(c => {
    const skills = Object.values(c.technical_skills || {}).flat().join(' ').toLowerCase();
    const position = (c.current_position || '').toLowerCase();
    const matchesTag = poolTagsLower.some(tag => skills.includes(tag) || position.includes(tag));
    return matchesTag || (c.match_score || 0) >= 80;
  });

  // Filter available
  const filteredAvailable = availableCandidates.filter(c => {
    const matchesSearch =
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.current_position || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleAddSelected = () => {
    if (selectedCandidateIdsToAdd.length === 0) return;
    onAddCandidates(pool.id, selectedCandidateIdsToAdd);
    setSelectedCandidateIdsToAdd([]);
    setActiveSubTab('enrolled');
  };

  const handleAddAllRecommended = () => {
    const recIds = aiRecommendedCandidates.map(c => c.id);
    if (recIds.length === 0) return;
    onAddCandidates(pool.id, recIds);
    setActiveSubTab('enrolled');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`إدارة مرشحي بنك المواهب: ${pool.name}`}
    >
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {/* Pool Summary Header Card */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-800">{pool.name}</span>
              <Badge className="bg-blue-100 text-blue-800 text-[11px] font-bold">
                {enrolledCandidates.length} مرشح مسجل
              </Badge>
            </div>
            {pool.description && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{pool.description}</p>
            )}
            {pool.tags && pool.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {pool.tags.map(t => (
                  <span key={t} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('enrolled')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'enrolled'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              المرشحون الحاليون ({enrolledCandidates.length})
            </button>
            <button
              onClick={() => setActiveSubTab('add')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'add'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <UserPlus size={14} /> إضافة واقتراحات AI ({availableCandidates.length})
            </button>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={activeSubTab === 'enrolled' ? 'بحث في المرشحين بالاسم أو التخصص...' : 'بحث في قاعدة بيانات المرشحين لإضافتهم...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-9 text-xs"
            />
          </div>

          {activeSubTab === 'enrolled' && (
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 font-semibold focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع مراحل التوظيف</option>
              {HIRING_STAGES.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── SUB-TAB 1: ENROLLED CANDIDATES ───────────────────────────────── */}
        {activeSubTab === 'enrolled' && (
          <div className="space-y-3">
            {filteredEnrolled.length === 0 ? (
              <div className="p-10 text-center bg-white rounded-xl border border-slate-200 space-y-3">
                <Users size={32} className="text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">لا يوجد مرشحون يطابقون شروط البحث في هذا البنك</p>
                <p className="text-[11px] text-slate-400">
                  انقر على تبويب "إضافة واقتراحات AI" لضم مرشحين جدد واكتشاف المقترحات الذكية.
                </p>
                <Button
                  size="sm"
                  onClick={() => setActiveSubTab('add')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2"
                >
                  <UserPlus size={14} className="ml-1.5" /> ضم مرشحين مقترحين الآن
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredEnrolled.map(cand => {
                  const matchScore = cand.match_score || 0;
                  const currentStage = cand.pipeline_stage || cand.status || 'Application Received';

                  return (
                    <div
                      key={cand.id}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 transition-all shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                            {cand.full_name?.charAt(0) || 'C'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-xs text-slate-800">{cand.full_name}</h4>
                              <Badge
                                className={
                                  matchScore >= 80
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                }
                              >
                                {matchScore}% مطابقة
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {cand.current_position || 'مرشح'} • {cand.years_experience || 0} سنين خبرة • {cand.location || 'غير محدد'}
                            </p>
                          </div>
                        </div>

                        {/* Direct Stage Selector */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] font-semibold text-slate-400">المرحلة:</span>
                          <select
                            value={currentStage}
                            onChange={e => onStageChange(cand.id, e.target.value)}
                            className="text-[11px] font-bold px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {HIRING_STAGES.map(s => (
                              <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          {cand.email && (
                            <span className="truncate max-w-[150px]">{cand.email}</span>
                          )}
                          {cand.phone && <span>{cand.phone}</span>}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onInspectCandidate(cand)}
                            className="text-[11px] py-1 px-2.5 border-blue-200 text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                          >
                            <Eye size={12} /> فحص الملف
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEnrollCandidateInSeq(cand)}
                            className="text-[11px] py-1 px-2.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1"
                          >
                            <Send size={12} /> تواصل
                          </Button>
                          <button
                            onClick={() => onRemoveCandidate(pool.id, cand.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="استبعاد من البنك"
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
          </div>
        )}

        {/* ── SUB-TAB 2: ADD CANDIDATES & AI MATCHES ───────────────────────── */}
        {activeSubTab === 'add' && (
          <div className="space-y-4">
            {/* AI Recommendations Banner */}
            {aiRecommendedCandidates.length > 0 && (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-4 rounded-xl border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                    <Sparkles size={16} className="text-emerald-600" />
                    <span>اقتراحات الذكاء الاصطناعي لبنك "{pool.name}" ({aiRecommendedCandidates.length} مرشحين مقترحين)</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddAllRecommended}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-1.5 flex items-center gap-1 shadow-sm"
                  >
                    <CheckCircle2 size={13} /> إضافة جميع المقترحين بنقرة واحدة
                  </Button>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  تم التعرف على هؤلاء المرشحين بناءً على تطابق مهاراتهم مع وسوم البنك #{pool.tags?.join(', #') || 'الكفاءات'} ومعدلات التقييم المرتفعة.
                </p>
              </div>
            )}

            {/* Candidates Selection List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>اختر المرشحين لإضافتهم لبنك المواهب:</span>
                {selectedCandidateIdsToAdd.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleAddSelected}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4"
                  >
                    إضافة {selectedCandidateIdsToAdd.length} مرشحين محددين
                  </Button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 bg-white">
                {filteredAvailable.map(c => {
                  const isSelected = selectedCandidateIdsToAdd.includes(c.id);
                  const isAiMatch = aiRecommendedCandidates.some(rec => rec.id === c.id);

                  return (
                    <label
                      key={c.id}
                      className={`py-2.5 px-3 flex items-center justify-between hover:bg-slate-50 rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedCandidateIdsToAdd(prev => [...prev, c.id]);
                            } else {
                              setSelectedCandidateIdsToAdd(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-xs text-slate-800">{c.full_name}</p>
                            {isAiMatch && (
                              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Sparkles size={10} /> اقتراح AI
                              </span>
                            )}
                            <Badge className="bg-slate-100 text-slate-600 text-[10px]">
                              {c.match_score || 0}%
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {c.email} • {c.current_position || 'مرشح'} • {c.years_experience || 0} سنوات خبرة
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={e => {
                          e.preventDefault();
                          onAddCandidates(pool.id, [c.id]);
                          setActiveSubTab('enrolled');
                        }}
                        className="text-[11px] py-1 px-2.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        + ضم الآن
                      </Button>
                    </label>
                  );
                })}
                {filteredAvailable.length === 0 && (
                  <p className="text-center py-6 text-xs text-slate-400">
                    جميع المرشحين مسجلون بالفعل في هذا البنك.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            تحديث بنك المواهب يتم حفظه فورياً في قاعدة البيانات.
          </span>
          <Button variant="outline" onClick={onClose} className="text-xs">
            إغلاق النافذة
          </Button>
        </div>
      </div>
    </Modal>
  );
};
