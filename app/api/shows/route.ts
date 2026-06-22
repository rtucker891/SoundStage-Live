import { NextResponse } from "next/server";
import { shows } from "@/lib/mockData";

export async function GET() {
  return NextResponse.json(shows);
}

export async function POST(request: Request) {
  const body = await request.json();

  const newShow = {
    id: `show-${Date.now()}`,
    title: body.title,
    description: body.description,
    episodes: 0,
    status: "Draft" as const,
  };

  shows.push(newShow);

  return NextResponse.json(newShow, { status: 201 });
}