import { headers } from "next/headers";
import { readReviewQueue } from "@/lib/data/store";
import { isLocalIngestAvailable } from "@/lib/ingest/access";
import { usesSupabaseDemo } from "@/lib/data/supabase-demo-access";
import { readSupabaseIngest } from "@/lib/data/supabase-demo";
import { AdminScreen } from "./admin-screen";

export default async function AdminPage() {
  const requestHeaders = await headers();
  const local = isLocalIngestAvailable(requestHeaders);
  const supabase = usesSupabaseDemo();
  const admin = local && supabase ? await readSupabaseIngest().catch(() => undefined) : undefined;
  const { items } = admin?.queue ?? await readReviewQueue();
  return <AdminScreen items={items.filter(({ status }) => status === "open")}
    canManageIngest={local && (!supabase || Boolean(admin))} />;
}
