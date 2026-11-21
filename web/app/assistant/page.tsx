import { notFound } from "next/navigation";
import { AI_ENABLED } from "@/lib/feature-flags";
import { AssistantScreen } from "./assistant-screen";

export default function AssistantPage() {
  if (!AI_ENABLED) notFound();
  return <AssistantScreen />;
}
