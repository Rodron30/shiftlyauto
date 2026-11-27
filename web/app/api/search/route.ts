import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUserProfile } from "@/lib/supabaseServer";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", keywords: "dashboard home overview" },
  { href: "/vehicles", label: "Vehicles", keywords: "vehicles inventory cars trucks suv" },
  { href: "/customers", label: "Customers", keywords: "customers clients contacts" },
  { href: "/trade-appraisals", label: "Trade-Ins", keywords: "trade appraisal trade-in valuation" },
  { href: "/leads", label: "Leads", keywords: "leads prospects sales" },
  { href: "/crm", label: "CRM", keywords: "crm customer relationship management sales" },
  { href: "/reports", label: "Reports", keywords: "reports vehicle reports customer reports" },
  { href: "/integrations", label: "Integrations", keywords: "integrations dms crm inventory dealer website accounting" },
  { href: "/staff", label: "Staff", keywords: "staff users team employees" },
  { href: "/saas", label: "SaaS", keywords: "saas subscription plan usage" },
  { href: "/settings", label: "Settings", keywords: "settings configuration preferences" },
  { href: "/settings/security", label: "Security", keywords: "security trusted devices mfa" },
  { href: "/activities", label: "Activities", keywords: "activities calls sms email meetings notes follow up" },
];

function matches(text: string, query: string) {
  return text.toLowerCase().includes(query.toLowerCase());
}

export async function GET(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const query = new URL(request.url).searchParams.get("q")?.trim() || "";

    if (query.length < 2) {
      return NextResponse.json({
        pages: [],
        vehicles: [],
        customers: [],
        leads: [],
        tradeAppraisals: [],
        reports: [],
        activities: [],
      });
    }

    // Escape SQL wildcard characters to prevent pattern injection
    const escapedQuery = query.replace(/[%_\\]/g, "\\$&");
    const isCustomer = profile.role === "customer";

    const pages = NAV_ITEMS
      .filter((item) => !isCustomer || ["/customers", "/leads", "/crm", "/reports"].includes(item.href))
      .filter((item) => matches(`${item.label} ${item.keywords}`, query))
      .map(({ href, label }) => ({ href, label }));

    const [vehicles, customers, leads, tradeAppraisals, reports, activities] =
      await Promise.all([
        isCustomer
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from("vehicles")
              .select("id, vin, year, make, model, trim")
              .eq("dealership_id", profile.dealership_id)
              .is("archived_at", null)
              .or(`vin.ilike.%${escapedQuery}%,make.ilike.%${escapedQuery}%,model.ilike.%${escapedQuery}%,trim.ilike.%${escapedQuery}%`)
              .limit(50),

        supabase
          .from("customers")
          .select("id, name, phone, email")
          .eq("dealership_id", profile.dealership_id)
          .or(`name.ilike.%${escapedQuery}%,phone.ilike.%${escapedQuery}%,email.ilike.%${escapedQuery}%`)
          .limit(8),

        supabase
          .from("leads")
          .select("id, customer_name, customer_phone, customer_email, interest_note")
          .eq("dealership_id", profile.dealership_id)
          .or(`customer_name.ilike.%${escapedQuery}%,customer_phone.ilike.%${escapedQuery}%,customer_email.ilike.%${escapedQuery}%,interest_note.ilike.%${escapedQuery}%`)
          .limit(8),

        isCustomer
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from("trade_appraisals")
              .select("id, vin, year, make, model, trim, condition, notes, created_at")
              .eq("dealership_id", profile.dealership_id)
              .or(`vin.ilike.%${escapedQuery}%,make.ilike.%${escapedQuery}%,model.ilike.%${escapedQuery}%,trim.ilike.%${escapedQuery}%,notes.ilike.%${escapedQuery}%`)
              .limit(8),

        isCustomer
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from("reports")
              .select("id, vehicle_id, customer_id, lead_id, created_at")
              .order("created_at", { ascending: false })
              .limit(50),

        isCustomer
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from("salesperson_activities")
              .select("id, activity_type, description, activity_at, customer_id, lead_id, user_id")
              .eq("dealership_id", profile.dealership_id)
              .or(`activity_type.ilike.%${escapedQuery}%,description.ilike.%${escapedQuery}%`)
              .limit(8),
      ]);

    if (
      vehicles.error ||
      customers.error ||
      leads.error ||
      tradeAppraisals.error ||
      reports.error ||
      activities.error
    ) {
      console.error(
        "Global search error:",
        vehicles.error ||
          customers.error ||
          leads.error ||
          tradeAppraisals.error ||
          reports.error ||
          activities.error
      );
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    return NextResponse.json({
      pages,
      vehicles: vehicles.data ?? [],
      customers: customers.data ?? [],
      leads: leads.data ?? [],
      tradeAppraisals: tradeAppraisals.data ?? [],
      reports: reports.data ?? [],
      activities: activities.data ?? [],
    });
  } catch (error) {
    console.error("Global search exception:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}


