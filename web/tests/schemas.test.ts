import { readFile, readdir } from "node:fs/promises";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { expect, test } from "vitest";

const schemasDir = new URL("../../schemas/", import.meta.url);
const dataDir = new URL("../../data/", import.meta.url);
const ajv = addFormats(new Ajv({ allErrors: true }));

for (const file of (await readdir(schemasDir)).filter((name) => name.endsWith(".schema.json"))) {
  ajv.addSchema(JSON.parse(await readFile(new URL(file, schemasDir), "utf8")));
}

const dataFiles = (await readdir(dataDir)).filter((name) => name.endsWith(".json")).sort();

test.each(dataFiles)("%s validates against its schema", async (file) => {
  const schemaId = file.replace(/\.json$/, ".schema.json");
  const data = JSON.parse(await readFile(new URL(file, dataDir), "utf8"));
  const valid = ajv.validate(schemaId, data);

  expect(valid, ajv.errorsText()).toBe(true);
});
