import { useEffect, useRef } from "react";
import { AppStateProvider, useAppState } from "@/state/AppStateContext";
import { BottomNav } from "@/components/BottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { loadNeedsReviewIds } from "@/lib/transactions";
import { loadReviewedIds, clearAllData } from "@/lib/app-storage";
import { CityScreen } from "@/screens/CityScreen";
import { WelcomeScreen } from "@/screens/WelcomeScreen";
import { GoalsScreen } from "@/screens/GoalsScreen";
import { ConnectScreen } from "@/screens/ConnectScreen";
import { ProveScreen } from "@/screens/ProveScreen";
import { FriendsScreen } from "@/screens/FriendsScreen";
import { ReviewQueueScreen } from "@/screens/ReviewQueueScreen";
import { InsightsScreen } from "@/screens/InsightsScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { TransactionLogScreen } from "@/screens/TransactionLogScreen";

const TAB_SCREENS = new Set(["city", "insights", "friends", "profile", "prove"]);

function Shell() {
  const { screen, navigate, clientReady, clientError, identitySecret } = useAppState();
  // Review queue "surfaces on boot when ambiguous transactions exist" (spec
  // §9) -- checked once per app load, not on every return to City, so
  // finishing the queue (or navigating away) doesn't force it right back up.
  const checkedReviewOnBoot = useRef(false);

  useEffect(() => {
    if (!clientReady || checkedReviewOnBoot.current || screen !== "city") return;
    checkedReviewOnBoot.current = true;
    const needsReview = loadNeedsReviewIds();
    const reviewed = loadReviewedIds();
    const pending = [...needsReview].some((id) => !reviewed.has(id));
    if (pending) navigate("review");
  }, [clientReady, screen, navigate]);

  if (screen === "welcome" || !identitySecret) return <WelcomeScreen />;
  if (screen === "goals") return <GoalsScreen />;
  if (screen === "connect") return <ConnectScreen />;

  if (!clientReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-text-tertiary">{clientError ? "Couldn't load your data" : "Loading…"}</p>
        {clientError && (
          <>
            <p className="text-xs text-text-tertiary">{clientError}</p>
            {/* Profile (with its own "Clear all data") is unreachable from
               here -- it only renders once clientReady is true, which is
               exactly what's not happening -- so this can't just point
               there, it has to actually do it. */}
            <button
              type="button"
              onClick={() => {
                clearAllData();
                window.location.reload();
              }}
              className="mt-2 rounded-[14px] border border-error/40 px-4 py-2 text-sm font-semibold text-error"
            >
              Clear all data and start over
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {screen === "city" && <CityScreen />}
      {screen === "insights" && <InsightsScreen />}
      {screen === "friends" && <FriendsScreen />}
      {screen === "profile" && <ProfileScreen />}
      {screen === "prove" && <ProveScreen />}
      {screen === "review" && <ReviewQueueScreen />}
      {screen === "transactionLog" && <TransactionLogScreen />}
      {TAB_SCREENS.has(screen) && (
        <BottomNav active={screen === "prove" ? "city" : screen} onNavigate={navigate} />
      )}
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppStateProvider>
        <div className="pt-safe mx-auto min-h-dvh max-w-md bg-bg text-text-primary">
          <Shell />
        </div>
      </AppStateProvider>
    </ErrorBoundary>
  );
}
