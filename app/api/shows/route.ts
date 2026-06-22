import { NextResponse } from "next/server";
import { shows } from "@/lib/mockData";

export async function GET() {
  return NextResponse.json(shows);
}