// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export interface ToastState {
  kind: "success" | "error";
  message: string;
}

interface ToastProps {
  toast: ToastState | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (!toast || toast.kind !== "success") return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;

  const isError = toast.kind === "error";

  return (
    <div
      className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2"
      style={{ animation: "quiq-fade-in 0.2s ease-out" }}
    >
      <div
        className={
          "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg " +
          (isError
            ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-950/60 dark:text-red-200"
            : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-200")
        }
      >
        {isError ? (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <p className="max-w-sm text-sm">{toast.message}</p>
        <button
          onClick={onClose}
          className="ml-1 shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
