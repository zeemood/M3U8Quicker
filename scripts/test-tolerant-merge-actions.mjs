import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");
const asModule = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

const source = ts.transpileModule(read("src/utils/tolerantMerge.ts"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
}).outputText;
const { canMergeWithFailedSegments } = await import(asModule(source));

const task = (overrides = {}) => ({
  file_type: "hls",
  hls_output_mode: "single_stream",
  status: "Paused",
  is_live: false,
  total_segments: 100,
  completed_segments: 97,
  failed_segment_count: 3,
  ...overrides,
});

test("tolerant merge is available for paused or failed single-stream HLS", () => {
  assert.equal(canMergeWithFailedSegments(task(), 30), true);
  assert.equal(canMergeWithFailedSegments(task({ status: { Failed: "error" } }), 30), true);
});

test("tolerant merge can stop an active download and use existing segments", () => {
  assert.equal(canMergeWithFailedSegments(task({ status: "Downloading" }), 30), true);
});

test("tolerant merge respects the configured failed segment limit", () => {
  assert.equal(canMergeWithFailedSegments(task({ failed_segment_count: 31 }), 30), false);
  assert.equal(canMergeWithFailedSegments(task(), 0), false);
  assert.equal(canMergeWithFailedSegments(task(), 3), true);
});

test("tolerant merge allows partially downloaded tasks with existing segments", () => {
  assert.equal(
    canMergeWithFailedSegments(
      task({ completed_segments: 90, failed_segment_count: 3 }),
      30
    ),
    true
  );
  assert.equal(
    canMergeWithFailedSegments(task({ completed_segments: 0 }), 30),
    false
  );
});

test("tolerant merge excludes live, DASH, multi-track and unsupported statuses", () => {
  assert.equal(canMergeWithFailedSegments(task({ is_live: true }), 30), false);
  assert.equal(canMergeWithFailedSegments(task({ file_type: "dash" }), 30), false);
  assert.equal(
    canMergeWithFailedSegments(
      task({ hls_output_mode: "multi_track_bundle" }),
      30
    ),
    false
  );
  for (const status of ["Pending", "Merging", "Converting", "Cancelled", "Completed"]) {
    assert.equal(canMergeWithFailedSegments(task({ status }), 30), false, status);
  }
});
