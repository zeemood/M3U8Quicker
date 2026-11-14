import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const componentUrl = new URL(
  "../src/components/DownloadSegmentGrid.tsx",
  import.meta.url
);

async function loadSegmentGrid() {
  assert.ok(fs.existsSync(componentUrl), "DownloadSegmentGrid component is missing");
  const source = fs.readFileSync(componentUrl, "utf8");
  const filtersUrl = new URL("../src/utils/segmentFilters.ts", import.meta.url);
  const filtersSource = ts.transpileModule(
    fs.readFileSync(filtersUrl, "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2023,
        verbatimModuleSyntax: true,
      },
    }
  ).outputText;
  const filtersModuleUrl = `data:text/javascript;base64,${Buffer.from(
    filtersSource
  ).toString("base64")}`;
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2023,
      verbatimModuleSyntax: true,
    },
  }).outputText;
  const moduleUrls = {
    react: import.meta.resolve("react"),
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
  };
  const moduleSource = transpiled.replace(
    /from "(react\/jsx-runtime|react|\.\.\/utils\/segmentFilters)"/g,
    (_, name) =>
      `from ${JSON.stringify(
        name === "../utils/segmentFilters" ? filtersModuleUrl : moduleUrls[name]
      )}`
  );
  assert.doesNotMatch(moduleSource, /from "\.\.?\//, "Unexpected relative import");
  return import(
    `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`
  );
}

test("segment grid renders every segment beyond the old 400 chip limit", async () => {
  const { DownloadSegmentGrid } = await loadSegmentGrid();
  const totalSegments = 1201;
  const html = renderToStaticMarkup(
    React.createElement(DownloadSegmentGrid, {
      segmentState: {
        id: "test-task",
        total_segments: totalSegments,
        completed_segment_indices: [1, 400, 401, totalSegments],
        failed_segment_indices: [],
        updated_at: "2026-11-14T00:00:00Z",
      },
    })
  );

  assert.equal((html.match(/class="segment-chip /g) ?? []).length, totalSegments);
  assert.match(html, />401</);
  assert.match(html, />1201</);
});

test("segment grid renders only the selected status", async () => {
  const { DownloadSegmentGrid } = await loadSegmentGrid();
  const html = renderToStaticMarkup(
    React.createElement(DownloadSegmentGrid, {
      filterStatus: "failed",
      segmentState: {
        id: "test-task",
        total_segments: 6,
        completed_segment_indices: [1, 2, 4],
        failed_segment_indices: [2, 3],
        updated_at: "2026-11-14T00:00:00Z",
      },
    })
  );

  assert.equal((html.match(/class="segment-chip /g) ?? []).length, 1);
  assert.match(html, />3</);
});
