import { PrimaryButton } from "@/components/PrimaryButton";
import { useAppState } from "@/state/AppStateContext";

export function WelcomeScreen() {
  const { createIdentity, navigate } = useAppState();

  return (
    <div className="flex min-h-screen flex-col justify-between overflow-y-auto bg-bg px-6 pb-safe pt-4">
      <div />

      <div className="relative mx-auto flex flex-col items-center px-4 text-center">
        <div
          className="pointer-events-none absolute -inset-x-10 -inset-y-16 -z-10"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 28%, transparent) 0%, transparent 70%)",
            filter: "blur(4px)",
          }}
        />
        <div className="mb-3 flex items-center gap-2">
          <h1 className="text-6xl font-extrabold text-accent">nomi</h1>
          <span className="text-3xl text-accent-light">✦</span>
        </div>
        <p className="max-w-xs text-lg text-text-secondary">
          A savings game for students where nobody ever sees your money.
        </p>
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
      </div>
    </div>
  );
}
