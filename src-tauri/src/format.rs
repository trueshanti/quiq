// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
//! Formatting logic. Delegates the actual filesystem creation to udisks2's
//! `Block.Format` method, which handles unmounting, privilege escalation
//! (polkit) and running the correct `mkfs.*` tool.

use std::collections::HashMap;

use serde::Serialize;
use zbus::zvariant::Value;

use crate::udisks::{connect, BlockProxy};

/// A filesystem the user can pick in the UI. `id` is the string udisks2 expects.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilesystemOption {
    pub id: String,
    pub label: String,
    pub description: String,
    /// Whether the new filesystem root should be chown'd to the user.
    pub native_ownership: bool,
}

fn fsopt(id: &str, label: &str, description: &str, native_ownership: bool) -> FilesystemOption {
    FilesystemOption {
        id: id.to_string(),
        label: label.to_string(),
        description: description.to_string(),
        native_ownership,
    }
}

/// Filesystems udisks2 can create, given the matching `mkfs.*` tools are
/// installed on the system.
pub(crate) const SUPPORTED: &[&str] = &["ext4", "xfs", "vfat", "exfat"];

/// Native Unix filesystems where we take ownership so the user can write freely.
pub(crate) const NATIVE_OWNERSHIP: &[&str] = &["ext4", "xfs"];

#[tauri::command]
pub fn list_supported_filesystems() -> Vec<FilesystemOption> {
    vec![
        fsopt(
            "exfat",
            "exFAT",
            "Universal, no 4 GB file limit. Ideal for large USB sticks.",
            false,
        ),
        fsopt(
            "vfat",
            "FAT32",
            "Reads everywhere: Windows, macOS, Linux. Max 4 GB per file.",
            false,
        ),
        fsopt("xfs", "XFS", "High-performance Linux filesystem for large files.", true),
        fsopt("ext4", "ext4", "Modern Linux default. Best for Linux-only drives.", true),
    ]
}

/// Format the whole device at `object_path` with `fs_type`.
///
/// - `full`: when true, zero the entire device first (slow) instead of a quick
///   metadata-only format.
/// - `encrypt`: when true, wrap the filesystem in a LUKS2 container using
///   `passphrase`. udisks2 creates the LUKS device, unlocks it and then
///   creates `fs_type` on the cleartext device in a single call.
///
/// This triggers a polkit password prompt. A long full-erase blocks until the
/// operation completes.
#[tauri::command]
pub async fn format_drive(
    object_path: String,
    fs_type: String,
    label: String,
    full: bool,
    encrypt: bool,
    passphrase: String,
) -> Result<(), String> {
    if !SUPPORTED.contains(&fs_type.as_str()) {
        return Err(format!("Unsupported filesystem type: {fs_type}"));
    }
    if encrypt && passphrase.trim().is_empty() {
        return Err("A passphrase is required to encrypt the drive".to_string());
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

    let label = label.trim();
    let mut options: HashMap<&str, Value> = HashMap::new();
    // Unmount and remove existing partitions/holders before formatting.
    options.insert("tear-down", Value::from(true));
    if !label.is_empty() {
        options.insert("label", Value::from(label));
    }
    if NATIVE_OWNERSHIP.contains(&fs_type.as_str()) {
        options.insert("take-ownership", Value::from(true));
    }
    if full {
        options.insert("erase", Value::from("zero"));
    }
    if encrypt {
        options.insert("encrypt.passphrase", Value::from(passphrase.as_str()));
        options.insert("encrypt.type", Value::from("luks2"));
    }

    block
        .format(&fs_type, options)
        .await
        .map_err(|e| format!("Format failed: {e}"))?;

    Ok(())
}
