import { ImportExtractForm } from "@/components/ImportExtractForm/ImportExtractForm";

// #13 can embed the form in its admin shell without changing the API or pipeline.
export default function AdminPage() {
  return <main><ImportExtractForm /></main>;
}
