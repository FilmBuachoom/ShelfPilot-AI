import { headers } from "next/headers";
import { readReviewQueue } from "@/lib/data/store";
import { isLocalIngestAvailable } from "@/lib/ingest/access";
import { AdminScreen } from "./admin-screen";

export default async function AdminPage() {
  const [{ items }, requestHeaders] = await Promise.all([readReviewQueue(), headers()]);
  const local = isLocalIngestAvailable(requestHeaders);
  return <AdminScreen items={items.filter(({ status }) => status === "open")}
    canManageIngest={local} />;
}
