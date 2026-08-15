// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
import type { DriveInfo, FilesystemOption } from "./types";

/** True when running inside the Tauri webview (vs. a plain browser for UI dev). */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// --- Mock data so the UI can be developed in a normal browser (`npm run dev`) ---
const MOCK_DRIVES: DriveInfo[] = [
  {
    objectPath: "/org/freedesktop/UDisks2/block_devices/sdb",
    device: "/dev/sdb",
    model: "Ultra Fit",
    vendor: "SanDisk",
    size: 15_931_539_456,
    removable: true,
    connectionBus: "usb",
    currentFs: "vfat",
    currentLabel: "USB STICK",
    mountPoints: ["/run/media/shanti/USB STICK"],
    uuid: "1234-ABCD",
    cleartextFs: "",
    cleartextLabel: "",
    cleartextMountPoints: [],
    cleartextUuid: "",
    readOnly: false,
    serial: "4C531001234567890123",
    revision: "1.00",
    wwn: "",
    rotationRate: 0,
    ejectable: true,
    canPowerOff: true,
    powerOnHours: null,
    temperatureC: null,
    smartFailing: null,
  },
  {
    objectPath: "/org/freedesktop/UDisks2/block_devices/sdc",
    device: "/dev/sdc",
    model: "Extreme SDXC",
    vendor: "SanDisk",
    size: 128_043_712_512,
    removable: true,
    connectionBus: "sdio",
    currentFs: "exfat",
    currentLabel: "",
    mountPoints: [],
    uuid: "5678-EF90",
    cleartextFs: "",
    cleartextLabel: "",
    cleartextMountPoints: [],
    cleartextUuid: "",
    readOnly: false,
    serial: "0xA1B2C3D4",
    revision: "8.0",
    wwn: "",
    rotationRate: 0,
    ejectable: true,
    canPowerOff: false,
    powerOnHours: null,
    temperatureC: null,
    smartFailing: false,
  },
  {
    objectPath: "/org/freedesktop/UDisks2/block_devices/sdi",
    device: "/dev/sdi",
    model: "Extreme",
    vendor: "SanDisk",
    size: 58_400_000_000,
    removable: true,
    connectionBus: "usb",
    currentFs: "crypto_LUKS",
    currentLabel: "",
    mountPoints: [],
    uuid: "a1b2c3d4-e5f6-4789-a012-3456789abcde",
    cleartextFs: "ext4",
    cleartextLabel: "Vault",
    cleartextMountPoints: ["/run/media/shanti/Vault"],
    cleartextUuid: "f0e1d2c3-b4a5-4678-9012-abcdef123456",
    readOnly: false,
    serial: "4C531009876543210987",
    revision: "2.10",
    wwn: "",
    rotationRate: 0,
    ejectable: true,
    canPowerOff: true,
    powerOnHours: null,
    temperatureC: null,
    smartFailing: true,
  },
];

const MOCK_FS: FilesystemOption[] = [
  { id: "exfat", label: "exFAT", description: "Universal, no 4 GB file limit. Ideal for large USB sticks.", nativeOwnership: false },
  { id: "vfat", label: "FAT32", description: "Reads everywhere: Windows, macOS, Linux. Max 4 GB per file.", nativeOwnership: false },
  { id: "xfs", label: "XFS", description: "High-performance Linux filesystem for large files.", nativeOwnership: true },
  { id: "ext4", label: "ext4", description: "Modern Linux default. Best for Linux-only drives.", nativeOwnership: true },
];

export async function listRemovableDrives(): Promise<DriveInfo[]> {
  if (!isTauri) return structuredClone(MOCK_DRIVES);
  return invoke<DriveInfo[]>("list_removable_drives");
}

export async function listSupportedFilesystems(): Promise<FilesystemOption[]> {
  if (!isTauri) return structuredClone(MOCK_FS);
  return invoke<FilesystemOption[]>("list_supported_filesystems");
}

export async function formatDrive(args: {
  objectPath: string;
  fsType: string;
  label: string;
  full: boolean;
  encrypt: boolean;
  passphrase: string;
}): Promise<void> {
  if (!isTauri) {
    // Simulate a format in the browser.
    await new Promise((r) => setTimeout(r, 1600));
    return;
  }
  return invoke<void>("format_drive", args);
}

export async function createPartitionTable(args: {
  objectPath: string;
  tableType: string;
  fsType: string;
}): Promise<void> {
  if (!isTauri) {
    // Simulate the operation in the browser.
    await new Promise((r) => setTimeout(r, 1600));
    return;
  }
  return invoke<void>("create_partition_table", args);
}
