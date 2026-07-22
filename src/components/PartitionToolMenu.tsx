// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useRef, useState } from "react";
import { ChevronDown, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilesystemOption, PartitionTableType } from "@/lib/types";

interface PartitionToolMenuProps {
  disabled: boolean;
  filesystems: FilesystemOption[];
  onCreate: (tableType: PartitionTableType, fsType: string) => void;
}

/** Tiny toolmenu next to "Rescan": quickly wipe the selected drive, lay
 * down a fresh GPT or MBR partition table, and create one partition
 * spanning the whole disk with the chosen filesystem. */
export function PartitionToolMenu({
  disabled,
  filesystems,
  onCreate,
}: PartitionToolMenuProps) {
  const [open, setOpen] = useState(false);
  const [tableType, setTableType] = useState<PartitionTableType>("gpt");
  // Defaults to "none" (leave the new partition unformatted), the first
  // option in the filesystem select.
  const [fsType, setFsType] = useState("none");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeFsType = fsType;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Partition tools"
        title="Partition tools"
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <HardDrive className="h-4 w-4" />
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-ink bg-white p-4 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-800"
          style={{ animation: "quiq-fade-in 0.15s ease-out" }}
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            New partition table
          </p>

          <div className="mb-3">
            <span className="mb-1.5 block text-xs text-slate-600 dark:text-slate-300">
              Table type
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTableType("gpt")}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                  tableType === "gpt"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "border-ink bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
              >
                GPT
              </button>
              <button
                onClick={() => setTableType("dos")}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                  tableType === "dos"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400"
                    : "border-ink bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                )}
              >
                MBR (legacy BIOS)
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label
              htmlFor="partition-fs-type"
              className="mb-1.5 block text-xs text-slate-600 dark:text-slate-300"
            >
              Filesystem
            </label>
            <select
              id="partition-fs-type"
              value={activeFsType}
              onChange={(e) => setFsType(e.target.value)}
              className="w-full rounded-lg border border-ink bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="none">None (leave unformatted)</option>
              {filesystems.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Creates one partition spanning the whole disk. This erases
            everything on the drive.
          </p>

          <button
            onClick={() => {
              setOpen(false);
              onCreate(tableType, activeFsType);
            }}
            disabled={!activeFsType}
            className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create partition table
          </button>
        </div>
      )}
    </div>
  );
}
