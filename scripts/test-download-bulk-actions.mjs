import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");
const asModule = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

const source = ts.transpileModule(read("src/utils/downloadBulkActions.ts"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
}).outputText;
const { selectBulkDownloadIds } = await import(asModule(source));

const task = (id, status, is_live = false) => ({
  id,
  status,
  is_live,
});

test("pause all selects only video downloads that are currently downloading", () => {
  const tasks = [
    task("downloading-1", "Downloading"),
    task("paused", "Paused"),
    task("pending", "Pending"),
    task("merging", "Merging"),
    task("converting", "Converting"),
    task("live", "Downloading", true),
  ];

  assert.deepEqual(selectBulkDownloadIds(tasks, "pause"), ["downloading-1"]);
});

test("start all selects only paused video downloads", () => {
  const tasks = [
    task("paused-1", "Paused"),
    task("paused-2", "Paused", true),
    task("downloading", "Downloading"),
    task("pending", "Pending"),
  ];

  assert.deepEqual(selectBulkDownloadIds(tasks, "resume"), ["paused-1"]);
});

test("bulk selection ignores unspecified task kinds", () => {
  const tasks = [
    { id: "no-status", is_live: false },
    { id: "unknown-status", status: "Unknown", is_live: false },
  ];

  assert.deepEqual(selectBulkDownloadIds(tasks, "pause"), []);
  assert.deepEqual(selectBulkDownloadIds(tasks, "resume"), []);
});
