import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");

test("develop-only frontend logic stays in extension modules", () => {
  assert.doesNotMatch(
    read("src/types/index.ts"),
    /applyFilenameCleanupRulesWithMatch/
  );
  assert.doesNotMatch(read("src/hooks/useDownloads.ts"), /loadAllActiveDownloads/);
  assert.doesNotMatch(read("src/hooks/useDownloads.ts"), /runWithConcurrency/);
});

test("develop-only backend merge logic stays in extension modules", () => {
  assert.doesNotMatch(
    read("src-tauri/src/commands.rs"),
    /pub async fn merge_download_with_failed_segments/
  );
  assert.doesNotMatch(
    read("src-tauri/src/downloader.rs"),
    /pub\(crate\) fn validate_tolerant_merge_task/
  );
});
