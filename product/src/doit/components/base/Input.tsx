import { useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export default function Input({
  label,
  hint,
  error,
  id,
  className = "",
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block font-label text-sm font-medium text-foreground-800"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`h-12 w-full rounded-xl border bg-background-50 px-4 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 ${
          error ? "border-primary-400" : "border-background-300"
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-primary-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-foreground-500">{hint}</p>
      ) : null}
    </div>
  );
}