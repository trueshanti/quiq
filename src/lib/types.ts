// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
/** A removable drive as reported by the Rust backend (udisks2). */
export interface DriveInfo {
  objectPath: string;
  device: string;
  model: string;
  vendor: string;
  size: number;
  removable: boolean;
  connectionBus: string;
  currentFs: string;
  currentLabel: string;
  mountPoints: string[];
  /** UUID of the whole device (the LUKS container's own UUID when
   * encrypted, or the filesystem's UUID otherwise). */
  uuid: string;
  /** When `currentFs` is a LUKS container and it's unlocked: the real
   * filesystem type inside (e.g. "ext4"), empty otherwise/if locked. */
  cleartextFs: string;
  /** Label of the unlocked filesystem inside a LUKS container. */
  cleartextLabel: string;
  /** Mount points of the unlocked filesystem inside a LUKS container. */
  cleartextMountPoints: string[];
  /** UUID of the unlocked filesystem inside a LUKS container, empty if
   * locked or not encrypted. */
  cleartextUuid: string;
  readOnly: boolean;
  serial: string;
  revision: string;
  wwn: string;
  /** 0 = flash/non-rotating, >0 = spinning RPM, -1 = unknown. */
  rotationRate: number;
  ejectable: boolean;
  canPowerOff: boolean;
  /** Powered-on lifetime in hours from SMART, or null if unavailable. */
  powerOnHours: number | null;
  /** Current temperature in °C from SMART, or null if unavailable. */
  temperatureC: number | null;
  /** Overall SMART health self-assessment (true = failing), or null if
   * unavailable. */
  smartFailing: boolean | null;
}

/** A selectable target filesystem. */
export interface FilesystemOption {
  id: string;
  label: string;
  description: string;
  nativeOwnership: boolean;
}

/** Partition table type for the "create partition table" quick action. */
export type PartitionTableType = "gpt" | "dos";
