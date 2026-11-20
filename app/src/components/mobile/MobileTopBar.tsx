import { Settings } from 'lucide-react';

interface MobileTopBarProps {
  onSettings?: () => void;
}

export function MobileTopBar({ onSettings }: MobileTopBarProps) {
  return (
    <header
      className="relative z-20 flex items-center justify-between px-4 pb-3"
      style={{ paddingTop: 'calc(var(--sat, env(safe-area-inset-top, 0px)) + 10px)' }}
    >
      <h1 className="text-[22px] font-black text-white tracking-tight select-none">
        Kontrol
      </h1>
      <button
        onClick={onSettings}
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
