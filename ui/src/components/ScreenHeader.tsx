import { ArrowLeft, X } from "lucide-react";

export function ScreenHeader({
  title,
  onBack,
  onClose,
  right,
}: {
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="relative flex h-14 items-center justify-center px-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-text-primary"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      {title && <h1 className="text-lg font-bold">{title}</h1>}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-text-primary"
        >
          <X size={20} />
        </button>
      )}
      {right && <div className="absolute right-4">{right}</div>}
    </div>
  );
}
