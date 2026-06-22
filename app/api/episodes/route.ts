import { NextResponse } from "next/server";
import { episodes } from "@/lib/mockData";

export async function GET() {
  return NextResponse.json(episodes);
}