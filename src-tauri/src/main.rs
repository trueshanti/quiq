// SPDX-FileCopyrightText: 2026 - shanti@mojo.cc
// SPDX-License-Identifier: GPL-3.0-or-later
// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod format;
mod partition;
mod udisks;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            udisks::list_removable_drives,
            format::list_supported_filesystems,
            format::format_drive,
            partition::create_partition_table,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the quiq application");
}
