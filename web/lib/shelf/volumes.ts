const MAX_VOLUMES = 100;
const MAX_SPEC_LENGTH = 1024;

export function parseVolumeSpec(input: string): number[] | null {
  if (input.length > MAX_SPEC_LENGTH) return null;

  const normalized = input
    .normalize("NFKC")
    .replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - "๐".charCodeAt(0)))
    .replace(/[–—−]/g, "-");
  const volumes = new Set<number>();

  for (const part of normalized.split(",")) {
    const match = /^(?:เล่ม\s*|vol\.\s*)?(\d+(?:\.\d+)?)(?:\s*-\s*(\d+))?$/i.exec(part.trim());
    if (!match) return null;

    const first = Number(match[1]);
    const last = match[2] === undefined ? first : Number(match[2]);
    if (first > Number.MAX_SAFE_INTEGER || last > Number.MAX_SAFE_INTEGER) return null;
    if (match[2] !== undefined && (!Number.isInteger(first) || last < first || last - first >= MAX_VOLUMES)) {
      return null;
    }

    for (let offset = 0; offset <= last - first; offset++) {
      volumes.add(first + offset);
      if (volumes.size > MAX_VOLUMES) return null;
    }
  }
  return [...volumes];
}
