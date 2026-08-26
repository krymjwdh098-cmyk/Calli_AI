import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Upload, Search, Filter, ChevronRight, Users, AlertTriangle,
  CheckCircle, XCircle, Clock, MoreHorizontal, RefreshCw, Sparkles,
  Trash2, ExternalLink,
} from 'lucide-react';
import { candidatesApi, jobsApi } from '../api';
import { Button, Badge, Card, Modal, Skeleton, EmptyState, useToast, Select, Spinner, Textarea } from '../components/ui';
import { Layout, PageHeader } from '../components/layout/Layout';
import { ScoreRing } from '../components/ui';
import {
  getScoreBg, getCategoryBadge, getCategoryLabel, getStatusBadge,
  initials, avatarColor, daysSince, formatDate, CANDIDATE_STATUSES,
} from '../utils';
import type { Candidate } from '../types';
import { useAuthStore } from '../store/auth';

const PIPELINE_STAGES = [
  'Under Review', 'Screening', 'Phone Interview', 'Technical',
  'Final Interview', 'Shortlisted', 'Offer Sent', 'Hired',
  'Rejected', 'Withdrew', 'Ghosted',
];

function CandidateRow({ candidate }: { candidate: Candidate; [key: string]: any }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const days = daysSince(candidate.applied_at);
  const isProcessing = ['Queued', 'Processing'].includes(candidate.status);
  const qc = useQueryClient();
  const toast = useToast();

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => candidatesApi.updateStatus(candidate.id, newStatus),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast(`Updated status for ${candidate.full_name} to '${updated.status}'`, 'success');
    },
    onError: () => toast('Failed to update candidate status', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => candidatesApi.delete(candidate.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      toast(`Deleted candidate ${candidate.full_name}`, 'success');
      setShowDeleteModal(false);
    },
    onError: () => toast('Failed to delete candidate', 'error'),
  });

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 group">
      <Link to={`/candidates/${candidate.id}`} className="flex items-center gap-4 flex-1 min-w-0">
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor(candidate.full_name)}`}>
          {initials(candidate.full_name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-slate-800 text-sm truncate">{candidate.full_name}</span>
            {candidate.is_knocked_out && <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />}
            {candidate.flagged && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Flagged</span>}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {candidate.current_position && <span className="truncate max-w-32">{candidate.current_position}</span>}
            {candidate.years_experience > 0 && <span>{candidate.years_experience}y exp</span>}
            {candidate.location && <span>{candidate.location}</span>}
          </div>
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-center">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-1">
              <Spinner size={16} />
              <span className="text-xs text-slate-400">{candidate.status}</span>
            </div>
          ) : (
            <ScoreRing score={candidate.match_score} size={48} />
          )}
        </div>

        {/* Status Tag Selector */}
        <div className="flex-shrink-0 hidden sm:flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <select
              value={candidate.status || 'New'}
              onChange={(e) => statusMutation.mutate(e.target.value)}
              disabled={statusMutation.isPending}
              className={`text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md font-medium transition-all ${getStatusBadge(candidate.status || 'New')}`}
              title="Click to update candidate status tag"
            >
              {CANDIDATE_STATUSES.map(s => (
                <option key={s} value={s} className="bg-white text-slate-800 py-1">
                  Tag: {s}
                </option>
              ))}
            </select>
          </div>
          {candidate.category && (
            <Badge className={`${getCategoryBadge(candidate.category)} text-xs`}>
              {getCategoryLabel(candidate.category)}
            </Badge>
          )}
          {days > 7 && <span className="text-xs text-amber-600">{days}d in pipeline</span>}
        </div>
      </Link>

      {/* Quick Actions */}
      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
        <a
          href={`/candidates/${candidate.id}`}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Open in new page / tab"
        >
          <ExternalLink size={15} />
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteModal(true);
          }}
          disabled={deleteMutation.isPending}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete candidate"
        >
          <Trash2 size={15} />
        </button>
        <Link to={`/candidates/${candidate.id}`} className="p-1 text-slate-300 hover:text-slate-600">
          <ChevronRight size={16} />
        </Link>
      </div>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Candidate" width="max-w-md">
        <div className="p-4">
          <p className="text-slate-600 text-sm mb-6">
            Are you sure you want to delete the candidate <strong>{candidate.full_name}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Delete Candidate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BulkUploadModal({ open, onClose, jobId }: { open: boolean; onClose: () => void; jobId?: number }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ total_processed?: number; queued?: number; rejected_files?: number } | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(f => [...f, ...accepted].slice(0, 100));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'], 'application/msword': ['.doc'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
  } as any);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      if (jobId) fd.append('job_id', String(jobId));
      const res = await candidatesApi.bulkUpload(fd);
      setResult(res);
      qc.invalidateQueries({ queryKey: ['candidates'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast(`${res.total_processed || files.length} CVs parsed and evaluated successfully`, 'success');
    } catch {
      toast('Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => { setFiles([]); setResult(null); qc.invalidateQueries({ queryKey: ['candidates'] }); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="Bulk Upload CVs" width="max-w-lg">
      {result ? (
        <div className="text-center py-6">
          <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
          <p className="text-lg font-semibold text-slate-800 mb-1">{result.total_processed || files.length} CVs Processed & Evaluated</p>
          <p className="text-sm text-slate-500">Skills, experience, and match scores have been extracted directly by AI.</p>
          <Button className="mt-4" onClick={handleClose}>View Candidates</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
          >
            <input {...getInputProps()} />
            <Upload size={28} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-600">{isDragActive ? 'Drop files here' : 'Drag & drop CVs here'}</p>
            <p className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX — up to 100 files</p>
          </div>

          {files.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg">
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <XCircle size={14} className="text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1 justify-center">Cancel</Button>
            <Button onClick={handleUpload} loading={uploading} className="flex-1 justify-center" disabled={files.length === 0}>
              Upload & Analyze {files.length > 0 ? `(${files.length})` : ''}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function CandidatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const toast = useToast();

  const page = Number(searchParams.get('page') || 1);
  const jobId = searchParams.get('job_id') ? Number(searchParams.get('job_id')) : undefined;
  const status = searchParams.get('status') || undefined;
  const minScore = searchParams.get('min_score') ? Number(searchParams.get('min_score')) : undefined;

  const { data: jobs } = useQuery({ queryKey: ['jobs'], queryFn: () => jobsApi.list() });

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', { page, jobId, status, minScore, search }],
    queryFn: () => candidatesApi.list({ page, page_size: 20, job_id: jobId, status, min_score: minScore, search: search || undefined, sort_by: 'score_desc' }),
  });

  const reEvaluateAllMutation = useMutation({
    mutationFn: () => candidatesApi.reEvaluateAll(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      toast(res.message || 'All candidates re-evaluated successfully', 'success');
    },
    onError: () => toast('Re-evaluation failed', 'error'),
  });

  const setParam = (key: string, val: string | null) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    if (key !== 'page') p.delete('page'); // Reset page to 1 on other filter changes
    setSearchParams(p);
  };

  return (
    <Layout>
      <PageHeader
        title="Candidates"
        subtitle={data ? `${data.total} total` : ''}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
              icon={<Sparkles size={14} className="text-blue-600" />}
              onClick={() => setAnalyzeOpen(true)}
            >
              Instant AI CV Scanner
            </Button>
            <Button
              variant="outline"
              className="text-slate-600 border-slate-200 hover:bg-slate-50"
              icon={<RefreshCw size={14} />}
              onClick={() => reEvaluateAllMutation.mutate()}
              loading={reEvaluateAllMutation.isPending}
            >
              Re-evaluate All
            </Button>
            <Button variant="primary" icon={<Upload size={14} />} onClick={() => setBulkOpen(true)}>
              Bulk Upload
            </Button>
          </div>
        }
      />

      {/* Status Tag Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setParam('status', null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            !status ? 'bg-slate-800 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Candidates
        </button>
        {CANDIDATE_STATUSES.map((st) => {
          const isActive = status === st;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setParam('status', isActive ? null : st)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                isActive
                  ? 'ring-2 ring-blue-500 shadow-xs font-semibold ' + getStatusBadge(st)
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              Tag: {st}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-40">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={jobId || ''}
            onChange={e => setParam('job_id', e.target.value || null)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Jobs</option>
            {jobs?.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <select
            value={status || ''}
            onChange={e => setParam('status', e.target.value || null)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Stages</option>
            {PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={minScore || ''}
            onChange={e => setParam('min_score', e.target.value || null)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Any Score</option>
            <option value="80">80+ Strong Match</option>
            <option value="60">60+ Potential</option>
            <option value="40">40+ Weak Match</option>
          </select>
        </div>
      </Card>

      {/* Candidate list */}
      <Card padding={false} className="overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="w-9 h-9 rounded-full flex-shrink-0" />
                <Skeleton className="flex-1 h-10" />
                <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState
            icon={<Users size={32} />}
            title="No candidates found"
            description="Try adjusting your filters or upload some CVs to get started."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-50">
              {data.items.map((c, i) => <CandidateRow key={`cand-item-${c.id}-${i}`} candidate={c} />)}
            </div>
            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  {((page - 1) * 20) + 1}–{Math.min(page * 20, data.total)} of {data.total}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setParam('page', String(page + 1))}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <BulkUploadModal open={bulkOpen} onClose={() => setBulkOpen(false)} jobId={jobId} />
      <AnalyzeCvModal open={analyzeOpen} onClose={() => setAnalyzeOpen(false)} jobs={jobs} />
    </Layout>
  );
}

// ── Instant AI CV Scanner Modal ──────────────────────────────────────
function AnalyzeCvModal({ open, onClose, jobs }: { open: boolean; onClose: () => void; jobs?: any[] }) {
  const [selectedJobId, setSelectedJobId] = useState<number | undefined>(jobs?.[0]?.id);
  const [cvText, setCvText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const toast = useToast();
  const qc = useQueryClient();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
    },
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    multiple: false,
  } as any);

  const handleAnalyze = async () => {
    if (!file && !cvText.trim()) {
      return toast('Please select a CV file or paste resume text', 'error');
    }
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (cvText) formData.append('cv_text', cvText);
      if (selectedJobId) formData.append('job_id', String(selectedJobId));

      const res = await candidatesApi.analyzeCv(formData);
      setResult(res.analysis);
      toast('AI CV evaluation complete!', 'success');
    } catch {
      toast('CV Analysis failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAsCandidate = async () => {
    if (!result) return;
    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else {
        const blob = new Blob([cvText], { type: 'text/plain' });
        formData.append('file', blob, `${result.full_name || 'Candidate'}_Resume.txt`);
      }
      if (selectedJobId) formData.append('job_id', String(selectedJobId));

      await candidatesApi.upload(formData);
      qc.invalidateQueries({ queryKey: ['candidates'] });
      toast('Candidate successfully imported into database!', 'success');
      onClose();
    } catch {
      toast('Failed to save candidate', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Instant AI Resume & CV Analyzer">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <p className="text-xs text-slate-500 leading-relaxed">
          Upload any PDF or Word CV to test our Gemini AI parsing, skill extraction, ATS score, and job fit before saving to your database.
        </p>

        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1 block">Benchmark Job Position</label>
          <select
            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white"
            value={selectedJobId || ''}
            onChange={e => setSelectedJobId(Number(e.target.value))}
          >
            {jobs?.map(j => (
              <option key={j.id} value={j.id}>{j.title} ({j.department})</option>
            ))}
          </select>
        </div>

        {/* Upload box */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload size={24} className="mx-auto mb-2 text-blue-600" />
          <p className="text-xs font-medium text-slate-700">
            {file ? file.name : 'Drop PDF or Word document here, or click to browse'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Supports PDF, DOCX, DOC, TXT (Max 15MB)</p>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Or Paste Text</span></div>
        </div>

        <Textarea
          placeholder="Paste raw CV or Resume text directly..."
          value={cvText}
          onChange={e => setCvText(e.target.value)}
          rows={3}
        />

        <Button
          className="w-full justify-center"
          icon={<Sparkles size={14} />}
          onClick={handleAnalyze}
          loading={loading}
        >
          Run AI CV Evaluation
        </Button>

        {result && (
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3 text-xs mt-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h4 className="font-bold text-sm text-blue-400">{result.full_name || 'Extracted Name'}</h4>
                <p className="text-slate-400">{result.email} · {result.phone} · {result.current_position}</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold text-emerald-400">{result.match_score}%</span>
                <p className="text-[10px] text-slate-400">Match Score</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-slate-800/70 rounded-lg">
                <span className="text-slate-400 block">ATS Score</span>
                <strong className="text-slate-200">{result.ats_score}%</strong>
              </div>
              <div className="p-2 bg-slate-800/70 rounded-lg">
                <span className="text-slate-400 block">Recommendation</span>
                <strong className="text-emerald-400">{result.recommendation}</strong>
              </div>
            </div>

            {result.ai_summary && (
              <div>
                <span className="text-slate-400 text-[11px] block mb-1">AI Executive Summary</span>
                <p className="text-slate-300 text-[11px] leading-relaxed">{result.ai_summary}</p>
              </div>
            )}

            {result.technical_skills && Object.keys(result.technical_skills).length > 0 && (
              <div>
                <span className="text-slate-400 text-[11px] block mb-1">Extracted Technical Skills</span>
                <div className="flex flex-wrap gap-1">
                  {Object.values(result.technical_skills).flat().map((s: any, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-blue-900/60 text-blue-200 rounded text-[10px]">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <Button
              className="w-full justify-center bg-emerald-600 hover:bg-emerald-500 text-white border-none mt-2"
              onClick={handleSaveAsCandidate}
            >
              Import Candidate to Platform
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

