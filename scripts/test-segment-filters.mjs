import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");
const asModule = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

const source = ts.transpileModule(read("src/utils/segmentFilters.ts"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
}).outputText;
const {
  countSegmentStatuses,
  getVisibleSegmentNumbers,
} = await import(asModule(source));

const segmentState = {
  total_segments: 6,
  completed_segment_indices: [1, 2, 4],
  failed_segment_indices: [2, 3],
};

test("segment status counts follow the grid status precedence", () => {
  assert.deepEqual(countSegmentStatuses(segmentState), {
    completed: 3,
    failed: 1,
    incomplete: 2,
  });
});

test("segment filtering returns only the selected status", () => {
  assert.deepEqual(getVisibleSegmentNumbers(segmentState, "completed"), [1, 2, 4]);
  assert.deepEqual(getVisibleSegmentNumbers(segmentState, "failed"), [3]);
  assert.deepEqual(getVisibleSegmentNumbers(segmentState, "incomplete"), [5, 6]);
});

test("no status filter keeps every segment visible", () => {
  assert.deepEqual(getVisibleSegmentNumbers(segmentState, null), [1, 2, 3, 4, 5, 6]);
});
