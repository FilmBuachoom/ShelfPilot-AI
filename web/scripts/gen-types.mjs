import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const schemasDir = new URL("../../schemas/", import.meta.url);
const outputDir = new URL("../types/generated/", import.meta.url);
const common = JSON.parse(await readFile(new URL("common.schema.json", schemasDir), "utf8"));

// Compile the data files together so shared references produce a single type.
const properties = Object.fromEntries(
  ["catalog", "user_shelf", "review_queue", "store_clicks"].map((name) => [
    `${name}.json`,
    { $ref: `${name}.schema.json` },
  ]),
);
const definitions = Object.fromEntries(
  Object.keys(common.$defs).map((name) => [
    name,
    { $ref: `common.schema.json#/$defs/${name}` },
  ]),
);
const types = await compile(
  { type: "object", properties, required: Object.keys(properties), additionalProperties: false, definitions },
  "DataFiles",
  {
    cwd: fileURLToPath(schemasDir),
    unreachableDefinitions: true,
    bannerComment: "// Generated from schemas/ by npm run gen:types. Do not edit.",
  },
);

await mkdir(outputDir, { recursive: true });
await writeFile(new URL("index.ts", outputDir), types);
