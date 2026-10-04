import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import ts from "typescript";
import en from "../en.json";
import es from "../es.json";

type Messages = Record<string, unknown>;

function flattenKeys(obj: Messages, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? flattenKeys(value as Messages, path)
      : [path];
  });
}

function flattenValues(obj: Messages, prefix = ""): [string, unknown][] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? flattenValues(value as Messages, path)
      : [[path, value]];
  });
}

describe("en/es message parity", () => {
  it("has the exact same key set in both locales", () => {
    const enKeys = flattenKeys(en).sort();
    const esKeys = flattenKeys(es).sort();

    expect(esKeys).toEqual(enKeys);
  });

  it("has a non-empty string value for every key in both locales", () => {
    for (const [locale, messages] of [
      ["en", en],
      ["es", es],
    ] as const) {
      for (const [key, value] of flattenValues(messages)) {
        expect(typeof value, `${locale}:${key} should be a string`).toBe(
          "string",
        );
        expect(
          (value as string).trim().length > 0,
          `${locale}:${key} should not be empty`,
        ).toBe(true);
      }
    }
  });
});

// ─── Hardcoded-string guard ───────────────────────────────────────────────────
//
// After the i18n sweep, every user-facing string in src/components and
// src/app should come from `useTranslations`/`getTranslations`, not a literal
// JSX text node or a literal string passed to a user-facing attribute
// (aria-label, title, placeholder, alt). This walks the real TypeScript AST
// (rather than a regex over source text) so it does not get confused by
// braces, template strings, or comments.

const SRC_ROOT = join(import.meta.dir, "..", "src");
const SCAN_DIRS = ["components", "app"];
const EXCLUDE_PATH_PATTERNS = [
  /[\\/]__tests__[\\/]/,
  /\.test\.tsx?$/,
  /\.css$/,
];

// Attributes whose string literal value is shown to, or announced to, a user.
const USER_FACING_ATTRIBUTES = new Set([
  "aria-label",
  "title",
  "placeholder",
  "alt",
]);

// Short tokens, symbols, and brand names that are intentionally identical in
// every locale (see the PR description for the rationale on each).
const ALLOWED_LITERALS = new Set([
  "LAND",
  "AKKUEA LAND",
  "Akkuea Land",
  "N/A",
  "V",
  "R",
  "C",
  "S",
  "en",
  "es",
]);

function isTranslatableProse(raw: string): boolean {
  const text = raw.trim();
  if (text.length < 3) return false;
  if (ALLOWED_LITERALS.has(text)) return false;
  // Looks like natural-language content: contains a run of lowercase letters
  // (rules out acronyms, unit symbols, and punctuation-only text) and at
  // least one space (rules out single tokens like a CSS class name leaking
  // into text, which would fail for other reasons first).
  return /[a-z]{2,}/.test(text) && /\s/.test(text);
}

function listSourceFiles(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (EXCLUDE_PATH_PATTERNS.some((pattern) => pattern.test(full))) return [];
    return [full];
  });
}

interface Violation {
  file: string;
  line: number;
  snippet: string;
}

function findViolations(filePath: string): Violation[] {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const violations: Violation[] = [];

  const report = (node: ts.Node, text: string) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    violations.push({
      file: relative(process.cwd(), filePath),
      line: line + 1,
      snippet: text.trim().slice(0, 60),
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && isTranslatableProse(node.text)) {
      report(node, node.text);
    }

    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      USER_FACING_ATTRIBUTES.has(node.name.text) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      isTranslatableProse(node.initializer.text)
    ) {
      report(node.initializer, node.initializer.text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

describe("hardcoded user-facing strings", () => {
  it("finds no untranslated prose in src/components or src/app", () => {
    const files = SCAN_DIRS.flatMap((dir) =>
      listSourceFiles(join(SRC_ROOT, dir)),
    );
    const violations = files.flatMap(findViolations);

    if (violations.length > 0) {
      const report = violations
        .map((v) => `${v.file}:${v.line} - "${v.snippet}"`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} hardcoded user-facing string(s). Move these into messages/en.json and messages/es.json:\n${report}`,
      );
    }

    expect(violations).toEqual([]);
  });
});
