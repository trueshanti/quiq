#!/usr/bin/env node
// Rename Tauri's AppImage output to AppImageHub's Name-Version-Arch.AppImage convention.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundleDir = join(repoRoot, "src-tauri/target/release/bundle/appimage");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const name = pkg.name;
const version = pkg.version;

// Tauri v2 hardcodes {productName}_{version}_{arch}.AppImage with arch "amd64" on x86_64.
const archMap = { amd64: "x86_64", arm64: "aarch64" };

const oldFile = readdirSync(bundleDir).find(
  (f) => f.startsWith(`${name}_${version}_`) && f.endsWith(".AppImage")
);
if (!oldFile) {
  console.log(`rename-appimage: no ${name}_${version}_*.AppImage found in ${bundleDir}, skipping`);
  process.exit(0);
}

const oldArch = oldFile.slice(`${name}_${version}_`.length, -".AppImage".length);
const newArch = archMap[oldArch] ?? oldArch;
const newFile = `${name}-${version}-${newArch}.AppImage`;

if (oldFile === newFile) {
  console.log(`rename-appimage: ${oldFile} already matches convention`);
  process.exit(0);
}

renameSync(join(bundleDir, oldFile), join(bundleDir, newFile));
console.log(`rename-appimage: ${oldFile} -> ${newFile}`);

const oldZsync = `${oldFile}.zsync`;
if (existsSync(join(bundleDir, oldZsync))) {
  rmSync(join(bundleDir, oldZsync));
  try {
    execFileSync("zsyncmake", ["-u", newFile, newFile], { cwd: bundleDir, stdio: "inherit" });
    console.log(`rename-appimage: regenerated ${newFile}.zsync`);
  } catch {
    console.warn("rename-appimage: zsyncmake not found, skipped regenerating .zsync sidecar");
  }
}
