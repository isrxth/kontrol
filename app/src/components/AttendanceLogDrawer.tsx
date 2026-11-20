'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clipboard, FileText, RefreshCw } from 'lucide-react';
import type { CourseStats } from '@/lib/api';
import { api } from '@/lib/api';
import { formatLogDate } from '@/lib/dates';
import { LOG_STATUS, type LogStatusKey } from '@/lib/attendance-status';
import { GlassSheet } from '@/components/ui/GlassSheet';

interface AttendanceLogDrawerProps {
  course: CourseStats | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_ORDER: LogStatusKey[] = ['ATTENDED', 'GHOST', 'SKIPPED', 'CANCELLED'];

export function AttendanceLogDrawer({ course, open, onClose }: AttendanceLogDrawerProps) {
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof api.getLogs>>>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!course) return;
    setLoading(true);
    try {
      const data = await api.getLogs(course.id);
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [course]);

  useEffect(() => {
    if (open) void fetchLogs();
  }, [open, fetchLogs]);

  const byStatus = logs.reduce<Record<string, typeof logs>>((acc, log) => {
    (acc[log.status] ??= []).push(log);
    return acc;
  }, {});

  const effectiveAttended = course?.attendedCount ?? 0;
  const ghostCount = course?.ghostCount ?? 0;
  const skippedCount = course?.skippedCount ?? 0;
  const held = effectiveAttended + ghostCount + skippedCount;

  const copyText = useCallback(() => {
    if (!course) return;
    const skipGhost = [...(byStatus.SKIPPED ?? []), ...(byStatus.GHOST ?? [])].sort(
      (a, b) => a.logDate.localeCompare(b.logDate) || (a.slotTime ?? '').localeCompare(b.slotTime ?? '')
    );
    const lines: string[] = [
      `${course.code} — ${course.name}`,
      '',
      'Skipped & Ghosted dates:',
      ...skipGhost.map((l) => {
        const time = l.slotTime ? ` (${l.slotTime})` : '';
        const reason = l.reason ? ` — ${l.reason}` : '';
        return `• ${formatLogDate(l.logDate)}${time}${reason}`;
      }),
      '',
      `Total: ${skipGhost.length}`,
    ];
    const text = lines.join('\n');
    if (typeof navigator.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        // noop
      } finally {
        document.body.removeChild(ta);
      }
    }
  }, [course, byStatus]);

  if (!open) return null;

  return (
    <GlassSheet
      open
      onClose={onClose}
      side="right"
      className="fixed inset-y-0 right-0 z-[201] w-full max-w-md transition-transform duration-250 ease-out"
      headerClassName="bg-slate-900/98"
      maxWidth="max-w-md"
    >
      <div className="flex-1 overflow-y-auto p-5 sm:p-6">
        <div className="space-y-5">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-xs font-mono font-semibold text-slate-400">{course?.code}</p>
              <h3 className="text-lg font-bold text-white">{course?.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {effectiveAttended} attended{ghostCount > 0 ? ` · ${ghostCount} ghosted` : ''} ·
                {skippedCount} skipped · {course?.cancelledCount} cancelled
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Eligibility: {held > 0 ? Math.round(((effectiveAttended + ghostCount) / held) * 100) : 100}%
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void fetchLogs()}
                disabled={loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={copyText}
                disabled={loading || !byStatus.SKIPPED?.length && !byStatus.GHOST?.length}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
                aria-label="Copy dates"
              >
                <Clipboard size={14} />
              </button>
              {copied && <span className="text-[10px] text-emerald-400 font-semibold animate-pulse">Copied</span>}
            </div>
          </div>

          {loading ? (
            <div className="h-24 flex items-center justify-center text-slate-500 text-sm">Loading attendance log…</div>
          ) : logs.length === 0 ? (
            <div className="h-24 flex flex-col items-center justify-center text-slate-500 text-sm">
              <FileText size={20} className="mb-2 opacity-50" />
              <p>No attendance records yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {STATUS_ORDER.map((key) => {
                const group = byStatus[key];
                if (!group?.length) return null;
                const meta = LOG_STATUS[key];
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.colorClass} ${meta.bgClass} ${meta.borderClass}`}>
                        <meta.icon size={10} />
                        {meta.label} ({group.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {group.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-slate-300 tabular-nums truncate">
                              {formatLogDate(log.logDate)}
                            </p>
                            {log.slotTime && (
                              <p className="text-[10px] text-slate-500 tabular-nums">{log.slotTime}</p>
                            )}
                            {log.reason && (
                              <p className="text-[10px] text-slate-400 italic">{log.reason}</p>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold ${meta.colorClass} ${meta.bgClass} rounded-full border ${meta.borderClass} px-1.5 py-0.5 whitespace-nowrap`}>
                            {meta.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="p-4 shrink-0 border-t border-white/[0.08] bg-slate-900/98 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="rounded-xl px-4 py-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-all"
        >
          Done
        </button>
      </div>
    </GlassSheet>
  );
}
