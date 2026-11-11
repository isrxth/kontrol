import { useState } from 'react';
import { ReactiveBackground } from './components/ui/ReactiveBackground';
import { GlassHeader } from '@/components/glassyui/glass-header';
import { GlassTabs, GlassTabsList, GlassTabsTrigger } from '@/components/glassyui/glass-tabs';
import { GlassSurface } from '@/components/glassyui/glass-surface';
import { GlassPanel } from '@/components/glassyui/glass-panel';
import { GlassButton } from '@/components/glassyui/glass-button';
import { GlassInput } from '@/components/glassyui/glass-input';
import { useCourses } from '@/hooks/useCourses';
import type { CourseStats } from '@/lib/api';
import { ShieldCheck, Settings, CheckCircle, AlertTriangle, ShieldAlert, Plus, X, Zap, Clock, BookOpen } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const { courses, loading, error, logAttendance, addCourse } = useCourses();
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ code: '', name: '', totalLectures: '', requiredPercent: '80' });
  const [formError, setFormError] = useState<string | null>(null);

  const navigationTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'timetable', label: 'Timetable', count: courses.length },
    { id: 'projects', label: 'Build Vault' },
    { id: 'notifications', label: 'Priority Hub' },
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
          <button className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl border border-transparent hover:border-white/15 transition-all">
            <Settings size={18} />
          </button>
        }
      />

      {/* 3. Main Bento Workspace */}
      <main className="relative z-10 min-h-screen px-4 md:px-8 pt-24 pb-32 flex flex-col items-center justify-center max-w-7xl mx-auto">
        <GlassSurface
          preset="subtle"
          lens
          className="w-full max-w-6xl mx-auto p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative space-y-6"
        >
          {/* Active Tab Header Bar */}
          <div className="flex justify-between items-center pb-6 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight capitalize">
                {activeTab} Dashboard
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                University Attendance Eligibility & Risk Analysis
              </p>
            </div>
            <GlassButton variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
              <Plus size={16} className="mr-2" /> Add Module
            </GlassButton>
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
                    <p className="text-5xl font-black text-emerald-400 mt-1">
                      {courses[0].remainingSkips}
                      <span className="text-sm font-normal text-slate-400 ml-2">skips left</span>
                    </p>
                  </div>
                  <GlassButton onClick={() => logAttendance(courses[0].id, 'SKIPPED')} size="sm">
                    + Log Skip
                  </GlassButton>
                </div>
              </GlassPanel>

              {/* Bento Item 2: Quick Timetable Status */}
              <GlassPanel className="p-6 flex flex-col justify-between border-white/15 bg-slate-900/40">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-slate-400">TIMETABLE</span>
                  <Clock size={18} className="text-indigo-400" />
                </div>
                <div className="my-4">
                  <p className="text-xs text-slate-400">Next Lecture</p>
                  <p className="text-lg font-bold text-white mt-1">Software Architecture</p>
                  <p className="text-xs text-slate-400">08:00 AM • Lab 02</p>
                </div>
                <div className="w-full bg-indigo-500/20 text-indigo-300 text-xs text-center py-2 rounded-xl border border-indigo-500/30 font-semibold">
                  In 45 minutes
                </div>
              </GlassPanel>

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
                <CourseCard key={course.id} course={course} onSkip={() => logAttendance(course.id, 'SKIPPED')} />
              ))}
              </div>
            )
          )}

          {/* Tab Placeholder Views */}
          {activeTab !== 'overview' && (
            <GlassPanel className="p-12 text-center border-white/15 bg-slate-900/40">
              <h3 className="text-xl font-bold text-white capitalize">{activeTab} View</h3>
              <p className="text-slate-400 text-sm mt-2">Section content initializing for Stage 1.</p>
            </GlassPanel>
          )}
        </GlassSurface>
      </main>

      {/* 4. Floating Bottom Glass Navigation */}
      <nav className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
        <div className="pointer-events-auto shadow-2xl">
          <GlassTabs
            value={activeTab}
            onValueChange={setActiveTab}
            orientation="horizontal"
          >
            <GlassTabsList>
              {navigationTabs.map((tab) => (
                <GlassTabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-white/10">
                      {tab.count}
                    </span>
                  )}
                </GlassTabsTrigger>
              ))}
            </GlassTabsList>
          </GlassTabs>
        </div>
      </nav>

      {/* 5. Add Module Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <GlassPanel className="w-full max-w-md p-6 space-y-5 border-white/15 bg-slate-900/60 relative">
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
    </div>
  );
}

function CourseCard({ course, onSkip }: { course: CourseStats; onSkip: () => void }) {
  return (
    <GlassPanel className="p-6 flex flex-col justify-between border-white/15 bg-slate-900/40">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-mono text-slate-400">{course.code}</span>
          <h4 className="text-md font-bold text-white mt-0.5">{course.name}</h4>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {course.attendedCount} attended • {course.skippedCount} skipped
          </p>
        </div>
        {course.riskLevel === 'SAFE' && <CheckCircle size={16} className="text-emerald-400" />}
        {course.riskLevel === 'WARNING' && <AlertTriangle size={16} className="text-amber-400" />}
        {course.riskLevel === 'DANGER' && <ShieldAlert size={16} className="text-rose-400" />}
      </div>

      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="text-xs text-slate-400">Remaining Skips</p>
          <p className={`text-2xl font-bold ${course.riskLevel === 'SAFE' ? 'text-emerald-400' :
            course.riskLevel === 'WARNING' ? 'text-amber-400' : 'text-rose-400'
            }`}>
            {course.remainingSkips < 0 ? 0 : course.remainingSkips}
          </p>
          <p className="text-[10px] text-slate-500">{course.attendancePercentage}% current</p>
        </div>
        <GlassButton onClick={onSkip} size="sm">
          <ShieldCheck size={14} className="mr-1.5" /> Skip
        </GlassButton>
      </div>
    </GlassPanel>
  );
}
