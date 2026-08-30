import { Component, type ReactNode } from "react";
import { clearAllData } from "@/lib/app-storage";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Without this, an uncaught render error (a corrupted localStorage value
 * that slipped past readJSON's own try/catch, a genuine bug) unmounts the
 * whole React tree with nothing left on screen -- a blank white page with no
 * way to tell what went wrong, worst case scenario the night of a demo.
 * This shows the actual error instead, plus a way out that doesn't require
 * knowing how to open dev tools on a phone.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => {
    clearAllData();
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col justify-center gap-4 bg-bg px-6 py-10 text-text-primary">
        <p className="text-lg font-bold text-error">Something went wrong</p>
        <p className="text-sm text-text-secondary">
          The app hit an error it couldn't recover from. The details below are for debugging.
        </p>
        <pre className="max-h-64 overflow-auto rounded-2xl border border-border bg-surface p-3 text-xs text-text-tertiary">
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
        <button
          type="button"
          onClick={this.handleReset}
          className="rounded-[14px] bg-accent py-3 text-center font-bold text-text-on-accent"
        >
          Reset app data
        </button>
        <p className="text-center text-xs text-text-tertiary">
          This clears everything stored locally (identity, goals, city) and starts fresh.
        </p>
      </div>
    );
  }
}
