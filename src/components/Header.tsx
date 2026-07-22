// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
import { Github, Moon, RefreshCw, Sun } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PartitionToolMenu } from "@/components/PartitionToolMenu";
import type { FilesystemOption, PartitionTableType } from "@/lib/types";

const REPO_URL = "https://github.com/trueshanti/quiq";

interface HeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  filesystems: FilesystemOption[];
  canCreatePartitionTable: boolean;
  onCreatePartitionTable: (tableType: PartitionTableType, fsType: string) => void;
}

export function Header({
  theme,
  onToggleTheme,
  onRefresh,
  refreshing,
  filesystems,
  canCreatePartitionTable,
  onCreatePartitionTable,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-ink/80 px-6 py-4 dark:border-slate-800">
      <div className="group flex items-center gap-3">
        <svg
          viewBox="0 0 128 128"
          className="h-10 w-10 rounded-xl shadow-sm shadow-red-600/30"
          aria-hidden="true"
        >
          <rect width="128" height="128" rx="28" fill="#dc2626" />
          <circle cx="64" cy="64" r="40" fill="#fef2f2" />
          <circle cx="64" cy="64" r="14" fill="#dc2626" />
          <rect
            x="20"
            y="88"
            width="72"
            height="14"
            rx="7"
            fill="#dc2626"
            transform="rotate(-35 56 95)"
          />
        </svg>
        <div>
          <h1 className="text-lg font-semibold leading-tight text-slate-900 dark:text-slate-50">
            quiq
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Format removable media
          </p>
        </div>
        <a
          href={REPO_URL}
          onClick={(e) => {
            e.preventDefault();
            if (isTauri) {
              void openUrl(REPO_URL);
            } else {
              window.open(REPO_URL, "_blank", "noreferrer");
            }
          }}
          aria-label="View source on GitHub"
          title="View source on GitHub"
          className="grid h-7 w-7 place-items-center rounded-md text-slate-400 opacity-0 transition-opacity duration-200 hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:text-slate-200"
        >
          <Github className="h-4 w-4" />
        </a>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-ink bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw
            className={cn("h-4 w-4", refreshing && "animate-spin")}
            style={refreshing ? { animation: "quiq-spin 1s linear infinite" } : undefined}
          />
          Rescan
        </button>
        <PartitionToolMenu
          disabled={!canCreatePartitionTable}
          filesystems={filesystems}
          onCreate={onCreatePartitionTable}
        />
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  );
}
