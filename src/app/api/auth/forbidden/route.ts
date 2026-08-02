import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Forbidden: Insufficient access privileges to view this resource."
    },
    { status: 403 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Forbidden: Insufficient access privileges to execute this transaction."
    },
    { status: 403 }
  );
}
