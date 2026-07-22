// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
//! Talks to the system `udisks2` service over D-Bus to enumerate removable
//! drives. All privileged actions (formatting) are performed by udisks2 itself,
//! which triggers a polkit authentication prompt — this app never calls `mkfs`
//! or `sudo` directly.

use std::collections::HashMap;

use serde::Serialize;
use zbus::zvariant::{OwnedObjectPath, OwnedValue};
use zbus::Connection;

const BLOCK_IFACE: &str = "org.freedesktop.UDisks2.Block";
const PARTITION_IFACE: &str = "org.freedesktop.UDisks2.Partition";
const PARTITION_TABLE_IFACE: &str = "org.freedesktop.UDisks2.PartitionTable";
const FILESYSTEM_IFACE: &str = "org.freedesktop.UDisks2.Filesystem";

/// Result of `org.freedesktop.DBus.ObjectManager.GetManagedObjects`:
/// `a{ o a{ s a{ s v } } }`. We only read the interface *names* (keys); the
/// property values are fetched later via typed proxies for reliability.
type ManagedObjects =
    HashMap<OwnedObjectPath, HashMap<String, HashMap<String, OwnedValue>>>;

#[zbus::proxy(
    interface = "org.freedesktop.DBus.ObjectManager",
    default_service = "org.freedesktop.UDisks2",
    default_path = "/org/freedesktop/UDisks2"
)]
pub(crate) trait ObjectManager {
    fn get_managed_objects(&self) -> zbus::Result<ManagedObjects>;
}

#[zbus::proxy(
    interface = "org.freedesktop.UDisks2.Block",
    default_service = "org.freedesktop.UDisks2"
)]
pub(crate) trait Block {
    /// Create a new filesystem on the whole device. Triggers polkit auth.
    fn format(
        &self,
        type_: &str,
        options: HashMap<&str, zbus::zvariant::Value<'_>>,
    ) -> zbus::Result<()>;

    #[zbus(property)]
    fn device(&self) -> zbus::Result<Vec<u8>>;
    #[zbus(property)]
    fn drive(&self) -> zbus::Result<OwnedObjectPath>;
    #[zbus(property, name = "Size")]
    fn size(&self) -> zbus::Result<u64>;
    #[zbus(property, name = "IdType")]
    fn id_type(&self) -> zbus::Result<String>;
    #[zbus(property, name = "IdLabel")]
    fn id_label(&self) -> zbus::Result<String>;
    #[zbus(property, name = "IdUUID")]
    fn id_uuid(&self) -> zbus::Result<String>;
    #[zbus(property, name = "ReadOnly")]
    fn read_only(&self) -> zbus::Result<bool>;
    #[zbus(property, name = "HintSystem")]
    fn hint_system(&self) -> zbus::Result<bool>;
}

#[zbus::proxy(
    interface = "org.freedesktop.UDisks2.Drive",
    default_service = "org.freedesktop.UDisks2"
)]
pub(crate) trait Drive {
    #[zbus(property)]
    fn model(&self) -> zbus::Result<String>;
    #[zbus(property)]
    fn vendor(&self) -> zbus::Result<String>;
    #[zbus(property)]
    fn removable(&self) -> zbus::Result<bool>;
    #[zbus(property, name = "ConnectionBus")]
    fn connection_bus(&self) -> zbus::Result<String>;
    #[zbus(property, name = "Size")]
    fn size(&self) -> zbus::Result<u64>;
    #[zbus(property, name = "Serial")]
    fn serial(&self) -> zbus::Result<String>;
    #[zbus(property, name = "Revision")]
    fn revision(&self) -> zbus::Result<String>;
    #[zbus(property, name = "WWN")]
    fn wwn(&self) -> zbus::Result<String>;
    #[zbus(property, name = "RotationRate")]
    fn rotation_rate(&self) -> zbus::Result<i32>;
    #[zbus(property, name = "Ejectable")]
    fn ejectable(&self) -> zbus::Result<bool>;
    #[zbus(property, name = "CanPowerOff")]
    fn can_power_off(&self) -> zbus::Result<bool>;
}

/// ATA S.M.A.R.T. interface — only present on drives that expose SMART data
/// (most USB sticks / SD cards do not). Used for lifetime/health info.
#[zbus::proxy(
    interface = "org.freedesktop.UDisks2.Drive.Ata",
    default_service = "org.freedesktop.UDisks2"
)]
pub(crate) trait DriveAta {
    #[zbus(property, name = "SmartPowerOnSeconds")]
    fn smart_power_on_seconds(&self) -> zbus::Result<u64>;
    #[zbus(property, name = "SmartTemperature")]
    fn smart_temperature(&self) -> zbus::Result<f64>;
    #[zbus(property, name = "SmartFailing")]
    fn smart_failing(&self) -> zbus::Result<bool>;
}

#[zbus::proxy(
    interface = "org.freedesktop.UDisks2.Filesystem",
    default_service = "org.freedesktop.UDisks2"
)]
pub(crate) trait Filesystem {
    #[zbus(property, name = "MountPoints")]
    fn mount_points(&self) -> zbus::Result<Vec<Vec<u8>>>;

    /// Mount the filesystem, returning the mount path. Used transiently when
    /// we need to touch the filesystem root ourselves (e.g. to `chmod` it)
    /// rather than relying solely on udisks2's own `take-ownership` chown.
    fn mount(
        &self,
        options: HashMap<&str, zbus::zvariant::Value<'_>>,
    ) -> zbus::Result<String>;

    fn unmount(&self, options: HashMap<&str, zbus::zvariant::Value<'_>>) -> zbus::Result<()>;
}

/// Present on a whole-disk block device that has a partition table (MBR/GPT).
/// Most vendor-formatted USB sticks/SD cards are partitioned rather than
/// carrying a filesystem directly, so the real filesystem/label/UUID/mount
/// info lives on the first partition, not the whole-disk Block.
#[zbus::proxy(
    interface = "org.freedesktop.UDisks2.PartitionTable",
    default_service = "org.freedesktop.UDisks2"
)]
pub(crate) trait PartitionTable {
    #[zbus(property, name = "Partitions")]
    fn partitions(&self) -> zbus::Result<Vec<OwnedObjectPath>>;

    /// Create a new partition spanning `[offset, offset + size)` bytes,
    /// left unformatted. Passing `size: 0` tells udisks2 to use all
    /// remaining space after `offset` — used to create a single partition
    /// spanning the whole disk. `type_` is the partition type GUID/code; an
    /// empty string lets udisks2 pick a sensible default. Returns the object
    /// path of the new partition.
    fn create_partition(
        &self,
        offset: u64,
        size: u64,
        type_: &str,
        name: &str,
        options: HashMap<&str, zbus::zvariant::Value<'_>>,
    ) -> zbus::Result<OwnedObjectPath>;

    /// Create a new partition spanning `[offset, offset + size)` bytes and
    /// immediately format it with `format_type`. Passing `size: 0` tells
    /// udisks2 to use all remaining space after `offset` — used to create a
    /// single partition spanning the whole disk. `type_` is the partition
    /// type GUID/code; an empty string lets udisks2 pick a sensible default
    /// for `format_type`. Returns the object path of the new partition.
    fn create_partition_and_format(
        &self,
        offset: u64,
        size: u64,
        type_: &str,
        name: &str,
        options: HashMap<&str, zbus::zvariant::Value<'_>>,
        format_type: &str,
        format_options: HashMap<&str, zbus::zvariant::Value<'_>>,
    ) -> zbus::Result<OwnedObjectPath>;
}

/// Present on a LUKS container block device. Points at the unlocked
/// ("cleartext") mapper device holding the real filesystem, if unlocked.
#[zbus::proxy(
    interface = "org.freedesktop.UDisks2.Encrypted",
    default_service = "org.freedesktop.UDisks2"
)]
pub(crate) trait Encrypted {
    #[zbus(property, name = "CleartextDevice")]
    fn cleartext_device(&self) -> zbus::Result<OwnedObjectPath>;
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    /// D-Bus object path of the whole-disk Block — the format target.
    pub object_path: String,
    /// e.g. `/dev/sdb`
    pub device: String,
    pub model: String,
    pub vendor: String,
    /// Total size in bytes.
    pub size: u64,
    pub removable: bool,
    /// Physical bus: `usb`, `sdio`, ...
    pub connection_bus: String,
    /// Current filesystem type — from the whole device if it carries one
    /// directly, otherwise from its first partition (common for vendor-
    /// formatted USB sticks/SD cards with an MBR/GPT partition table).
    /// Empty if neither has a filesystem.
    pub current_fs: String,
    pub current_label: String,
    /// Mount points of the effective filesystem (see `current_fs`), if mounted.
    pub mount_points: Vec<String>,
    /// UUID of the effective filesystem/LUKS container (see `current_fs`).
    pub uuid: String,
    /// When `current_fs` is a LUKS container and it's unlocked: the real
    /// filesystem type inside (e.g. `ext4`), empty otherwise/if locked.
    pub cleartext_fs: String,
    /// Label of the unlocked filesystem inside a LUKS container.
    pub cleartext_label: String,
    /// Mount points of the unlocked filesystem inside a LUKS container.
    pub cleartext_mount_points: Vec<String>,
    /// UUID of the unlocked filesystem inside a LUKS container, empty if
    /// locked or not encrypted.
    pub cleartext_uuid: String,
    pub read_only: bool,
    /// Drive serial number (manufacturer-assigned), if reported.
    pub serial: String,
    /// Firmware / revision string, if reported.
    pub revision: String,
    /// World Wide Name identifier, if reported.
    pub wwn: String,
    /// Rotation rate: 0 = non-rotating (flash/SSD), >0 = spinning RPM,
    /// -1 = unknown.
    pub rotation_rate: i32,
    pub ejectable: bool,
    pub can_power_off: bool,
    /// Powered-on lifetime in hours, from SMART (None if unavailable).
    pub power_on_hours: Option<u64>,
    /// Current temperature in °C, from SMART (None if unavailable).
    pub temperature_c: Option<f64>,
    /// Overall SMART health self-assessment (`true` = failing), from SMART
    /// (None if unavailable).
    pub smart_failing: Option<bool>,
}

/// Connect to the system bus where udisks2 lives.
pub async fn connect() -> zbus::Result<Connection> {
    Connection::system().await
}

/// udisks2 stores paths/labels as NUL-terminated byte strings.
fn bytes_to_string(mut b: Vec<u8>) -> String {
    if let Some(pos) = b.iter().position(|&c| c == 0) {
        b.truncate(pos);
    }
    String::from_utf8_lossy(&b).trim().to_string()
}

/// Whether a udisks2-reported filesystem/usage id is a LUKS-encrypted container.
fn is_luks_encrypted(fs: &str) -> bool {
    fs.eq_ignore_ascii_case("crypto_luks")
}

/// Resolve the cleartext (unlocked) mapper device behind a LUKS container at
/// `path`, returning its filesystem type, label, mount points, and UUID.
/// Returns `None` if the container is locked (no cleartext device) or on
/// D-Bus error.
async fn resolve_cleartext(
    conn: &Connection,
    path: &str,
) -> Option<(String, String, Vec<String>, String)> {
    let encrypted = EncryptedProxy::builder(conn).path(path).ok()?.build().await.ok()?;
    let cleartext_path = encrypted.cleartext_device().await.ok()?;
    let cp = cleartext_path.as_str();
    if cp.is_empty() || cp == "/" {
        return None;
    }

    let cleartext_block = BlockProxy::builder(conn).path(cp).ok()?.build().await.ok()?;
    let fs = cleartext_block.id_type().await.unwrap_or_default();
    let label = cleartext_block.id_label().await.unwrap_or_default();
    let uuid = cleartext_block.id_uuid().await.unwrap_or_default();
    let mount_points = match FilesystemProxy::builder(conn).path(cp).ok()?.build().await {
        Ok(fs_proxy) => fs_proxy
            .mount_points()
            .await
            .unwrap_or_default()
            .into_iter()
            .map(bytes_to_string)
            .collect(),
        Err(_) => Vec::new(),
    };

    Some((fs, label, mount_points, uuid))
}

/// Resolve the effective filesystem to display for a whole-disk block that
/// has a partition table but no filesystem of its own: scans all partitions
/// and picks the most relevant one's type/label/UUID/read-only flag/mount
/// points and object path. A partitioned USB stick/SD card commonly has more
/// than one partition (e.g. a hybrid ISO image with a small EFI partition
/// alongside the main data partition), and the D-Bus `Partitions` property
/// order is not guaranteed to match partition number — so we don't just take
/// the first entry. Preference: an already-mounted partition, then any
/// partition with a recognized filesystem, then the first partition as a
/// last resort. Returns `None` if there's no partition table, no partitions,
/// or on D-Bus error.
async fn resolve_first_partition(
    conn: &Connection,
    whole_disk_path: &str,
) -> Option<(String, String, String, bool, Vec<String>, String)> {
    let table = PartitionTableProxy::builder(conn)
        .path(whole_disk_path)
        .ok()?
        .build()
        .await
        .ok()?;
    let partitions = table.partitions().await.ok()?;
    if partitions.is_empty() {
        return None;
    }

    let mut fallback: Option<(String, String, String, bool, Vec<String>, String)> = None;
    let mut best_with_fs: Option<(String, String, String, bool, Vec<String>, String)> = None;

    for part_path in &partitions {
        let pp = part_path.as_str();
        let Ok(builder) = BlockProxy::builder(conn).path(pp) else {
            continue;
        };
        let Ok(part_block) = builder.build().await else {
            continue;
        };

        let fs = part_block.id_type().await.unwrap_or_default();
        let label = part_block.id_label().await.unwrap_or_default();
        let uuid = part_block.id_uuid().await.unwrap_or_default();
        let read_only = part_block.read_only().await.unwrap_or_default();
        let mount_points: Vec<String> = match FilesystemProxy::builder(conn).path(pp).ok() {
            Some(builder) => match builder.build().await {
                Ok(fs_proxy) => fs_proxy
                    .mount_points()
                    .await
                    .unwrap_or_default()
                    .into_iter()
                    .map(bytes_to_string)
                    .collect(),
                Err(_) => Vec::new(),
            },
            None => Vec::new(),
        };

        let candidate = (fs.clone(), label, uuid, read_only, mount_points.clone(), pp.to_string());

        if !mount_points.is_empty() {
            return Some(candidate);
        }
        if !fs.is_empty() && best_with_fs.is_none() {
            best_with_fs = Some(candidate.clone());
        }
        if fallback.is_none() {
            fallback = Some(candidate);
        }
    }

    best_with_fs.or(fallback)
}


async fn build_drive_info(
    conn: &Connection,
    path: &OwnedObjectPath,
    ifaces: &HashMap<String, HashMap<String, OwnedValue>>,
) -> Option<DriveInfo> {
    // Only whole disks (has Block, is not a Partition).
    if !ifaces.contains_key(BLOCK_IFACE) || ifaces.contains_key(PARTITION_IFACE) {
        return None;
    }

    let block = BlockProxy::builder(conn)
        .path(path.as_str())
        .ok()?
        .build()
        .await
        .ok()?;

    // Never touch internal/system disks.
    if block.hint_system().await.unwrap_or(false) {
        return None;
    }

    let drive_path = block.drive().await.ok()?;
    let dp = drive_path.as_str();
    if dp.is_empty() || dp == "/" {
        return None;
    }

    let drive = DriveProxy::builder(conn).path(dp).ok()?.build().await.ok()?;

    let removable = drive.removable().await.unwrap_or(false);
    let bus = drive.connection_bus().await.unwrap_or_default();
    // Show only removable-like media.
    if !(removable || bus == "usb" || bus == "sdio") {
        return None;
    }

    let mut current_fs = block.id_type().await.unwrap_or_default();
    let mut current_label = block.id_label().await.unwrap_or_default();
    let mut current_uuid = block.id_uuid().await.unwrap_or_default();
    let mut read_only = block.read_only().await.unwrap_or_default();
    let mut mount_points = if ifaces.contains_key(FILESYSTEM_IFACE) {
        match FilesystemProxy::builder(conn).path(path.as_str()).ok()?.build().await {
            Ok(fs) => fs
                .mount_points()
                .await
                .unwrap_or_default()
                .into_iter()
                .map(bytes_to_string)
                .collect(),
            Err(_) => Vec::new(),
        }
    } else {
        Vec::new()
    };
    // Object path holding the "current" filesystem/LUKS container: the whole
    // disk itself, or a partition when that's the more relevant one to show
    // (see `resolve_first_partition`).
    let mut fs_object_path = path.as_str().to_string();

    if ifaces.contains_key(PARTITION_TABLE_IFACE) {
        if let Some((fs, label, uuid, ro, mps, pp)) =
            resolve_first_partition(conn, path.as_str()).await
        {
            // Hybrid ISO images (and similar) can carry a valid filesystem
            // signature on *both* the whole disk and a partition, but only
            // the partition actually gets mounted by the OS — so prefer the
            // partition whenever it's mounted, even if the whole disk's own
            // `IdType` is non-empty. Otherwise, only fall back to the
            // partition when the whole disk has no filesystem of its own.
            let partition_is_mounted = !mps.is_empty();
            if partition_is_mounted || current_fs.is_empty() {
                current_fs = fs;
                current_label = label;
                current_uuid = uuid;
                read_only = ro;
                mount_points = mps;
                fs_object_path = pp;
            }
        }
    }

    // If this is a LUKS container and it's currently unlocked, resolve the
    // cleartext (mapper) device to report its real filesystem/label/mounts.
    let (cleartext_fs, cleartext_label, cleartext_mount_points, cleartext_uuid) =
        if is_luks_encrypted(&current_fs) {
            resolve_cleartext(conn, &fs_object_path)
                .await
                .unwrap_or_default()
        } else {
            (String::new(), String::new(), Vec::new(), String::new())
        };

    let size = {
        let s = drive.size().await.unwrap_or(0);
        if s > 0 {
            s
        } else {
            block.size().await.unwrap_or(0)
        }
    };

    // SMART / lifetime data — only some drives (rarely USB flash) expose it.
    let (power_on_hours, temperature_c, smart_failing) = match DriveAtaProxy::builder(conn).path(dp).ok() {
        Some(builder) => match builder.build().await {
            Ok(ata) => {
                let hours = ata.smart_power_on_seconds().await.ok().map(|s| s / 3600);
                let temp = ata
                    .smart_temperature()
                    .await
                    .ok()
                    .filter(|k| *k > 0.0)
                    .map(|k| k - 273.15);
                let failing = ata.smart_failing().await.ok();
                (hours, temp, failing)
            }
            Err(_) => (None, None, None),
        },
        None => (None, None, None),
    };

    Some(DriveInfo {
        object_path: path.as_str().to_string(),
        device: bytes_to_string(block.device().await.unwrap_or_default()),
        model: drive.model().await.unwrap_or_default(),
        vendor: drive.vendor().await.unwrap_or_default(),
        size,
        removable,
        connection_bus: bus,
        current_fs,
        current_label,
        mount_points,
        uuid: current_uuid,
        cleartext_fs,
        cleartext_label,
        cleartext_mount_points,
        cleartext_uuid,
        read_only,
        serial: drive.serial().await.unwrap_or_default(),
        revision: drive.revision().await.unwrap_or_default(),
        wwn: drive.wwn().await.unwrap_or_default(),
        rotation_rate: drive.rotation_rate().await.unwrap_or(-1),
        ejectable: drive.ejectable().await.unwrap_or(false),
        can_power_off: drive.can_power_off().await.unwrap_or(false),
        power_on_hours,
        temperature_c,
        smart_failing,
    })
}

/// List removable drives (USB sticks, SD cards, ...). Internal/system disks and
/// partitions are filtered out for safety.
#[tauri::command]
pub async fn list_removable_drives() -> Result<Vec<DriveInfo>, String> {
    let conn = connect()
        .await
        .map_err(|e| format!("Could not connect to the system bus: {e}"))?;

    let manager = ObjectManagerProxy::new(&conn)
        .await
        .map_err(|e| format!("udisks2 is not available: {e}"))?;

    let objects = manager
        .get_managed_objects()
        .await
        .map_err(|e| format!("Failed to query udisks2: {e}"))?;

    let mut drives = Vec::new();
    for (path, ifaces) in &objects {
        if let Some(info) = build_drive_info(&conn, path, ifaces).await {
            drives.push(info);
        }
    }

    drives.sort_by(|a, b| a.device.cmp(&b.device));
    Ok(drives)
}
