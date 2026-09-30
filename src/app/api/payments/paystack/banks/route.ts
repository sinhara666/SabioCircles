import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listBanks } from "@/lib/payments/paystack";

export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }
  try {
    const banks = await listBanks();
    return NextResponse.json({ banks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load banks" },
      { status: 502 }
    );
  }
}
