import { LayoutDashboard, Calendar, FolderGit2, Bell } from 'lucide-react';
import { hapticTap } from '@/lib/haptics';

interface MobileDockProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NAV_TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'timetable', label: 'Timetable', icon: Calendar },
  { id: 'projects', label: 'Vault', icon: FolderGit2 },
  { id: 'notifications', label: 'Priority', icon: Bell },
];

export function MobileDock({ activeTab, setActiveTab }: MobileDockProps) {
  return (
    <nav
      className="fixed inset-x-0 z-50 flex justify-center pointer-events-none px-4"
      style={{ bottom: 'calc(var(--sab, env(safe-area-inset-bottom, 0px)) + 8px)' }}
    >
      <div className="w-full max-w-md pointer-events-auto">
        <div
          className="grid grid-cols-4 items-center rounded-full
            bg-white/[0.08] backdrop-blur-xl border border-white/[0.14]
            shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.15)]
            px-2 py-1.5"
        >
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (activeTab !== tab.id) void hapticTap();
                  setActiveTab(tab.id);
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
                <span className="relative z-10 text-[11px] font-medium tracking-tight mt-0.5">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
