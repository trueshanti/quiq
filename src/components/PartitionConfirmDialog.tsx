// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { DriveInfo, FilesystemOption, PartitionTableType } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

interface PartitionConfirmDialogProps {
  drive: DriveInfo;
  tableType: PartitionTableType;
  fsType: string;
  filesystem: FilesystemOption | undefined;
  working: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const TABLE_LABELS: Record<PartitionTableType, string> = {
  gpt: "GPT",
  dos: "MBR (legacy BIOS)",
};

export function PartitionConfirmDialog({
  drive,
  tableType,
  fsType,
  filesystem,
  working,
  onCancel,
  onConfirm,
}: PartitionConfirmDialogProps) {
  const fsLabel = fsType === "none" ? "Unformatted" : filesystem?.label ?? "—";
  const [typed, setTyped] = useState("");
  // The user must type the bare device name (e.g. "sdb") to proceed.
  const expected = drive.device.replace(/^\/dev\//, "");
  const confirmed = typed.trim() === expected;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !working) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [working, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-ink bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        style={{ animation: "quiq-fade-in 0.15s ease-out" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Create new partition table?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This permanently deletes all data.
              </p>
            </div>
          </div>
          {!working && (
            <button
              onClick={onCancel}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 dark:text-slate-400">Device</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {drive.device} · {formatBytes(drive.size)}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 dark:text-slate-400">Partition table</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {TABLE_LABELS[tableType]}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500 dark:text-slate-400">Partition</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                Whole disk · {fsLabel}
              </span>
            </div>
            {filesystem?.nativeOwnership && (
              <div className="flex justify-between py-0.5">
                <span className="text-slate-500 dark:text-slate-400">Permissions</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  chmod 777, owned by you
                </span>
              </div>
            )}
          </div>

          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
            The existing partition table and all partitions on this drive
            will be erased and replaced with a single {TABLE_LABELS[tableType]}
            {" "}partition spanning the whole disk.
          </p>

          {drive.mountPoints.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              The drive is currently mounted. It will be unmounted automatically.
            </p>
          )}

          <div>
            <label
              htmlFor="partition-confirm-input"
              className="mb-1.5 block text-xs text-slate-600 dark:text-slate-300"
            >
              Type{" "}
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {expected}
              </span>{" "}
              to confirm
            </label>
            <input
              id="partition-confirm-input"
              type="text"
              autoFocus
              disabled={working}
              value={typed}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmed && !working) onConfirm();
              }}
              className="w-full rounded-lg border border-ink bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/30 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-ink p-5 dark:border-slate-800">
          <button
            onClick={onCancel}
            disabled={working}
            className="flex-1 rounded-lg border border-ink bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed || working}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working && (
              <Loader2
                className="h-4 w-4 animate-spin"
                style={{ animation: "quiq-spin 1s linear infinite" }}
              />
            )}
            {working ? "Creating…" : "Erase & Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
