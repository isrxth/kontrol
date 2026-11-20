import { CheckCircle2, Ghost, XCircle, Ban } from 'lucide-react';

export const LOG_STATUS: Record<string, { label: string; icon: React.ComponentType<{size?: number}>; colorClass: string; bgClass: string; borderClass: string }> = {
  ATTENDED: {
    label: 'Attended',
    icon: CheckCircle2,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/15',
    borderClass: 'border-emerald-500/30',
  },
  GHOST: {
    label: 'Ghosted',
    icon: Ghost,
    colorClass: 'text-violet-400',
    bgClass: 'bg-violet-500/15',
    borderClass: 'border-violet-500/30',
  },
  SKIPPED: {
    label: 'Skipped',
    icon: XCircle,
    colorClass: 'text-rose-400',
    bgClass: 'bg-rose-500/15',
    borderClass: 'border-rose-500/30',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: Ban,
    colorClass: 'text-slate-400',
    bgClass: 'bg-slate-500/15',
    borderClass: 'border-slate-500/30',
  },
} as const;

export type LogStatusKey = keyof typeof LOG_STATUS;
