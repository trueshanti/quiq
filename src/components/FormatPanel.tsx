// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
import {
  ArrowLeftRight,
  Check,
  Copy,
  Eraser,
  Info,
  Lock,
  Tag,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { DriveInfo, FilesystemOption } from "@/lib/types";
import { cn, formatBytes, isLuksEncrypted } from "@/lib/utils";

/** Display label for the "Current filesystem" row. */
function fsDisplayLabel(fs: string, cleartextFs: string): string {
  if (isLuksEncrypted(fs)) {
    return cleartextFs
      ? `${cleartextFs.toUpperCase()} (LUKS encrypted)`
      : "LUKS (encrypted, locked)";
  }
  return fs ? fs.toUpperCase() : "None / partitioned";
}

interface FormatPanelProps {
  drive: DriveInfo | null;
  filesystems: FilesystemOption[];
  fsType: string;
  label: string;
  full: boolean;
  encrypt: boolean;
  passphrase: string;
  passphraseConfirm: string;
  onFsType: (id: string) => void;
  onLabel: (label: string) => void;
  onFull: (full: boolean) => void;
  onEncrypt: (encrypt: boolean) => void;
  onPassphrase: (passphrase: string) => void;
  onPassphraseConfirm: (passphrase: string) => void;
  onFormat: () => void;
}

function DetailRow({
  label,
  value,
  critical,
}: {
  label: string;
  value: string;
  critical?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={cn(
          "truncate text-right text-sm font-medium",
          critical
            ? "text-red-600 dark:text-red-400"
            : "text-slate-800 dark:text-slate-200"
        )}
      >
        {value || "—"}
      </span>
    </div>
  );
}

/** A detail row whose value can be copied to the clipboard via a button. */
function CopyableDetailRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            aria-label={`Copy ${label.toLowerCase()}`}
            title={`Copy ${label.toLowerCase()}`}
            className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        <span className="truncate text-right text-sm font-medium text-slate-800 dark:text-slate-200">
          {value || "—"}
        </span>
      </div>
    </div>
  );
}

export function FormatPanel({
  drive,
  filesystems,
  fsType,
  label,
  full,
  encrypt,
  passphrase,
  passphraseConfirm,
  onFsType,
  onLabel,
  onFull,
  onEncrypt,
  onPassphrase,
  onPassphraseConfirm,
  onFormat,
}: FormatPanelProps) {
  const [flipped, setFlipped] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Always show the front (primary info) when the selected drive changes.
  useEffect(() => {
    setFlipped(false);
    setCopiedField(null);
  }, [drive?.objectPath]);

  const handleCopy = async (field: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // Clipboard access denied or unavailable — ignore.
    }
  };

  if (!drive) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <Info className="h-6 w-6" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
          Select a drive
        </p>
        <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
          Pick a removable drive on the left to see its details and format it.
        </p>
      </div>
    );
  }

  const selectedFs = filesystems.find((f) => f.id === fsType);
  const encryptInvalid =
    encrypt && (passphrase.length === 0 || passphrase !== passphraseConfirm);
  const name =
    [drive.vendor, drive.model].filter(Boolean).join(" ") || drive.device;

  const health = drive.smartFailing ? "Failing" : "OK";
  const fsUuid = isLuksEncrypted(drive.currentFs)
    ? drive.cleartextUuid
    : drive.uuid;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink p-6 dark:border-slate-800">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {name}
        </h2>
        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {drive.device}
        </p>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFlipped((f) => !f);
            }
          }}
          aria-label="Flip the card for more drive details"
          className="group mt-3 block w-full cursor-pointer text-left [perspective:1200px]"
        >
          <div
            className={cn(
              "relative grid transition-transform duration-500 [transform-style:preserve-3d]",
              flipped && "[transform:rotateY(180deg)]"
            )}
          >
            {/* Front — primary details */}
            <div className="col-start-1 row-start-1 flex h-full flex-col rounded-lg bg-slate-50 px-3 [backface-visibility:hidden] dark:bg-slate-800/50">
              <DetailRow label="Capacity" value={formatBytes(drive.size)} />
              <DetailRow
                label="Current filesystem"
                value={fsDisplayLabel(drive.currentFs, drive.cleartextFs)}
              />
              <DetailRow
                label="Current label"
                value={
                  isLuksEncrypted(drive.currentFs)
                    ? drive.cleartextLabel
                    : drive.currentLabel
                }
              />
              <DetailRow label="Connection" value={drive.connectionBus.toUpperCase()} />
              <DetailRow
                label="Mounted at"
                value={(isLuksEncrypted(drive.currentFs)
                  ? drive.cleartextMountPoints
                  : drive.mountPoints
                ).join(", ")}
              />
              <div className="mt-auto flex items-center justify-end gap-1 pb-1.5 pt-0.5 text-[10px] font-medium text-slate-400 transition group-hover:text-emerald-500">
                <ArrowLeftRight className="h-3 w-3" /> More
              </div>
            </div>

            {/* Back — hardware identity & lifetime */}
            <div className="col-start-1 row-start-1 flex h-full flex-col rounded-lg bg-slate-50 px-3 [backface-visibility:hidden] [transform:rotateY(180deg)] dark:bg-slate-800/50">
              <DetailRow label="Manufacturer" value={drive.vendor} />
              <DetailRow label="Model" value={drive.model} />
              <CopyableDetailRow
                label="Serial"
                value={drive.serial}
                copied={copiedField === "serial"}
                onCopy={() => handleCopy("serial", drive.serial)}
              />
              {drive.wwn ? (
                <DetailRow label="WWN" value={drive.wwn} />
              ) : null}
              <CopyableDetailRow
                label="Device UUID"
                value={drive.uuid}
                copied={copiedField === "deviceUuid"}
                onCopy={() => handleCopy("deviceUuid", drive.uuid)}
              />
              <CopyableDetailRow
                label="Filesystem UUID"
                value={fsUuid}
                copied={copiedField === "fsUuid"}
                onCopy={() => handleCopy("fsUuid", fsUuid)}
              />
              {drive.smartFailing != null ? (
                <DetailRow
                  label="Health"
                  value={health}
                  critical={drive.smartFailing === true}
                />
              ) : null}
              {drive.powerOnHours != null ? (
                <DetailRow
                  label="Lifetime"
                  value={`${drive.powerOnHours.toLocaleString()} h powered on`}
                />
              ) : null}
              {drive.temperatureC != null ? (
                <DetailRow
                  label="Temperature"
                  value={`${drive.temperatureC.toFixed(0)} °C`}
                />
              ) : null}
              <div className="mt-auto flex items-center justify-end gap-1 pb-1.5 pt-0.5 text-[10px] font-medium text-slate-400 transition group-hover:text-emerald-500">
                <ArrowLeftRight className="h-3 w-3" /> Back
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        {/* Filesystem picker */}
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Format to
          </label>
          <div className="grid grid-cols-3 gap-2">
            {filesystems.map((fs) => (
              <button
                key={fs.id}
                onClick={() => onFsType(fs.id)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-medium transition",
                  fsType === fs.id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "border-ink bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600"
                )}
              >
                {fs.label}
              </button>
            ))}
          </div>
          {selectedFs && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {selectedFs.description}
            </p>
          )}
        </div>

        {/* Volume label */}
        <div>
          <label
            htmlFor="volume-label"
            className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            <Tag className="h-3.5 w-3.5" /> Volume label
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="volume-label"
            type="text"
            value={label}
            maxLength={32}
            spellCheck={false}
            placeholder="e.g. BACKUP"
            onChange={(e) => onLabel(e.target.value)}
            className="w-full rounded-lg border border-ink bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Quick / full toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onFull(false)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition",
              !full
                ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/40 dark:bg-emerald-500/10"
                : "border-ink bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
              <Zap className="h-4 w-4 text-emerald-500" /> Quick
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Fast. Recreates the filesystem only.
            </span>
          </button>
          <button
            onClick={() => onFull(true)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition",
              full
                ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/40 dark:bg-emerald-500/10"
                : "border-ink bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
              <Eraser className="h-4 w-4 text-emerald-500" /> Full erase
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Slow. Zeroes the whole device first.
            </span>
          </button>
        </div>

        {/* Encryption */}
        <div>
          <button
            type="button"
            onClick={() => onEncrypt(!encrypt)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left transition",
              encrypt
                ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/40 dark:bg-emerald-500/10"
                : "border-ink bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
              <Lock className="h-4 w-4 text-emerald-500" /> Encrypt this drive
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              LUKS2
            </span>
          </button>

          {encrypt && (
            <div className="mt-3 space-y-3">
              <div>
                <label
                  htmlFor="encrypt-passphrase"
                  className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Passphrase
                </label>
                <input
                  id="encrypt-passphrase"
                  type="password"
                  value={passphrase}
                  autoComplete="new-password"
                  spellCheck={false}
                  onChange={(e) => onPassphrase(e.target.value)}
                  className="w-full rounded-lg border border-ink bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="encrypt-passphrase-confirm"
                  className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300"
                >
                  Confirm passphrase
                </label>
                <input
                  id="encrypt-passphrase-confirm"
                  type="password"
                  value={passphraseConfirm}
                  autoComplete="new-password"
                  spellCheck={false}
                  onChange={(e) => onPassphraseConfirm(e.target.value)}
                  className="w-full rounded-lg border border-ink bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              {passphrase.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  A passphrase is required to unlock the drive later. Losing it
                  means losing the data.
                </p>
              ) : passphrase !== passphraseConfirm ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Passphrases don&apos;t match.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-ink p-6 dark:border-slate-800">
        <button
          onClick={onFormat}
          disabled={drive.readOnly || encryptInvalid}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-600/30 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {drive.readOnly ? "Drive is read-only" : `Format ${drive.device}`}
        </button>
      </div>
    </div>
  );
}
