// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
import { HardDrive, MemoryStick, Usb, Lock, AlertTriangle } from "lucide-react";
import type { DriveInfo } from "@/lib/types";
import { cn, formatBytes, isLuksEncrypted } from "@/lib/utils";

function DriveIcon({ bus }: { bus: string }) {
  if (bus === "sdio") return <MemoryStick className="h-5 w-5" />;
  if (bus === "usb") return <Usb className="h-5 w-5" />;
  return <HardDrive className="h-5 w-5" />;
}

interface DriveCardProps {
  drive: DriveInfo;
  selected: boolean;
  onSelect: () => void;
}

function DriveCard({ drive, selected, onSelect }: DriveCardProps) {
  const name =
    [drive.vendor, drive.model].filter(Boolean).join(" ") ||
    drive.currentLabel ||
    drive.device;
  const encrypted = isLuksEncrypted(drive.currentFs);
  // For an encrypted container, the container itself is never "mounted" —
  // its unlocked cleartext filesystem is. Check both.
  const mounted = encrypted
    ? drive.cleartextMountPoints.length > 0
    : drive.mountPoints.length > 0;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
        selected
          ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/40 dark:border-emerald-500 dark:bg-emerald-500/10"
          : "border-ink bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
      )}
    >
      <div
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-lg",
          selected
            ? "bg-emerald-600 text-emerald-50"
            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
        )}
      >
        <DriveIcon bus={drive.connectionBus} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {name}
          </span>
          {drive.readOnly && (
            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-mono">{drive.device}</span>
          <span>·</span>
          <span>{formatBytes(drive.size)}</span>
          {drive.currentFs && (
            <>
              <span>·</span>
              <span className="uppercase">
                {encrypted ? "LUKS" : drive.currentFs}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {drive.smartFailing === true && (
          <span className="flex w-24 items-center justify-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700 dark:bg-red-500/15 dark:text-red-400">
            <AlertTriangle className="h-2.5 w-2.5" /> Health
          </span>
        )}
        {encrypted && (
          <span className="flex w-24 items-center justify-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <Lock className="h-2.5 w-2.5" /> Encrypted
          </span>
        )}
        {mounted && (
          <span className="flex w-24 items-center justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            Mounted
          </span>
        )}
      </div>
    </button>
  );
}

interface DriveListProps {
  drives: DriveInfo[];
  loading: boolean;
  selectedPath: string | null;
  onSelect: (drive: DriveInfo) => void;
}

export function DriveList({
  drives,
  loading,
  selectedPath,
  onSelect,
}: DriveListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[68px] animate-pulse rounded-xl border border-ink bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50"
          />
        ))}
      </div>
    );
  }

  if (drives.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
        <Usb className="mb-3 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          No removable drives found
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Plug in a USB stick or SD card, then press Rescan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drives.map((drive) => (
        <DriveCard
          key={drive.objectPath}
          drive={drive}
          selected={selectedPath === drive.objectPath}
          onSelect={() => onSelect(drive)}
        />
      ))}
    </div>
  );
}
