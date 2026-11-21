import "server-only";

import path from "node:path";

export function dataPath(file: string): string {
  const cwd = process.cwd();
  const root = path.basename(cwd) === "web" ? path.dirname(cwd) : cwd;
  return path.join(process.env.SHELFPILOT_DATA_DIR || path.join(root, "data"), file);
}
