import { Settings, WifiOff, RefreshCw } from 'lucide-react';
import { useOutboxStatus } from '@/lib/offline-store';
import { hapticTap } from '@/lib/haptics';

interface MobileTopBarProps {
  onSettings?: () => void;
}

export function MobileTopBar({ onSettings }: MobileTopBarProps) {
  const { isOffline, pendingCount, isSyncing, flush } = useOutboxStatus();

  return (
    <header
      className="relative z-20 flex items-center justify-between px-4 pb-3"
      style={{ paddingTop: 'calc(var(--sat, env(safe-area-inset-top, 0px)) + 10px)' }}
    >
      <div className="flex items-center gap-2.5">
        <h1 className="text-[22px] font-black text-white tracking-tight select-none">
          Kontrol
        </h1>

        {/* Sync / Offline Pill */}
        {(isOffline || pendingCount > 0) && (
          <button
            onClick={() => void flush()}
            title={isOffline ? 'Offline mode active' : 'Click to force sync'}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/15 text-[10px] font-medium text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)] animate-pulse active:scale-95 transition-all"
          >
            {isSyncing ? (
              <RefreshCw size={10} className="animate-spin text-amber-300" />
            ) : isOffline ? (
              <WifiOff size={10} className="text-amber-300" />
            ) : (
              <RefreshCw size={10} className="text-amber-300" />
            )}
            <span>
              {isSyncing ? 'Syncing…' : isOffline ? (pendingCount > 0 ? `Offline • ${pendingCount}` : 'Offline') : `${pendingCount} queued`}
            </span>
          </button>
        )}
      </div>

      <button
        onClick={() => {
          void hapticTap();
          onSettings?.();
        }}
        aria-label="Settings"
        className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15
          flex items-center justify-center
          active:scale-95 transition-transform duration-150"
      >
        <Settings size={18} className="text-slate-300" />
      </button>
    </header>
  );
}
