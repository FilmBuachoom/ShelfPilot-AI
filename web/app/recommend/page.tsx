import { notFound } from "next/navigation";
import { AI_ENABLED } from "@/lib/feature-flags";
import { todayInBangkok } from "@/lib/shelf/releases";
import { RecommendScreen } from "./recommend-screen";

export default function RecommendPage() {
  if (!AI_ENABLED) notFound();
  return <RecommendScreen today={todayInBangkok()} />;
}
