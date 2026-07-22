// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
//! Quick "create partition table" action: wipes the whole disk, lays down a
//! fresh GPT or MBR (legacy BIOS) partition table, and creates a single
//! partition spanning the entire disk. The partition is either left
//! unformatted (`fs_type == "none"`) or formatted with the chosen
//! filesystem. For native Linux filesystems the new filesystem root is
//! chowned to the calling user/group (via udisks2's `take-ownership`) and
//! additionally chmod'd to 0777 so it's freely writable right away.

use std::collections::HashMap;
use std::fs;
use std::os::unix::fs::PermissionsExt;

use zbus::zvariant::Value;

use crate::format::{NATIVE_OWNERSHIP, SUPPORTED};
use crate::udisks::{connect, BlockProxy, FilesystemProxy, PartitionTableProxy};

const PARTITION_TABLE_TYPES: &[&str] = &["gpt", "dos"];

/// Sentinel `fs_type` value meaning "leave the new partition unformatted".
const NO_FILESYSTEM: &str = "none";

/// Create a fresh partition table (`gpt`, or `dos` for legacy MBR/BIOS) on
/// the whole disk at `object_path`, then create one partition spanning the
/// entire disk. Pass `fs_type: "none"` to leave the partition unformatted,
/// otherwise it's formatted as `fs_type`. Triggers a polkit auth prompt like
/// other privileged actions. This unconditionally wipes the device.
#[tauri::command]
pub async fn create_partition_table(
    object_path: String,
    table_type: String,
    fs_type: String,
) -> Result<(), String> {
    if !PARTITION_TABLE_TYPES.contains(&table_type.as_str()) {
        return Err(format!("Unsupported partition table type: {table_type}"));
    }
    let no_fs = fs_type == NO_FILESYSTEM;
    if !no_fs && !SUPPORTED.contains(&fs_type.as_str()) {
        return Err(format!("Unsupported filesystem type: {fs_type}"));
    }

    let conn = connect()
        .await
        .map_err(|e| format!("Could not connect to the system bus: {e}"))?;

    let block = BlockProxy::builder(&conn)
        .path(object_path.as_str())
        .map_err(|e| format!("Invalid device path: {e}"))?
        .build()
        .await
        .map_err(|e| format!("Cannot access the device: {e}"))?;

    // Wipe the device and lay down a fresh, empty partition table.
    let mut table_options: HashMap<&str, Value> = HashMap::new();
    table_options.insert("tear-down", Value::from(true));
    block
        .format(&table_type, table_options)
        .await
        .map_err(|e| format!("Failed to create {table_type} partition table: {e}"))?;

    // The device now exposes PartitionTable; create one partition spanning
    // the whole disk (size 0 = use all remaining space).
    let table = PartitionTableProxy::builder(&conn)
        .path(object_path.as_str())
        .map_err(|e| format!("Invalid device path: {e}"))?
        .build()
        .await
        .map_err(|e| format!("Cannot access the new partition table: {e}"))?;

    if no_fs {
        table
            .create_partition(0, 0, "", "", HashMap::new())
            .await
            .map_err(|e| format!("Failed to create the partition: {e}"))?;
        return Ok(());
    }

    let native = NATIVE_OWNERSHIP.contains(&fs_type.as_str());
    let mut format_options: HashMap<&str, Value> = HashMap::new();
    if native {
        format_options.insert("take-ownership", Value::from(true));
    }

    let partition_path = table
        .create_partition_and_format(0, 0, "", "", HashMap::new(), &fs_type, format_options)
        .await
        .map_err(|e| format!("Failed to create and format the partition: {e}"))?;

    // For native Linux filesystems, also chmod the new filesystem root to
    // 0777: `take-ownership` above only chowns it to the calling user/group,
    // it doesn't relax the mode bits.
    if native {
        let fs_proxy = FilesystemProxy::builder(&conn)
            .path(partition_path.as_str())
            .map_err(|e| format!("Invalid partition path: {e}"))?
            .build()
            .await
            .map_err(|e| format!("Cannot access the new partition: {e}"))?;

        let mount_path = fs_proxy
            .mount(HashMap::new())
            .await
            .map_err(|e| format!("Failed to mount the new partition: {e}"))?;

        let chmod_result = fs::set_permissions(&mount_path, fs::Permissions::from_mode(0o777))
            .map_err(|e| format!("Failed to chmod the new filesystem: {e}"));
        let unmount_result = fs_proxy
            .unmount(HashMap::new())
            .await
            .map_err(|e| format!("Failed to unmount the new partition: {e}"));

        chmod_result?;
        unmount_result?;
    }

    Ok(())
}

