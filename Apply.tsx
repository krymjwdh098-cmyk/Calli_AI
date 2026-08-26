import React, { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  Brain, MapPin, GraduationCap, Briefcase, CheckCircle,
  Upload, FileText, XCircle, AlertCircle, ShieldCheck, Sparkles, Building2,
  LayoutDashboard, User
} from 'lucide-react';
import { applyApi } from '../api';
import { Button, Input, Spinner } from '../components/ui';
import { useAuthStore } from '../store/auth';

interface JobInfo {
  id: number;
  title: string;
  company?: string;
  description: string;
  required_skills: string[];
  nice_to_have: string[];
  min_experience: number;
  education_req?: string;
  location_req?: string;
}

export function ApplyPage() {
  const { token = '' } = useParams();
  const authToken = useAuthStore(s => s.token);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState<{ candidate_id: number; message: string } | null>(null);
  const [error, setError] = useState('');

  const { data: job, isLoading, isError } = useQuery<JobInfo>({
    queryKey: ['apply-job', token],
    queryFn: () => applyApi.getJob(token),
    retry: false,
  });

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
  } as any);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('full_name', form.full_name);
      fd.append('email', form.email);
      if (form.phone) fd.append('phone', form.phone);
      fd.append('cv_file', file as File);
      return applyApi.submit(token, fd);
    },
    onSuccess: (res) => setSubmitted(res),
    onError: (err: any) => setError(err?.response?.data?.detail || 'Something went wrong. Please try again.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.full_name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!form.email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!file) {
      setError('Please attach your CV / Resume file');
      return;
    }
    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Spinner size={32} className="text-blue-600" />
        <p className="text-sm font-medium text-slate-500">Loading position details...</p>
      </div>
    );
  }

  if (isError || !job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center max-w-md w-full">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertCircle size={26} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Job Position Unavailable</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            This job link might be invalid, closed, or no longer accepting applications. Please contact the hiring team for an updated link.
          </p>
          <div className="flex justify-center mb-4">
            <Link
              to={authToken ? '/dashboard' : '/login'}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm transition-colors"
            >
              <LayoutDashboard size={14} /> {authToken ? 'Go to HR Dashboard' : 'Go to Admin Login'}
            </Link>
          </div>
          <div className="text-xs text-slate-400 border-t border-slate-100 pt-4 flex items-center justify-center gap-1.5">
            <ShieldCheck size={14} className="text-slate-400" /> Powered by CalliQ ATS
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-16">
      {/* Platform Branded Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-md">
              <Brain size={20} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">CalliQ</span>
              <span className="text-xs bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded-full ml-2 border border-blue-400/20">
                Careers Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={authToken ? '/dashboard' : '/login'}
              className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl shadow-sm transition-colors"
            >
              {authToken ? (
                <>
                  <LayoutDashboard size={14} /> Back to Dashboard
                </>
              ) : (
                <>
                  <User size={14} /> HR Admin Login
                </>
              )}
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center max-w-xl mx-auto my-8">
            <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-emerald-600 shadow-sm">
              <CheckCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">Application Submitted!</h1>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              {submitted.message || 'Thank you for applying. Your application and CV have been safely received and queued for HR review.'}
            </p>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 text-left mb-6 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Application Reference ID:</span>
                <span className="font-mono font-medium text-slate-700">#{submitted.candidate_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Position Applied:</span>
                <span className="font-medium text-slate-700">{job.title}</span>
              </div>
            </div>
            <p className="text-xs text-slate-400">You can safely close this window.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Job Description & Details */}
            <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  <Building2 size={12} /> {job.company || 'Hiring Organization'}
                </span>
              </div>

              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-4">{job.title}</h1>

              <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-600 mb-6 border-b border-slate-100 pb-5">
                {job.location_req && (
                  <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <MapPin size={13} className="text-slate-400" /> {job.location_req}
                  </span>
                )}
                {job.min_experience > 0 && (
                  <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <Briefcase size={13} className="text-slate-400" /> {job.min_experience}+ Years Experience
                  </span>
                )}
                {job.education_req && (
                  <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <GraduationCap size={13} className="text-slate-400" /> {job.education_req}
                  </span>
                )}
              </div>

              <div className="mb-6">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">About the Role</h2>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                  {job.description}
                </div>
              </div>

              {job.required_skills && job.required_skills.length > 0 && (
                <div className="mb-5 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Required Skills & Stack</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {job.required_skills.map((skill, i) => (
                      <span key={`req-skill-${skill}-${i}`} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-medium rounded-lg border border-slate-200/60">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {job.nice_to_have && job.nice_to_have.length > 0 && (
                <div className="pt-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Nice to Have</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {job.nice_to_have.map((skill, i) => (
                      <span key={`nth-skill-${skill}-${i}`} className="px-2.5 py-1 bg-slate-50 text-slate-600 text-xs rounded-lg border border-slate-200/50">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Application Form */}
            <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-7 sticky top-24">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Apply Now</h2>
                  <p className="text-xs text-slate-500">Submit your CV for AI ATS Screening</p>
                </div>
                <Sparkles size={18} className="text-blue-500" />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl mb-4">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1">{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Full Name *"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Alex Johnson"
                  required
                />

                <Input
                  label="Email Address *"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="alex@example.com"
                  required
                />

                <Input
                  label="Phone Number"
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 (555) 000-0000"
                />

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Upload Resume / CV *
                  </label>

                  {file ? (
                    <div className="flex items-center gap-3 p-3.5 border border-blue-200 rounded-xl bg-blue-50/50">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="p-1 hover:bg-slate-200/60 rounded-md transition-colors"
                      >
                        <XCircle size={16} className="text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  ) : (
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all
                        ${isDragActive
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/80'}`}
                    >
                      <input {...getInputProps()} />
                      <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <Upload size={18} />
                      </div>
                      <p className="text-xs font-semibold text-slate-700">
                        {isDragActive ? 'Drop your CV file here' : 'Drag & drop your CV, or click to browse'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">Supports PDF, DOC, DOCX, TXT, PNG, JPG (Max 10MB)</p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full justify-center shadow-md bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3"
                    loading={submitMutation.isPending}
                    size="lg"
                  >
                    {submitMutation.isPending ? 'Analyzing & Submitting...' : 'Submit Application'}
                  </Button>
                </div>

                <p className="text-[11px] text-center text-slate-400 pt-1">
                  Your profile and CV will be securely processed and analyzed by CalliQ ATS.
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

