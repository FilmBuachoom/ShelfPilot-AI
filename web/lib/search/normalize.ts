export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[๐-๙]/g, (digit) => String(digit.charCodeAt(0) - "๐".charCodeAt(0)))
    .replace(/เล่ม(?=\s|\d|$)|\bvol\.(?=\s|\d|$)|#/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
