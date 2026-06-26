import { NextResponse } from "next/server";

import { showNotes } from "@/lib/showNotes";

export async function GET() {
  return NextResponse.json(showNotes);
}

export async function POST(request: Request) {
  const body = await request.json();

  const showNote = {
    id: `show-note-${Date.now()}`,
    episodeId: body.episodeId,
    title: body.title,
    summary: body.summary,
    bulletPoints: body.bulletPoints ?? [],
    createdAt: new Date().toISOString(),
  };

  showNotes.push(showNote);

  return NextResponse.json(showNote, {
    status: 201,
  });
}