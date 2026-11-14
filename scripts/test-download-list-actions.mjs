import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/components/DownloadList.tsx", "utf8");

test("action column rerenders for local confirmation state changes", () => {
  const actionKeyIndex = source.indexOf('key: "actions"');
  assert.notEqual(actionKeyIndex, -1, "actions column not found");

  const renderIndex = source.indexOf("render:", actionKeyIndex);
  assert.notEqual(renderIndex, -1, "actions column renderer not found");

  const actionColumnProperties = source.slice(actionKeyIndex, renderIndex);
  assert.ok(
    !actionColumnProperties.includes("shouldCellUpdate"),
    "actions column must not skip rerenders when Popconfirm state changes"
  );
});

test("progress column rerenders when segment popover data loads", () => {
  const progressKeyIndex = source.indexOf('key: "progress"');
  assert.notEqual(progressKeyIndex, -1, "progress column not found");

  const speedColumnIndex = source.indexOf("...(showSpeed", progressKeyIndex);
  assert.notEqual(speedColumnIndex, -1, "progress column end not found");

  const progressColumnProperties = source.slice(
    progressKeyIndex,
    speedColumnIndex
  );
  assert.ok(
    !progressColumnProperties.includes("shouldCellUpdate"),
    "progress column must not skip rerenders when segment popover data changes"
  );
});
