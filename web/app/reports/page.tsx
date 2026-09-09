import { redirect } from "next/navigation";

import ReportsClient from "./ReportsClient";
import { getCurrentUserProfile } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const profile = await getCurrentUserProfile();

  if (!profile?.dealership_id) {
    redirect("/login?redirectTo=%2Freports");
  }

  return <ReportsClient />;
}