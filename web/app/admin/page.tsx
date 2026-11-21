import { headers } from "next/headers";
import { readReviewQueue } from "@/lib/data/store";
import { isIngestAvailable } from "@/lib/ingest/access";
import { usesSupabaseDemo } from "@/lib/data/supabase-demo-access";
import { readSupabaseIngest } from "@/lib/data/supabase-demo";
import { AdminScreen } from "./admin-screen";

export default async function AdminPage() {
  const requestHeaders = await headers();
  const available = isIngestAvailable(requestHeaders);
  const supabase = usesSupabaseDemo();
  const admin = available && supabase ? await readSupabaseIngest().catch(() => undefined) : undefined;
  const { items } = admin?.queue ?? await readReviewQueue();
  return <AdminScreen items={items.filter(({ status }) => status === "open")}
    canManageIngest={available && (!supabase || Boolean(admin))} />;
}
