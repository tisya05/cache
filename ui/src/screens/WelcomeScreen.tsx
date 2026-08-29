import { PrimaryButton } from "@/components/PrimaryButton";
import { useAppState } from "@/state/AppStateContext";

export function WelcomeScreen() {
  const { createIdentity, navigate } = useAppState();

  return (
    <div className="flex min-h-screen flex-col justify-between overflow-hidden bg-bg-deep px-6 pb-10 pt-16">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h1 className="text-5xl font-extrabold text-accent">cache</h1>
          <span className="text-2xl text-accent-light">✦</span>
        </div>
        <p className="max-w-xs text-lg text-text-secondary">
          A savings game for students where nobody ever sees your money.
        </p>
      </div>

      <div
        className="relative mx-auto flex h-72 w-72 items-center justify-center rounded-full"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 70%)" }}
      >
        <div className="h-20 w-20 rounded-full bg-accent/20" />
      </div>

      <div className="space-y-3">
        <PrimaryButton
          onClick={() => {
            createIdentity();
            navigate("goals");
          }}
        >
          Create your identity
        </PrimaryButton>
        <p className="text-center text-xs text-text-tertiary">Unlocks with Face ID</p>
      </div>
    </div>
  );
}
