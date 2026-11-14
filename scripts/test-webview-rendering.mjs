import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");

async function loadProgressBatcher() {
  const source = read("src/utils/progressBatcher.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`
  );
}

test("progress batcher flushes every task at most once per interval", async () => {
  const { createProgressBatcher } = await loadProgressBatcher();
  let scheduled;
  let nextTimerId = 1;
  const flushes = [];
  const batcher = createProgressBatcher({
    intervalMs: 250,
    onFlush: (events) => flushes.push(events),
    setTimeout: (callback, delay) => {
      scheduled = { callback, delay, id: nextTimerId++ };
      return scheduled.id;
    },
    clearTimeout: () => undefined,
  });

  batcher.enqueue("task-a", { bytes: 10 });
  batcher.enqueue("task-b", { bytes: 20 });
  batcher.enqueue("task-a", { bytes: 30 });

  assert.equal(scheduled.delay, 250);
  assert.deepEqual(flushes, []);

  scheduled.callback();
  assert.deepEqual(flushes, [
    [
      ["task-a", { bytes: 30 }],
      ["task-b", { bytes: 20 }],
    ],
  ]);
});

test("app shell delegates high-frequency task state and destroys hidden tabs", () => {
  const appSource = read("src/App.tsx");
  const taskTabsSource = read("src/components/TaskTabs.tsx");
  const downloadListSource = read("src/components/DownloadList.tsx");

  assert.doesNotMatch(appSource, /useDownloads|useLiveRecords/);
  assert.match(appSource, /<TaskTabs/);
  assert.match(taskTabsSource, /destroyOnHidden/);
  assert.match(downloadListSource, /const dateTimeFormatters = new Map/);
  assert.match(downloadListSource, /shouldCellUpdate/);
});
