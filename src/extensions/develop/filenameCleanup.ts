import type { FilenameCleanupRule } from "../../types/settings";
import { deriveFilenameFromUrl, normalizeDownloadFilename } from "../../types";

export interface FilenameCleanupResult {
  filename: string;
  matched: boolean;
}

export interface FilenameCleanupRegexCaptureGroup {
  index: number;
  value: string;
}

export function applyFilenameCleanupRulesWithMatch(
  name: string,
  rules: FilenameCleanupRule[],
  sourceUrl?: string
): FilenameCleanupResult {
  let result = name;
  let matched = false;
  const sourceSite = filenameCleanupSourceSite(sourceUrl ?? "");

  for (const rule of rules) {
    const pattern = rule.pattern.trim();
    if (!rule.enabled || !pattern) {
      continue;
    }
    if (!filenameCleanupRuleMatchesSource(rule, sourceSite)) {
      continue;
    }

    if (rule.match_type === "regex") {
      try {
        const testExpression = new RegExp(
          pattern,
          rule.case_sensitive ? "" : "i"
        );
        const expression = new RegExp(
          pattern,
          rule.case_sensitive ? "g" : "gi"
        );
        matched ||= testExpression.test(result);
        result = result.replace(expression, rule.replacement);
      } catch {
        // Invalid patterns are rejected before saving and ignored defensively here.
      }
      continue;
    }

    if (rule.match_type === "suffix") {
      const lowerResult = result.toLowerCase();
      const lowerPattern = pattern.toLowerCase();
      if (
        rule.case_sensitive
          ? result.endsWith(pattern)
          : lowerResult.endsWith(lowerPattern)
      ) {
        matched = true;
        result = result.slice(0, result.length - pattern.length) + rule.replacement;
      }
      continue;
    }

    for (const variant of filenameCleanupContainsPatternVariants(pattern)) {
      const testExpression = new RegExp(
        escapeRegExp(variant),
        rule.case_sensitive ? "" : "i"
      );
      if (!testExpression.test(result)) {
        continue;
      }
      matched = true;
      result = result.replace(
        new RegExp(
          escapeRegExp(variant),
          rule.case_sensitive ? "g" : "gi"
        ),
        () => rule.replacement
      );
    }
  }

  return {
    filename: normalizeDownloadFilename(result),
    matched,
  };
}

export function getFilenameCleanupRegexCaptureGroups(
  name: string,
  rule: FilenameCleanupRule,
  sourceUrl?: string
): FilenameCleanupRegexCaptureGroup[] {
  if (
    !rule.enabled ||
    rule.match_type !== "regex" ||
    !rule.pattern.trim() ||
    !filenameCleanupRuleMatchesSource(
      rule,
      filenameCleanupSourceSite(sourceUrl ?? "")
    )
  ) {
    return [];
  }

  try {
    const match = new RegExp(
      rule.pattern.trim(),
      rule.case_sensitive ? "" : "i"
    ).exec(name);
    if (!match) {
      return [];
    }
    return match.slice(1).map((value, index) => ({
      index: index + 1,
      value: value ?? "",
    }));
  } catch {
    return [];
  }
}

export function applyFilenameCleanupRules(
  name: string,
  rules: FilenameCleanupRule[],
  sourceUrl?: string
): string {
  return applyFilenameCleanupRulesWithMatch(name, rules, sourceUrl).filename;
}

export function cleanDownloadUrlAfterFilenameCleanup(
  url: string,
  rules: FilenameCleanupRule[],
  sourceUrl?: string
): string {
  const cleanupSourceUrl = sourceUrl?.trim() || url;
  const result = applyFilenameCleanupRulesWithMatch(
    deriveFilenameFromUrl(url),
    rules,
    cleanupSourceUrl
  );
  return result.matched ? removeTitleQueryParameter(url) : url;
}

export function resolveInitialDownloadFilename(
  initialFilename: string | undefined,
  initialUrl: string | undefined,
  rules: FilenameCleanupRule[],
  extraHeaders?: string
): string | undefined {
  const providedFilename = initialFilename?.trim();
  const url = initialUrl?.trim();
  const sourceFilename = providedFilename || (url ? deriveFilenameFromUrl(url) : "");
  if (!sourceFilename) {
    return undefined;
  }

  return (
    applyFilenameCleanupRules(
      sourceFilename,
      rules,
      url ? resolveFilenameCleanupSourceUrl(url, extraHeaders) : undefined
    ) || undefined
  );
}

export function resolveFilenameCleanupSourceUrl(
  url: string,
  extraHeaders?: string
): string {
  const headers = new Map<string, string>();
  for (const line of (extraHeaders ?? "").split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = normalizeCleanupHeaderValue(
      line.slice(separator + 1)
    );
    if (name && value) {
      headers.set(name, value);
    }
  }
  return headers.get("referer") || headers.get("origin") || url;
}

export function removeTitleQueryParameter(url: string): string {
  try {
    const parsed = new URL(url.trim());
    let removed = false;
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (key.toLowerCase() === "title") {
        parsed.searchParams.delete(key);
        removed = true;
      }
    }
    return removed ? parsed.toString() : url;
  } catch {
    return url;
  }
}

export type FilenameCleanupValidationIssue =
  | "pattern"
  | "site"
  | "regex"
  | null;

export function validateFilenameCleanupRule(
  rule: FilenameCleanupRule
): FilenameCleanupValidationIssue {
  if (!rule.enabled) {
    return null;
  }
  const pattern = rule.pattern.trim();
  if (!pattern) {
    return "pattern";
  }
  if (rule.scope === "site" && !normalizeFilenameCleanupSite(rule.site ?? "")) {
    return "site";
  }
  if (rule.match_type === "regex") {
    try {
      new RegExp(pattern, rule.case_sensitive ? "g" : "gi");
    } catch {
      return "regex";
    }
  }
  return null;
}

export function normalizeFilenameCleanupSite(value: string): string {
  const trimmed = normalizeCleanupHeaderValue(value);
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    return normalizeHostname(parsed.hostname);
  } catch {
    const hostname = trimmed.split(/[/?#]/, 1)[0]?.split(":", 1)[0] ?? "";
    return normalizeHostname(hostname);
  }
}

export function filenameCleanupSourceSite(sourceUrl: string): string {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const key of ["base_url", "url"]) {
        const value = parsed[key];
        if (typeof value === "string") {
          const site = filenameCleanupSourceSite(value);
          if (site) {
            return site;
          }
        }
      }
    } catch {
      return "";
    }
    return "";
  }

  try {
    return normalizeHostname(new URL(trimmed).hostname);
  } catch {
    return normalizeFilenameCleanupSite(trimmed);
  }
}

function normalizeHostname(value: string): string {
  return value
    .trim()
    .replace(/^\*\./, "")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^www\./, "")
    .toLowerCase();
}

function normalizeCleanupHeaderValue(value: string): string {
  return value
    .trim()
    .replace(/\\:/g, ":")
    .replace(/\\+$/g, "")
    .trim();
}

function filenameCleanupContainsPatternVariants(pattern: string): string[] {
  const variants = new Set([pattern]);
  if (pattern.includes(" | ")) {
    variants.add(pattern.replace(/ \| /g, " _ "));
  }
  if (pattern.includes(" _ ")) {
    variants.add(pattern.replace(/ _ /g, " | "));
  }
  return [...variants];
}

function filenameCleanupHostMatches(host: string, site: string): boolean {
  return Boolean(host) && host === site;
}

function filenameCleanupRuleMatchesSource(
  rule: FilenameCleanupRule,
  sourceSite: string
): boolean {
  if (rule.scope !== "site") {
    return true;
  }
  const site = normalizeFilenameCleanupSite(rule.site ?? "");
  return Boolean(site) && filenameCleanupHostMatches(sourceSite, site);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
