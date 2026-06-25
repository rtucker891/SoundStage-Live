import { NextResponse } from "next/server";

import { recordings } from "@/lib/recordings";

export async function GET() {
  return NextResponse.json(recordings);
}

export async function POST(request: Request) {
  const body = await request.json();

  const recording = {
    id: `recording-${Date.now()}`,
    episodeId: body.episodeId,
    name: body.name,
    duration: body.duration,
    createdAt: new Date().toISOString(),
    audioUrl: body.audioUrl,
  };

  recordings.push(recording);

  return NextResponse.json(recording, {
    status: 201,
  });
}