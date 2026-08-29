import { Home, BarChart3, Users, User } from "lucide-react";
import type { Screen } from "@/state/AppStateContext";

const TABS: { screen: Screen; label: string; icon: typeof Home }[] = [
  { screen: "city", label: "City", icon: Home },
  { screen: "insights", label: "Insights", icon: BarChart3 },
  { screen: "friends", label: "Friends", icon: Users },
  { screen: "profile", label: "Profile", icon: User },
];

export function BottomNav({ active, onNavigate }: { active: Screen; onNavigate: (s: Screen) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-surface/95 pb-safe pt-2 backdrop-blur">
      {TABS.map(({ screen, label, icon: Icon }) => {
        const isActive = active === screen;
        return (
          <button
            key={screen}
            type="button"
            onClick={() => onNavigate(screen)}
            className="flex flex-1 flex-col items-center gap-1 py-1 text-xs font-semibold"
          >
            <Icon size={22} className={isActive ? "text-accent" : "text-text-tertiary"} strokeWidth={2} />
            <span className={isActive ? "text-accent" : "text-text-tertiary"}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
