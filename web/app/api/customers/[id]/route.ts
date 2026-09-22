import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  getCurrentUserProfile,
} from "@/lib/supabaseServer";
import { requireSaasAccess } from "@/lib/saas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CustomerRecord = {
  id: string;
  dealership_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.dealership_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const supabase = await createSupabaseServerClient();

    const { data: customer, error } = await supabase
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
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (error) {
      console.error("GET /api/customers/[id] error:", error);

      return NextResponse.json(
        { error: "Unable to load customer" },
        { status: 500 }
      );
    }

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer });
  } catch (error) {
    console.error("GET /api/customers/[id] exception:", error);

    return NextResponse.json(
      { error: "Unable to load customer" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.dealership_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Customers can edit only their own customer records

    const saasAccess = await requireSaasAccess();

    if (!saasAccess.ok) {
      return NextResponse.json(
        { error: saasAccess.error },
        { status: saasAccess.status }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const supabase = await createSupabaseServerClient();

    const { data: existing, error: existingError } = await supabase
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
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (existingError) {
      console.error(
        "PATCH /api/customers/[id] existing lookup error:",
        existingError
      );

      return NextResponse.json(
        { error: "Unable to load customer" },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    if (profile.role === "customer" && existing.created_by !== profile.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Customers can only edit their own customer records.",
        },
        { status: 403 }
      );
    }

    const updates: Record<string, string | null> = {};

    const finalName =
      body.name !== undefined
        ? String(body.name ?? "").trim()
        : existing.name;

    const finalPhone =
      body.phone !== undefined
        ? String(body.phone ?? "").trim() || null
        : existing.phone;

    const finalEmail =
      body.email !== undefined
        ? String(body.email ?? "").trim() || null
        : existing.email;

    if (!finalName) {
      return NextResponse.json(
        { error: "Customer name cannot be empty" },
        { status: 400 }
      );
    }

    if (!finalPhone && !finalEmail) {
      return NextResponse.json(
        { error: "Customer phone or email is required" },
        { status: 400 }
      );
    }

    if (body.name !== undefined) {
      updates.name = finalName;
    }

    if (body.phone !== undefined) {
      updates.phone = finalPhone;
    }

    if (body.email !== undefined) {
      updates.email = finalEmail;
    }

    if (body.notes !== undefined) {
      updates.notes =
        String(body.notes ?? "").trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        customer: existing as CustomerRecord,
      });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
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
      .maybeSingle();

    if (error) {
      console.error("PATCH /api/customers/[id] error:", error);

      return NextResponse.json(
        { error: "Unable to update customer" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ customer: data });
  } catch (error) {
    console.error("PATCH /api/customers/[id] exception:", error);

    return NextResponse.json(
      { error: "Unable to update customer" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile?.dealership_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Customers cannot delete customers
    if (profile.role === "customer") {
      return NextResponse.json(
        {
          success: false,
          error: "Customers do not have permission to delete customer records.",
        },
        { status: 403 }
      );
    }

    const saasAccess = await requireSaasAccess();

    if (!saasAccess.ok) {
      return NextResponse.json(
        { error: saasAccess.error },
        { status: saasAccess.status }
      );
    }

    const { id } = await context.params;

    const supabase = await createSupabaseServerClient();

    const { data: existing, error: existingError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id)
      .maybeSingle();

    if (existingError) {
      console.error(
        "DELETE /api/customers/[id] existing lookup error:",
        existingError
      );

      return NextResponse.json(
        { error: "Unable to load customer" },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id)
      .eq("dealership_id", profile.dealership_id);

    if (error) {
      console.error("DELETE /api/customers/[id] error:", error);

      return NextResponse.json(
        { error: "Unable to delete customer" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id] exception:", error);

    return NextResponse.json(
      { error: "Unable to delete customer" },
      { status: 500 }
    );
  }
}
