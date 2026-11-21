export function logUnknownId(field: "book_id" | "source_id", id: string): void {
  console.warn("Unknown catalog ID", { field, id });
}
