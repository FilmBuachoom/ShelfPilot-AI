import { notFound } from "next/navigation";
import { AI_ENABLED } from "@/lib/feature-flags";

export default function AssistantPage() {
  if (!AI_ENABLED) notFound();
  // AppShell renders the assistant for both the full page and the desktop panel.
  return null;
}
