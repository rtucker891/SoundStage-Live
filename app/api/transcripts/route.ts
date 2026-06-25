import { NextResponse } from "next/server";

import { transcripts } from "@/lib/transcripts";

export async function GET() {
  return NextResponse.json(transcripts);
}

export async function POST(request: Request) {
  const body = await request.json();

  const transcript = {
    id: `transcript-${Date.now()}`,
    episodeId: body.episodeId,
    createdAt: new Date().toISOString(),
    segments: body.segments ?? [],
  };

  transcripts.push(transcript);

  return NextResponse.json(transcript, {
    status: 201,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  const transcript = transcripts.find(
    (item) => item.id === body.id
  );

  if (!transcript) {
    return NextResponse.json(
      { message: "Transcript not found" },
      { status: 404 }
    );
  }

  transcript.segments = body.segments;

  return NextResponse.json(transcript);
}