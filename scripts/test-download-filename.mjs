import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const asModule = (value) =>
  `data:text/javascript;base64,${Buffer.from(value).toString("base64")}`;
const typesSource = fs.readFileSync("src/types/index.ts", "utf8");
const typesModule = ts.transpileModule(typesSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
    verbatimModuleSyntax: true,
  },
}).outputText;
const typesModuleUrl = asModule(typesModule);
const extensionSource = fs.readFileSync(
  "src/extensions/develop/filenameCleanup.ts",
  "utf8"
);
const extensionModule = ts.transpileModule(extensionSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
    verbatimModuleSyntax: true,
  },
}).outputText.replace(
  /from ['"]\.\.\/\.\.\/types['"]/g,
  `from ${JSON.stringify(typesModuleUrl)}`
);
const { resolveInitialDownloadFilename } = await import(
  asModule(extensionModule)
);

test("extension-provided title wins over URL-derived filename", () => {
  assert.equal(
    resolveInitialDownloadFilename(
      "Browser video title",
      "https://example.com/path/video.m3u8",
      []
    ),
    "Browser video title"
  );
});

test("extension-provided title still applies filename cleanup rules", () => {
  assert.equal(
    resolveInitialDownloadFilename(
      "SITE-Browser video title",
      "https://example.com/path/video.m3u8",
      [
        {
          id: "cleanup",
          enabled: true,
          scope: "global",
          site: "",
          match_type: "contains",
          pattern: "SITE-",
          replacement: "",
          case_sensitive: true,
        },
      ]
    ),
    "Browser video title"
  );
});

test("URL-derived filename is cleaned when no title was provided", () => {
  assert.equal(
    resolveInitialDownloadFilename(
      undefined,
      "https://example.com/path/SITE-video.m3u8",
      [
        {
          id: "cleanup",
          enabled: true,
          scope: "global",
          site: "",
          match_type: "contains",
          pattern: "SITE-",
          replacement: "",
          case_sensitive: true,
        },
      ]
    ),
    "video"
  );
});

test("blank title falls back to URL-derived filename", () => {
  assert.equal(
    resolveInitialDownloadFilename(
      "   ",
      "https://example.com/path/video.m3u8",
      []
    ),
    "video"
  );
});
