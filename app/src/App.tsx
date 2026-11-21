import { useState, useEffect } from 'react';
import { ReactiveBackground } from './components/ui/ReactiveBackground';
import { GlassHeader } from '@/components/glassyui/glass-header';
import { GlassTabs, GlassTabsList, GlassTabsTrigger } from '@/components/glassyui/glass-tabs';
import { GlassSurface } from '@/components/glassyui/glass-surface';
import { GlassPanel } from '@/components/glassyui/glass-panel';
import { GlassButton } from '@/components/glassyui/glass-button';
import { GlassInput } from '@/components/glassyui/glass-input';
import { useCourses } from '@/hooks/useCourses';
import { useTimetable } from '@/hooks/useTimetable';
import { useProjects } from '@/hooks/useProjects';
import { useActivities } from '@/hooks/useActivities';
import { useIsMobile } from '@/hooks/useIsMobile';
import { TimetableBoard } from '@/components/timetable/TimetableBoard';
import { BuildVault } from '@/components/vault/BuildVault';
import { MobileShell } from '@/components/mobile/MobileShell';
import { AuthGate } from '@/components/AuthGate';
import { SettingsModal } from '@/components/SettingsModal';
import { syncAllNotifications } from '@/lib/notifications';
import { bucketOf } from '@/components/vault/vault';
import type { CourseStats, TodaySlot } from '@/lib/api';
import { ShieldCheck, Settings, CheckCircle, AlertTriangle, ShieldAlert, Plus, X, Zap, Clock, BookOpen, CalendarCheck, LayoutDashboard, Calendar, FolderGit2, Bell, Ghost } from 'lucide-react';

function nextLectureSlot(today: TodaySlot[]): TodaySlot | null {
  if (today.length === 0) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  return today.find((s) => !s.isCancelled && toMinutes(s.startTime) > nowMinutes) ?? null;
}

export default function App() {
  return (
    <AuthGate>
      <MainApp />
    </AuthGate>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState('overview');
  const { courses, loading, error, refetch, logAttendance, addCourse } = useCourses();
  const timetable = useTimetable(courses, { onAttendanceLogged: refetch });
  const projectsCtrl = useProjects();
  const activitiesCtrl = useActivities();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (courses.length > 0) {
      void syncAllNotifications(courses, timetable.slots, activitiesCtrl.activities);
    }
  }, [courses, timetable.slots, activitiesCtrl.activities]);

  const isMobile = useIsMobile();

  const [form, setForm] = useState({ code: '', name: '', totalLectures: '', requiredPercent: '80' });
  const [formError, setFormError] = useState<string | null>(null);

  // ── Mobile shell ─────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <MobileShell
        courses={courses}
        loading={loading}
        error={error}
        timetable={timetable}
        projectsCtrl={projectsCtrl}
        activitiesCtrl={activitiesCtrl}
        logAttendance={logAttendance}
        addCourse={addCourse}
      />
    );
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const navigationTabs = [
    { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
    { id: 'timetable', label: 'Timetable', shortLabel: 'Timetable', icon: Calendar, count: courses.length },
    { id: 'projects', label: 'Build Vault', shortLabel: 'Vault', icon: FolderGit2 },
    { id: 'notifications', label: 'Priority Hub', shortLabel: 'Priority', icon: Bell },
  ];

  const handleAddCourse = async () => {
    setFormError(null);

    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Code and name are required.');
      return;
    }
    const totalLectures = Number(form.totalLectures);
    if (!Number.isInteger(totalLectures) || totalLectures < 1) {
      setFormError('Total lectures must be a positive whole number.');
      return;
    }
    const ratio = Number(form.requiredPercent) / 100;
    if (Number.isNaN(ratio) || ratio <= 0 || ratio >= 1) {
      setFormError('Requirement must be between 1% and 99%.');
      return;
    }

    try {
      setSaving(true);
      await addCourse({ code: form.code.trim(), name: form.name.trim(), totalLectures, requiredRatio: ratio });
      setForm({ code: '', name: '', totalLectures: '', requiredPercent: '80' });
      setShowAddModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add module.');
    } finally {
      setSaving(false);
    }
  };

  const eligibilitySummary = courses.length > 0
    ? courses.every((c) => c.riskLevel !== 'DANGER')
    : true;

  return (
    <div className="relative min-h-screen w-full text-slate-100 antialiased overflow-x-hidden">
      {/* 1. Animating Reactive WebGL Grainient Background */}
      <ReactiveBackground
        colors={["#120f17", "#2460df", "#2140d5", "#002179", "#070707"]}
        angle={161}
        flow={1.1}
        silk={0.35}
        grainAmount={0.03}
        scale={1.05}
        contrast={1.15}
        saturation={0.69}
      />

      {/* 2. Main Glass Header */}
      <GlassHeader
        brand={
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Kontrol</h1>
            </div>
          </div>
        }
        actions={
          <button
            onClick={() => setShowSettingsModal(true)}
            aria-label="Settings"
            className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl border border-transparent hover:border-white/15 transition-all"
          >
            <Settings size={18} />
          </button>
        }
      />

      {/* 3. Main Bento Workspace */}
      <main className="relative z-10 min-h-screen px-4 md:px-8 pt-24 pb-32 flex flex-col items-center justify-center max-w-7xl mx-auto">
        <GlassSurface
          preset="subtle"
          lens
          className="w-full max-w-6xl mx-auto p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative space-y-6 bg-slate-950/55"
        >
          {/* Active Tab Header Bar */}
          <div className="flex justify-between items-center pb-6 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {activeTab === 'projects'
                  ? 'Build Vault'
                  : activeTab === 'timetable'
                    ? 'Timetable'
                    : activeTab === 'notifications'
                      ? 'Priority Hub'
                      : 'Overview Dashboard'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeTab === 'projects'
                  ? 'Track builds, projects & academic deadlines'
                  : activeTab === 'timetable'
                    ? 'Weekly schedule & attendance logging'
                    : activeTab === 'notifications'
                      ? 'Alerts, reminders & priorities'
                      : 'University Attendance Eligibility & Risk Analysis'}
              </p>
            </div>
            {(activeTab === 'overview' || activeTab === 'timetable') && (
              <GlassButton variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
                <Plus size={16} className="mr-2" /> Add Module
              </GlassButton>
            )}
          </div>

          {/* Bento Grid Content */}
          {activeTab === 'overview' && (
            loading ? (
              <GlassPanel className="p-12 text-center border-white/15 bg-slate-900/40">
                <p className="text-slate-400 text-sm">Loading modules…</p>
              </GlassPanel>
            ) : error ? (
              <GlassPanel className="p-12 text-center border-rose-500/30 bg-slate-900/40">
                <h3 className="text-xl font-bold text-white">API Offline</h3>
                <p className="text-rose-400 text-sm mt-2">{error}</p>
                <p className="text-slate-500 text-xs mt-1">Make sure the Kontrol API is running on port 3001.</p>
              </GlassPanel>
            ) : courses.length === 0 ? (
              <GlassPanel className="p-12 text-center border-white/15 bg-slate-900/40">
                <h3 className="text-xl font-bold text-white">No modules tracked</h3>
                <p className="text-slate-400 text-sm mt-2">Add your first module to start monitoring attendance risk.</p>
              </GlassPanel>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">

              {/* Bento Item 1: Large Featured Gauge Card */}
              <GlassPanel className="md:col-span-2 p-6 flex flex-col justify-between border-emerald-500/30 bg-slate-900/40 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                      PRIMARY TARGET
                    </span>
                    <h3 className="text-2xl font-bold text-white mt-3">{courses[0].name}</h3>
                    <p className="text-xs text-slate-400">{courses[0].code} • {Math.round(courses[0].requiredRatio * 100)}% Requirement</p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                    <Zap size={26} />
                  </div>
                </div>

                <div className="mt-8 flex items-baseline justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Safe Skips Available</p>
                    <p className="text-5xl font-black text-emerald-400 mt-1 tabular-nums">
                      {courses[0].remainingSkips}
                      <span className="text-sm font-normal text-slate-400 ml-2">skips left</span>
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums mt-1">
                      {courses[0].attendedCount} attended · {courses[0].skippedCount} skipped
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <GlassButton onClick={() => logAttendance(courses[0].id, 'ATTENDED')} size="sm" variant="primary">
                      <CheckCircle size={13} className="mr-1.5" /> Attended
                    </GlassButton>
                    <GlassButton onClick={() => logAttendance(courses[0].id, 'SKIPPED')} size="sm">
                      + Log Skip
                    </GlassButton>
                    <GlassButton onClick={() => logAttendance(courses[0].id, 'GHOST')} size="sm">
                      <Ghost size={13} className="mr-1.5 text-violet-400" /> Ghost
                    </GlassButton>
                  </div>
                </div>
              </GlassPanel>

              {/* Bento Item 2: Quick Timetable Status */}
              <GlassPanel className="p-6 flex flex-col justify-between border-white/15 bg-slate-900/40">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-slate-400">TIMETABLE</span>
                  <Clock size={18} className="text-indigo-400" />
                </div>
                {(() => {
                  const next = nextLectureSlot(timetable.today);
                  return (
                    <div className="my-4">
                      <p className="text-xs text-slate-400">Next Lecture</p>
                      {next ? (
                        <>
                          <p className="text-lg font-bold text-white mt-1 truncate">{next.course.name}</p>
                          <p className="text-xs text-slate-400">
                            {next.startTime} {next.venue ? `• ${next.venue}` : ''}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500 mt-1">No more classes today</p>
                      )}
                    </div>
                  );
                })()}
                <div className="w-full bg-indigo-500/20 text-indigo-300 text-xs text-center py-2 rounded-xl border border-indigo-500/30 font-semibold">
                  Open Timetable
                </div>
              </GlassPanel>

              {/* Bento Item 3: Work Planner */}
              {(() => {
                const today = new Date();
                const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const overdue = activitiesCtrl.activities.filter((a) => bucketOf(a, todayKey) === 'OVERDUE').length;
                const dueToday = activitiesCtrl.activities.filter((a) => bucketOf(a, todayKey) === 'TODAY' && !a.isDone).length;
                const next = activitiesCtrl.activities.find((a) => bucketOf(a, todayKey) === 'UPCOMING');
                return (
                  <GlassPanel
                    className="p-6 flex flex-col justify-between border-white/15 bg-slate-900/40 cursor-pointer hover:border-white/25 transition-all"
                    onClick={() => setActiveTab('projects')}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-slate-400">WORK PLANNER</span>
                      <CalendarCheck size={18} className="text-amber-300" />
                    </div>
                    <div className="my-4 flex items-end gap-4">
                      <div>
                        <p className="text-4xl font-extrabold text-rose-400">{overdue}</p>
                        <p className="text-xs text-slate-400 mt-1">Overdue</p>
                      </div>
                      <div>
                        <p className="text-4xl font-extrabold text-indigo-300">{dueToday}</p>
                        <p className="text-xs text-slate-400 mt-1">Due today</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {next
                        ? `Next: ${next.title} · ${next.dueDate}`
                        : 'No upcoming activities — add some in Build Vault'}
                    </p>
                  </GlassPanel>
                );
              })()}

              {/* Bento Item 3: Overall Summary */}
              <GlassPanel className="p-6 flex flex-col justify-between border-white/15 bg-slate-900/40">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-slate-400">ELIGIBILITY</span>
                  <BookOpen size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-4xl font-extrabold text-white mt-2">
                    {eligibilitySummary ? '100%' : `${courses.filter((c) => c.riskLevel !== 'DANGER').length}/${courses.length}`}
                  </p>
                  <p className="text-xs text-emerald-400 font-medium mt-1">
                    {eligibilitySummary ? 'All modules eligible' : 'Some modules at risk'}
                  </p>
                </div>
                <p className="text-xs text-slate-400">{courses.length} Active Modules Tracked</p>
              </GlassPanel>

              {/* Bento Items 4+: Course Cards */}
              {courses.slice(1).map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  onSkip={() => logAttendance(course.id, 'SKIPPED')}
                  onAttended={() => logAttendance(course.id, 'ATTENDED')}
                  onGhost={() => logAttendance(course.id, 'GHOST')}
                />
              ))}
              </div>
            )
          )}

          {/* Tab Views */}
          {activeTab === 'timetable' && <TimetableBoard timetable={timetable} />}

          {activeTab === 'projects' && (
            <BuildVault projectsCtrl={projectsCtrl} activitiesCtrl={activitiesCtrl} courses={courses} />
          )}

          {activeTab === 'notifications' && (
            <GlassPanel className="p-12 text-center border-white/15 bg-slate-900/40">
              <h3 className="text-xl font-bold text-white">Priority Hub</h3>
              <p className="text-slate-400 text-sm mt-2">Section content initializing for Stage 1.</p>
            </GlassPanel>
          )}
        </GlassSurface>
      </main>

      {/* 4. Floating Bottom Glass Navigation */}
      <nav className="fixed bottom-3 sm:bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none px-2 sm:px-4 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="w-full max-w-[440px] sm:w-auto sm:max-w-none pointer-events-auto shadow-2xl">
          <GlassTabs
            value={activeTab}
            onValueChange={setActiveTab}
            orientation="horizontal"
          >
            <GlassTabsList className="w-full sm:w-auto p-1 gap-0.5 sm:gap-1">
              {navigationTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <GlassTabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all"
                  >
                    <Icon size={14} className="shrink-0 opacity-80" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="inline sm:hidden">{tab.shortLabel}</span>
                    {tab.count !== undefined && (
                      <span className="ml-0.5 sm:ml-1 px-1.5 py-0.2 text-[9px] rounded-full bg-white/10 font-mono">
                        {tab.count}
                      </span>
                    )}
                  </GlassTabsTrigger>
                );
              })}
            </GlassTabsList>
          </GlassTabs>
        </div>
      </nav>

      {/* 5. Add Module Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto"
          onClick={() => { setShowAddModal(false); setFormError(null); }}
        >
          <GlassPanel
            className="w-full max-w-md max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto rounded-t-[28px] rounded-b-none sm:rounded-3xl border-b-0 sm:border-b p-5 sm:p-6 space-y-5 border-white/15 bg-slate-900/95 relative shadow-2xl mb-0 sm:my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Add Module</h3>
                <p className="text-xs text-slate-400 mt-0.5">Track attendance risk for a new course</p>
              </div>
              <button
                onClick={() => { setShowAddModal(false); setFormError(null); }}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <GlassInput
                label="Course Code"
                placeholder="e.g. ITM 2104"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <GlassInput
                label="Course Name"
                placeholder="e.g. Machine Learning"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <GlassInput
                  label="Total Lectures"
                  type="number"
                  min={1}
                  placeholder="30"
                  value={form.totalLectures}
                  onChange={(e) => setForm({ ...form, totalLectures: e.target.value })}
                />
                <GlassInput
                  label="Required %"
                  type="number"
                  min={1}
                  max={99}
                  placeholder="80"
                  value={form.requiredPercent}
                  onChange={(e) => setForm({ ...form, requiredPercent: e.target.value })}
                />
              </div>
            </div>

            {formError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <GlassButton
                variant="ghost"
                size="md"
                onClick={() => { setShowAddModal(false); setFormError(null); }}
              >
                Cancel
              </GlassButton>
              <GlassButton variant="primary" size="md" onClick={handleAddCourse} disabled={saving}>
                {saving ? 'Saving…' : 'Add Module'}
              </GlassButton>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </div>
  );
}

function CourseCard({ course, onSkip, onAttended, onGhost }: { course: CourseStats; onSkip: () => void; onAttended: () => void; onGhost: () => void }) {
  return (
    <GlassPanel className="p-5 flex flex-col justify-between border-white/15 bg-slate-900/40">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-mono text-slate-400">{course.code}</span>
          <h4 className="text-md font-bold text-white mt-0.5">{course.name}</h4>
          <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
            {course.attendedCount} attended · {course.skippedCount} skipped
          </p>
        </div>
        {course.riskLevel === 'SAFE' && <CheckCircle size={16} className="text-emerald-400" />}
        {course.riskLevel === 'WARNING' && <AlertTriangle size={16} className="text-amber-400" />}
        {course.riskLevel === 'DANGER' && <ShieldAlert size={16} className="text-rose-400" />}
      </div>

      <div className="mt-5">
        <p className="text-xs text-slate-400">Remaining Skips</p>
        <div className="flex items-baseline justify-between mt-0.5">
          <p className={`text-2xl font-bold tabular-nums ${course.riskLevel === 'SAFE' ? 'text-emerald-400' :
            course.riskLevel === 'WARNING' ? 'text-amber-400' : 'text-rose-400'
            }`}>
            {course.remainingSkips < 0 ? 0 : course.remainingSkips}
          </p>
          <p className="text-[10px] text-slate-500 tabular-nums">{course.attendancePercentage}% current</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 pt-3 mt-4 border-t border-white/[0.07]">
        <GlassButton onClick={onAttended} size="sm" variant="primary" className="w-full justify-center px-1 text-[11px]">
          <CheckCircle size={12} className="mr-1 text-emerald-400 shrink-0" /> Attend
        </GlassButton>
        <GlassButton onClick={onSkip} size="sm" className="w-full justify-center px-1 text-[11px] text-rose-300 hover:text-rose-200 border-rose-500/20">
          <ShieldCheck size={12} className="mr-1 text-rose-400 shrink-0" /> Skip
        </GlassButton>
        <GlassButton onClick={onGhost} size="sm" className="w-full justify-center px-1 text-[11px] text-violet-300 hover:text-violet-200 border-violet-500/20">
          <Ghost size={12} className="mr-1 text-violet-400 shrink-0" /> Ghost
        </GlassButton>
      </div>
    </GlassPanel>
  );
}
