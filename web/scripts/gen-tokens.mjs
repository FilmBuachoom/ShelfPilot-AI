import { mkdir, readFile, writeFile } from "node:fs/promises";

const source = new URL("../../design/shelfpilot-ds/tokens.json", import.meta.url);
const output = new URL("../styles/tokens.css", import.meta.url);
const design = JSON.parse(await readFile(source, "utf8"));
const tokens = ["color", "spacing", "radius", "shadow", "layout"].flatMap((group) => design[group].tokens);
const themed = tokens.filter(({ value }) => typeof value === "object");

function declaration(name, value) {
  return `--${name}: ${value.replace(/\{([\w-]+)\}/g, "var(--$1)")};`;
}

function block(selector, declarations, level = 0) {
  const indent = "  ".repeat(level);
  return [
    `${indent}${selector} {`,
    ...declarations.map((line) => `${indent}  ${line}`),
    `${indent}}`,
  ].join("\n");
}

const light = tokens.map(({ name, value }) => declaration(name, value.light ?? value));
const dark = themed.map(({ name, value }) => declaration(name, value.dark));
const typography = design.type.groups.flatMap(({ styles }) =>
  styles.flatMap(({ name, fontSize, lineHeight, fontWeight }) => [
    declaration(`${name}-size`, fontSize),
    declaration(`${name}-leading`, lineHeight),
    declaration(`${name}-weight`, String(fontWeight)),
  ]),
);
const css = [
  "/* Generated from design/shelfpilot-ds/tokens.json by npm run gen:tokens. */",
  block(":root", [
    "color-scheme: light;",
    declaration("font-sans", "var(--font-inter, \"Inter\"), var(--font-noto-thai, \"Noto Sans Thai\"), system-ui, sans-serif"),
    declaration("font-mono", "var(--font-ibm-plex-mono, \"IBM Plex Mono\"), ui-monospace, monospace"),
    ...light,
    ...typography,
  ]),
  `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', ["color-scheme: dark;", ...dark], 1)}\n}`,
  block('[data-theme="dark"]', ["color-scheme: dark;", ...dark]),
].join("\n\n");

await mkdir(new URL("./", output), { recursive: true });
await writeFile(output, `${css}\n`);
