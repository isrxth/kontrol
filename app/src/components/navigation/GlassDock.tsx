import { Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { hapticTap } from '@/lib/haptics';

interface DockTab {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface GlassDockProps {
  tabs: DockTab[];
  activeTab: string;
  onChange: (tab: string) => void;
  brand?: string;
  settings?: boolean;
}

export function GlassDock({ tabs, activeTab, onChange, brand, settings = false }: GlassDockProps) {
  const allTabs: DockTab[] = settings
    ? [...tabs, { id: 'settings', label: 'Settings', icon: Settings }]
    : tabs;

  return (
    <nav className="fixed left-1/2 -translate-x-1/2 z-40 pointer-events-none px-2">
      <div
        className="w-full max-w-md pointer-events-auto"
        style={{
          bottom: 'calc(var(--sab, env(safe-area-inset-bottom, 0px)) + 8px)',
        }}
      >
        <div className="grid items-center rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/[0.14] shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.15)] px-2 py-1.5">
          {brand && (
            <div className="flex flex-col items-center py-1 rounded-2xl min-h-[48px] select-none text-white/60">
              <span className="text-[10px] font-black tracking-tight">{brand}</span>
            </div>
          )}
          {allTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (activeTab !== tab.id) void hapticTap();
                  onChange(tab.id);
                }}
                aria-label={tab.label}
                className={`relative flex flex-col items-center justify-center py-1 rounded-2xl
                  transition-all duration-200 active:scale-95 select-none min-h-[48px] ${
                    active ? 'text-white' : 'text-white/55 hover:text-white/80'
                  }`}
              >
                {active && (
                  <span
                    className="absolute inset-0 rounded-full bg-white/[0.12]
                      border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]
                      transition-all duration-200"
                  />
                )}
                <Icon size={22} className="relative z-10 shrink-0" />
                <span className="relative z-10 text-[11px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
                  {tab.label}
                </span>
                {tab.count !== undefined && (
                  <span className="ml-0.5 px-1.5 py-0.2 text-[9px] rounded-full bg-white/10 font-mono">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
