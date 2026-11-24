import { useState, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ReactiveBackground } from '@/components/ui/ReactiveBackground';
import { GlassInput } from '@/components/glassyui/glass-input';
import { GlassButton } from '@/components/glassyui/glass-button';
import { GlassPanel } from '@/components/glassyui/glass-panel';
import { DashboardMobileSkeleton } from '@/components/ui/GlassySkeleton';
import { syncAllNotifications } from '@/lib/notifications';

const TimetableBoard = lazy(() =>
  import('@/components/timetable/TimetableBoard').then((m) => ({ default: m.TimetableBoard }))
);
const BuildVault = lazy(() =>
  import('@/components/vault/BuildVault').then((m) => ({ default: m.BuildVault }))
);
const SettingsModal = lazy(() =>
  import('@/components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);

import { MobileTopBar } from './MobileTopBar';
import { MobileHeroMetric } from './MobileHeroMetric';
import { ModuleCarousel } from './ModuleCarousel';
import { QuickActionsRow } from './QuickActionsRow';
import { NextLectureBanner } from './NextLectureBanner';
import { UpNextList } from './UpNextList';
import { MobileDock } from './MobileDock';

import type { CourseStats, TodaySlot, LogStatus } from '@/lib/api';
import type { TimetableController } from '@/hooks/useTimetable';
import type { ProjectsController } from '@/hooks/useProjects';
import type { ActivitiesController } from '@/hooks/useActivities';

interface MobileShellProps {
  courses: CourseStats[];
  loading: boolean;
  error: string | null;
  timetable: TimetableController;
  projectsCtrl: ProjectsController;
  activitiesCtrl: ActivitiesController;
  logAttendance: (courseId: string, status: LogStatus, reason?: string) => Promise<void>;
  addCourse: (input: { code: string; name: string; totalLectures: number; requiredRatio: number }) => Promise<void>;
}

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

export function MobileShell({
  courses,
  loading,
  error,
  timetable,
  projectsCtrl,
  activitiesCtrl,
  logAttendance,
  addCourse,
}: MobileShellProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? courses[0] ?? null;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (courses.length > 0) {
      void syncAllNotifications(courses, timetable.slots, activitiesCtrl.activities, new Set());
    }
  }, [courses, timetable.slots, activitiesCtrl.activities]);
  const [form, setForm] = useState({ code: '', name: '', totalLectures: '', requiredPercent: '80' });
  const [formError, setFormError] = useState<string | null>(null);

  const nextLecture = nextLectureSlot(timetable.today);

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

  return (
    <div className="relative min-h-screen w-full text-slate-100 antialiased overflow-x-hidden">
      {/* Background */}
      <ReactiveBackground
        colors={['#120f17', '#2460df', '#2140d5', '#002179', '#070707']}
        angle={161}
        flow={1.1}
        silk={0.35}
        grainAmount={0.03}
        scale={1.05}
        contrast={1.15}
        saturation={0.69}
      />

      {/* Top bar */}
      <MobileTopBar onSettings={() => setShowSettingsModal(true)} />

      {/* Tab content */}
      <div
        key={activeTab}
        className="mobile-tab-enter relative z-10"
        style={{ paddingBottom: 'calc(var(--sab, env(safe-area-inset-bottom, 0px)) + 88px)' }}
      >
        {activeTab === 'overview' && (
          <>
            {loading && courses.length === 0 ? (
              <DashboardMobileSkeleton />
            ) : error && courses.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-rose-400 font-semibold">API Offline</p>
                <p className="text-slate-500 text-xs mt-1">{error}</p>
              </div>
            ) : (
              <>
                {/* Hero metric */}
                <MobileHeroMetric courses={courses} />

                {/* Horizontal module carousel */}
                <div className="mb-1">
                  <div className="flex items-center justify-between px-4 mb-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Modules
                    </span>
                    {selectedCourse && (
                      <span className="text-[11px] text-indigo-400 font-semibold">
                        {selectedCourse.code} selected
                      </span>
                    )}
                  </div>
                  {courses.length === 0 ? (
                    <div className="px-4">
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="w-full h-[116px] rounded-[20px] border border-dashed border-white/20
                          flex flex-col items-center justify-center gap-2
                          active:scale-[0.98] transition-transform duration-150"
                      >
                        <span className="text-white/40 text-2xl">+</span>
                        <span className="text-white/40 text-xs">Add your first module</span>
                      </button>
                    </div>
                  ) : (
                    <ModuleCarousel
                      courses={courses}
                      selectedCourseId={selectedCourse?.id}
                      onAddModule={() => setShowAddModal(true)}
                      onSelectCourse={(c) => setSelectedCourseId(c.id)}
                    />
                  )}
                </div>

                {/* Quick actions */}
                <QuickActionsRow
                  selectedCourse={selectedCourse}
                  onLogAttendance={logAttendance}
                  onOpenTimetable={() => setActiveTab('timetable')}
                  onAddTask={() => setActiveTab('projects')}
                />

                {/* Next lecture banner */}
                <div className="px-4 mt-1 mb-2">
                  <NextLectureBanner
                    next={nextLecture}
                    onPress={() => setActiveTab('timetable')}
                  />
                </div>

                {/* Up next list */}
                <UpNextList
                  activities={activitiesCtrl.activities}
                  onViewAll={() => setActiveTab('notifications')}
                />
              </>
            )}
          </>
        )}

        {activeTab === 'timetable' && (
          <div className="px-2 pt-2">
            <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading timetable…</div>}>
              <TimetableBoard timetable={timetable} />
            </Suspense>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="px-2 pt-2">
            <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading vault…</div>}>
              <BuildVault
                projectsCtrl={projectsCtrl}
                activitiesCtrl={activitiesCtrl}
                courses={courses}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="px-4 pt-4">
            <GlassPanel className="p-8 text-center border-white/15 bg-slate-900/40">
              <h3 className="text-lg font-bold text-white">Priority Hub</h3>
              <p className="text-slate-400 text-sm mt-2">Coming soon.</p>
            </GlassPanel>
          </div>
        )}
      </div>

      {/* Floating dock */}
      <MobileDock activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Add Module bottom sheet */}
      {showAddModal && createPortal(
        <div
          className="fixed inset-0 z-[200] flex flex-col justify-end bg-black/75 backdrop-blur-sm overflow-y-auto overscroll-contain"
          onClick={() => { setShowAddModal(false); setFormError(null); }}
        >
          <div
            className="w-full max-h-[85dvh] flex flex-col bg-slate-900/98 rounded-t-[28px] border-t border-x border-white/15 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 pb-3 shrink-0 border-b border-white/[0.06]">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2.5" />
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">Add Module</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Track attendance risk for a new course</p>
                </div>
                <button
                  onClick={() => { setShowAddModal(false); setFormError(null); }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-3">
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
              <div className="grid grid-cols-2 gap-3">
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
              {formError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                  {formError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 shrink-0 border-t border-white/[0.08] bg-slate-900/98 pb-[calc(var(--sab,env(safe-area-inset-bottom,0px))+16px)] flex gap-3">
              <GlassButton
                variant="ghost"
                size="md"
                onClick={() => { setShowAddModal(false); setFormError(null); }}
                className="flex-1"
              >
                Cancel
              </GlassButton>
              <GlassButton variant="primary" size="md" onClick={handleAddCourse} disabled={saving} className="flex-1">
                {saving ? 'Saving…' : 'Add Module'}
              </GlassButton>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <Suspense fallback={null}>
          <SettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
        </Suspense>
      )}
    </div>
  );
}
