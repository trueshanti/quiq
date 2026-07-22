// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { DriveList } from "@/components/DriveList";
import { FormatPanel } from "@/components/FormatPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PartitionConfirmDialog } from "@/components/PartitionConfirmDialog";
import { Toast, type ToastState } from "@/components/Toast";
import { useTheme } from "@/hooks/useTheme";
import {
  createPartitionTable,
  formatDrive,
  isTauri,
  listRemovableDrives,
  listSupportedFilesystems,
} from "@/lib/api";
import type { DriveInfo, FilesystemOption, PartitionTableType } from "@/lib/types";

export default function App() {
  const { theme, toggle } = useTheme();

  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filesystems, setFilesystems] = useState<FilesystemOption[]>([]);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  // null = use the default responsive width; a number = user-resized px width.
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const resizingRef = useRef(false);
  const [fsType, setFsType] = useState("exfat");
  const [label, setLabel] = useState("");
  const [full, setFull] = useState(false);
  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseConfirm, setPassphraseConfirm] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [partitionRequest, setPartitionRequest] = useState<{
    tableType: PartitionTableType;
    fsType: string;
  } | null>(null);
  const [creatingPartitionTable, setCreatingPartitionTable] = useState(false);

  const selectedDrive = useMemo(
    () => drives.find((d) => d.objectPath === selectedPath) ?? null,
    [drives, selectedPath]
  );

  const loadDrives = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const list = await listRemovableDrives();
      setDrives(list);
      setSelectedPath((prev) =>
        prev && list.some((d) => d.objectPath === prev)
          ? prev
          : list[0]?.objectPath ?? null
      );
    } catch (e) {
      setToast({ kind: "error", message: String(e) });
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDrives({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, [loadDrives]);

  useEffect(() => {
    loadDrives();
    listSupportedFilesystems()
      .then((fs) => {
        setFilesystems(fs);
        setFsType((current) =>
          fs.some((f) => f.id === current) ? current : fs[0]?.id ?? current
        );
      })
      .catch((e) => setToast({ kind: "error", message: String(e) }));
  }, [loadDrives]);

  // Periodically rescan so hot-plugged drives appear (skip while formatting).
  useEffect(() => {
    if (!isTauri) return;
    const id = setInterval(() => {
      if (!formatting && !confirmOpen && !creatingPartitionTable && !partitionRequest) {
        loadDrives({ silent: true });
      }
    }, 5000);
    return () => clearInterval(id);
  }, [formatting, confirmOpen, creatingPartitionTable, partitionRequest, loadDrives]);

  const handleSelect = useCallback((drive: DriveInfo) => {
    setSelectedPath(drive.objectPath);
    setLabel("");
    setEncrypt(false);
    setPassphrase("");
    setPassphraseConfirm("");
  }, []);

  const handleConfirmFormat = useCallback(async () => {
    if (!selectedDrive) return;
    if (encrypt && (!passphrase || passphrase !== passphraseConfirm)) return;
    setFormatting(true);
    try {
      await formatDrive({
        objectPath: selectedDrive.objectPath,
        fsType,
        label: label.trim(),
        full,
        encrypt,
        passphrase,
      });
      setConfirmOpen(false);
      setToast({
        kind: "success",
        message: `${selectedDrive.device} formatted as ${fsType.toUpperCase()}${encrypt ? " (encrypted)" : ""}.`,
      });
      await loadDrives();
    } catch (e) {
      setToast({ kind: "error", message: String(e) });
    } finally {
      setFormatting(false);
      setPassphrase("");
      setPassphraseConfirm("");
    }
  }, [selectedDrive, fsType, label, full, encrypt, passphrase, passphraseConfirm, loadDrives]);

  const handleCreatePartitionTable = useCallback(async () => {
    if (!selectedDrive || !partitionRequest) return;
    setCreatingPartitionTable(true);
    try {
      await createPartitionTable({
        objectPath: selectedDrive.objectPath,
        tableType: partitionRequest.tableType,
        fsType: partitionRequest.fsType,
      });
      setPartitionRequest(null);
      const tableLabel = partitionRequest.tableType === "gpt" ? "GPT" : "MBR";
      const partitionLabel =
        partitionRequest.fsType === "none"
          ? "unformatted partition"
          : `${partitionRequest.fsType.toUpperCase()} partition`;
      setToast({
        kind: "success",
        message: `${selectedDrive.device} now has a new ${tableLabel} partition table with a ${partitionLabel}.`,
      });
      await loadDrives();
    } catch (e) {
      setToast({ kind: "error", message: String(e) });
    } finally {
      setCreatingPartitionTable(false);
    }
  }, [selectedDrive, partitionRequest, loadDrives]);

  // Drag-to-resize the left column: min 440px (avoids wrapping drive
  // descriptions, incl. the fixed-width status badges), max 50% of the
  // window width.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!resizingRef.current || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const min = 440;
      const max = Math.max(min, Math.round(window.innerWidth * 0.5));
      const next = Math.min(Math.max(e.clientX - rect.left, min), max);
      setLeftWidth(next);
    };
    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const startResize = useCallback((e: React.PointerEvent) => {
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  }, []);

  return (
    <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-ink dark:text-slate-100">
      <Header
        theme={theme}
        onToggleTheme={toggle}
        onRefresh={handleRefresh}
        refreshing={loading || refreshing}
        filesystems={filesystems}
        canCreatePartitionTable={
          !!selectedDrive && !formatting && !creatingPartitionTable && !confirmOpen && !partitionRequest
        }
        onCreatePartitionTable={(tableType, fsTypeChoice) =>
          setPartitionRequest({ tableType, fsType: fsTypeChoice })
        }
      />

      <main
        ref={mainRef}
        className="grid flex-1 grid-cols-[minmax(440px,36.5%)_1fr] overflow-hidden"
        style={
          leftWidth != null
            ? { gridTemplateColumns: `${leftWidth}px 1fr` }
            : undefined
        }
      >
        {/* Left: drive list */}
        <section className="relative flex flex-col overflow-hidden border-r border-ink dark:border-slate-800">
          <div className="flex items-center justify-between px-6 pb-2 pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Removable drives
            </h2>
            {drives.length > 0 && (
              <span className="text-xs text-slate-400">{drives.length}</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <DriveList
              drives={drives}
              loading={loading}
              selectedPath={selectedPath}
              onSelect={handleSelect}
            />
          </div>
          <div className="flex items-center gap-2 border-t border-ink px-6 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Only removable media is shown. System disks are protected.
          </div>
          {/* Drag handle to resize the column */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize drive list"
            onPointerDown={startResize}
            onDoubleClick={() => setLeftWidth(null)}
            title="Drag to resize · double-click to reset"
            className="absolute right-0 top-0 z-10 h-full w-1.5 translate-x-1/2 cursor-col-resize bg-transparent transition-colors hover:bg-emerald-500/40"
          />
        </section>

        {/* Right: details + format */}
        <section className="overflow-hidden">
          <FormatPanel
            drive={selectedDrive}
            filesystems={filesystems}
            fsType={fsType}
            label={label}
            full={full}
            encrypt={encrypt}
            passphrase={passphrase}
            passphraseConfirm={passphraseConfirm}
            onFsType={setFsType}
            onLabel={setLabel}
            onFull={setFull}
            onEncrypt={setEncrypt}
            onPassphrase={setPassphrase}
            onPassphraseConfirm={setPassphraseConfirm}
            onFormat={() => setConfirmOpen(true)}
          />
        </section>
      </main>

      {confirmOpen && selectedDrive && (
        <ConfirmDialog
          drive={selectedDrive}
          filesystem={filesystems.find((f) => f.id === fsType)}
          label={label.trim()}
          full={full}
          encrypt={encrypt}
          formatting={formatting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirmFormat}
        />
      )}

      {partitionRequest && selectedDrive && (
        <PartitionConfirmDialog
          drive={selectedDrive}
          tableType={partitionRequest.tableType}
          fsType={partitionRequest.fsType}
          filesystem={filesystems.find((f) => f.id === partitionRequest.fsType)}
          working={creatingPartitionTable}
          onCancel={() => setPartitionRequest(null)}
          onConfirm={handleCreatePartitionTable}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
