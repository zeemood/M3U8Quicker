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

test("progress bar keeps a stable width across percentage labels", () => {
  const progressIndex = source.indexOf("<Progress");
  assert.notEqual(progressIndex, -1, "progress component not found");
  const progressSource = source.slice(progressIndex, source.indexOf("/>", progressIndex));
  assert.match(
    progressSource,
    /percent=\{Math\.round\(calculatePercentage\(record\) \* 10\) \/ 10\}/
  );
  assert.doesNotMatch(progressSource, /\bformat=/);
  assert.match(progressSource, /width:\s*42/);
  assert.match(progressSource, /fontVariantNumeric:\s*"tabular-nums"/);
});

test("segment popover opens on click instead of hover", () => {
  const popoverIndex = source.indexOf("<Popover");
  assert.notEqual(popoverIndex, -1, "segment popover not found");
  const popoverSource = source.slice(
    popoverIndex,
    source.indexOf(">", popoverIndex)
  );
  assert.match(popoverSource, /trigger="click"/);
});
