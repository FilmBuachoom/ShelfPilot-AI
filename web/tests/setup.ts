import { vi } from "vitest";

// Vitest runs in Node without Next.js handling the server-only marker.
vi.mock("server-only", () => ({}));
