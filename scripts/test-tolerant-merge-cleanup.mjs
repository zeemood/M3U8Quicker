import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src-tauri/src/commands.rs", "utf8");

test("successful tolerant merge uses the normal completed temp cleanup", () => {
  const commandStart = source.indexOf(
    "pub async fn merge_download_with_failed_segments"
  );
  const helperStart = source.indexOf(
    "fn should_remove_download_from_runtime",
    commandStart
  );
  assert.notEqual(commandStart, -1, "tolerant merge command not found");
  assert.notEqual(helperStart, -1, "tolerant merge command end not found");

  const command = source.slice(commandStart, helperStart);
  assert.ok(
    command.includes("maybe_cleanup_completed_temp_dir(&app_handle, &state, &id).await"),
    "tolerant merge must reuse the normal completed temp cleanup"
  );
});
