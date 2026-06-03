'use strict';
/**
 * Real Anime Reviews — shared Excel backup + lock helpers
 * ============================================================================
 * Extracted from scripts/mode1-server.js (v1.7.0) so both the Mode 1 server
 * and the AniList backfill CLI use one source of truth for:
 *   - backing up the canonical Excel before any write (git can't roll it back —
 *     it lives outside the repo in ../Master List/)
 *   - detecting the Excel desktop-app lock file (~$...) before a write throws
 *     a raw EBUSY mid-flight
 *
 * Both functions take the Excel path explicitly so the module stays pure and
 * the caller owns path resolution.
 * ============================================================================
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

// Backup Excel before modifying. Writes ../Master List/<name>.bak.<ts>.xlsx,
// alongside the source and OUTSIDE the deploy root, so backups never deploy.
async function backupExcel(excelPath) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = excelPath.replace(/\.xlsx$/, `.bak.${ts}.xlsx`);
  await fsp.copyFile(excelPath, backupPath);
  return backupPath;
}

// Pre-flight: detect Excel lock file. If the workbook is open in the desktop
// app, any write attempt throws raw EBUSY. Friendly check + clear error first.
function checkExcelLock(excelPath) {
  const dir = path.dirname(excelPath);
  const base = path.basename(excelPath);
  const lockPath = path.join(dir, '~$' + base);
  if (fs.existsSync(lockPath)) {
    throw new Error(`Excel file is currently open in the desktop app (lock file ~$${base} exists). Close ${base} in Excel and try again.`);
  }
}

module.exports = { backupExcel, checkExcelLock };
