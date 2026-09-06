import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, X, Send, Bot, User as UserIcon, Users, UserCheck, 
  UserX, Clock, BarChart3, Briefcase, Sparkles, RefreshCw 
} from 'lucide-react';
import { Button } from './ui';

interface DashboardStats {
  today?: number;
  total_candidates?: number;
  hired?: number;
  rejected?: number;
  pending?: number;
  active_jobs?: number;
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    today: 0,
    total_candidates: 0,
    hired: 0,
    rejected: 0,
    pending: 0,
    active_jobs: 0,
  });
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; time?: string }[]>([
    { 
      role: 'model', 
      text: 'مرحباً بك! أنا المساعد الذكي لنظام CalliQ للتوظيف 🤖\nاضغط على أي من الأيقونات السريعة بالأعلى لمعرفة مرشحي اليوم، المقبولين، أو المرفوضين فوراً، أو اسألني عن أي تفاصيل.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchLiveStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/v1/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats({
          today: data.today || 0,
          total_candidates: data.total_candidates || 0,
          hired: data.hired || 0,
          rejected: data.rejected || 0,
          pending: data.pending || data.shortlisted || 0,
          active_jobs: data.active_jobs || 0,
        });
      }
    } catch (e) {
      // Ignore background stats failure
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLiveStats();
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage = messageText.trim();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', text: userMessage, time }]);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          history: messages
            .filter(m => !m.text.includes('مرحباً بك! أنا المساعد الذكي'))
            .map(m => ({ role: m.role, text: m.text })),
          message: userMessage
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch response');

      const data = await response.json();
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [...prev, { role: 'model', text: data.reply, time: replyTime }]);
      // Refresh stats in case stages changed
      fetchLiveStats();
    } catch (err) {
      console.error(err);
      const errTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [...prev, { 
        role: 'model', 
        text: 'عذراً، حدث خطأ مؤقت في الاتصال. يمكنك إعادة المحاولة بالضغط على أحد الأزرار السريعة.',
        time: errTime
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const msg = input;
    setInput('');
    sendMessage(msg);
  };

  const quickActions = [
    {
      id: 'today-candidates',
      label: 'مرشحين اليوم',
      count: stats.today,
      icon: Users,
      color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      badgeColor: 'bg-blue-600 text-white',
      query: 'عرض قائمة مرشحين اليوم وتفاصيلهم',
    },
    {
      id: 'hired-candidates',
      label: 'المقبولين',
      count: stats.hired,
      icon: UserCheck,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      badgeColor: 'bg-emerald-600 text-white',
      query: 'عرض المرشحين المقبولين وتم تقديم عروض لهم',
    },
    {
      id: 'rejected-candidates',
      label: 'المرفوضين',
      count: stats.rejected,
      icon: UserX,
      color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      badgeColor: 'bg-rose-600 text-white',
      query: 'عرض المرشحين المستبعدين والمرفوضين وأسباب الاستبعاد',
    },
    {
      id: 'screening-candidates',
      label: 'قيد الفرز',
      count: stats.pending,
      icon: Clock,
      color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      badgeColor: 'bg-amber-600 text-white',
      query: 'عرض المرشحين قيد الفرز والمراجعة والمقابلات',
    },
    {
      id: 'daily-summary',
      label: 'ملخص شامل',
      count: null,
      icon: BarChart3,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
      badgeColor: 'bg-indigo-600 text-white',
      query: 'أعطني ملخص اليوم الشامل وإحصائيات التوظيف',
    },
    {
      id: 'active-jobs',
      label: 'الوظائف النشطة',
      count: stats.active_jobs,
      icon: Briefcase,
      color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      badgeColor: 'bg-purple-600 text-white',
      query: 'عرض الوظائف المفتوحة والنشطة حالياً',
    },
  ];

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        id="chatbot-floating-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 transition-all z-50 group`}
        title="مساعد التوظيف الذكي"
        aria-label="Toggle AI Assistant"
      >
        <div className="relative">
          <MessageSquare size={24} className="group-hover:rotate-6 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full animate-pulse" />
        </div>
      </button>

      {/* Chat Window */}
      <div 
        id="chatbot-window-panel"
        className={`fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[420px] md:w-[460px] h-[100dvh] sm:h-[600px] max-h-[100dvh] sm:max-h-[85vh] bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 sm:origin-bottom-right z-[100] overflow-hidden ${
          isOpen ? 'translate-y-0 sm:scale-100 opacity-100 pointer-events-auto' : 'translate-y-full sm:translate-y-0 sm:scale-90 opacity-0 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm md:text-base leading-tight">مساعد CalliQ الذكي</h3>
                <span className="text-[10px] bg-emerald-400/30 text-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-400/40 font-medium">
                  HR Pro
                </span>
              </div>
              <p className="text-xs text-blue-100/90 leading-none mt-1">فحص السير الذاتية وإحصائيات التوظيف</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={fetchLiveStats} 
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw size={16} />
            </button>
            <button 
              onClick={() => setIsOpen(false)} 
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="إغلاق"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* HR Quick Action Icons Bar (Interactive Badges) */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={12} className="text-amber-500" />
              أيقونات الوصول السريع للـ HR
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              اضغط للاستعراض
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  id={action.id}
                  onClick={() => sendMessage(action.query)}
                  disabled={isLoading}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all duration-200 relative group cursor-pointer active:scale-95 ${action.color} disabled:opacity-60`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Icon size={16} className="shrink-0" />
                    {action.count !== null && action.count !== undefined && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full leading-tight shadow-xs ${action.badgeColor}`}>
                        {action.count}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold leading-tight line-clamp-1">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-slate-100/50 dark:bg-slate-900/50 min-h-0">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div 
                className={`max-w-[90%] p-3.5 rounded-2xl text-xs md:text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs font-medium' 
                    : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 rounded-bl-xs'
                }`}
              >
                {msg.text}
              </div>
              {msg.time && (
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.time}
                </span>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start items-center gap-2 text-slate-500">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-2xl rounded-bl-xs shadow-xs flex items-center gap-1.5">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                <span className="text-xs text-slate-500 mr-1.5 font-medium">جاري التحليل...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2 items-center"
          >
            <input
              id="chatbot-input-field"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب استفسارك أو اختر من الأيقونات بالأعلى..."
              className="flex-1 px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
              disabled={isLoading}
              dir="auto"
            />
            <Button 
              id="chatbot-send-button"
              type="submit" 
              size="sm" 
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors shrink-0" 
              disabled={!input.trim() || isLoading}
            >
              <Send size={16} />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
