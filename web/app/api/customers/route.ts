import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import { requireSaasAccess } from "@/lib/saas";

export async function GET(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.dealership_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("customers")
      .select(`
        id,
        dealership_id,
        name,
        phone,
        email,
        notes,
        created_by,
        created_at,
        updated_at
      `)
      .eq("dealership_id", profile.dealership_id)
      .order("created_at", { ascending: false });

    if (search) {
      const escaped = search.replace(/[%_]/g, "\\$&");

      query = query.or(
        `name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET /api/customers error:", error);

      return NextResponse.json(
        { error: "Unable to load customers" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      customers: data ?? [],
    });
  } catch (error) {
    console.error("GET /api/customers exception:", error);

    return NextResponse.json(
      { error: "Unable to load customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.id || !profile.dealership_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }


    const saasAccess = await requireSaasAccess();

    if (!saasAccess.ok) {
      return NextResponse.json(
        { error: saasAccess.error },
        { status: saasAccess.status }
      );
    }

    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const phone = String(body.phone ?? "").trim() || null;
    const email = String(body.email ?? "").trim() || null;
    const notes = String(body.notes ?? "").trim() || null;

    if (!name) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    if (!phone && !email) {
      return NextResponse.json(
        { error: "Customer phone or email is required" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("customers")
      .insert({
        dealership_id: profile.dealership_id,
        name,
        phone,
        email,
        notes,
        created_by: profile.id,
      })
      .select(`
        id,
        dealership_id,
        name,
        phone,
        email,
        notes,
        created_by,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error("POST /api/customers error:", error);

      return NextResponse.json(
        { error: "Unable to create customer" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { customer: data },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/customers exception:", error);

    return NextResponse.json(
      { error: "Unable to create customer" },
      { status: 500 }
    );
  }
}
