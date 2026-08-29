import type { ButtonHTMLAttributes } from "react";

export function PrimaryButton({
  className = "",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`w-full rounded-[14px] bg-accent px-6 py-4 text-center text-base font-bold text-text-on-accent transition-opacity active:opacity-80 disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`w-full rounded-[14px] border border-border bg-transparent px-6 py-4 text-center text-base font-semibold text-text-primary active:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
