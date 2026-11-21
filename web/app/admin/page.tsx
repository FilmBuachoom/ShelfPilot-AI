import { readReviewQueue } from "@/lib/data/store";
import { AdminScreen } from "./admin-screen";

export default async function AdminPage() {
  const { items } = await readReviewQueue();
  return <AdminScreen items={items.filter(({ status }) => status === "open")} />;
}
