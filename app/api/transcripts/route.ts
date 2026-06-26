import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const TRANSCRIPTS_FILE = path.join(
  process.cwd(),
  "data",
  "transcripts.json"
);

async function readTranscripts() {
  const file = await fs.readFile(
    TRANSCRIPTS_FILE,
    "utf-8"
  );

  return JSON.parse(file);
}

async function writeTranscripts(transcripts: any[]) {
  await fs.writeFile(
    TRANSCRIPTS_FILE,
    JSON.stringify(transcripts, null, 2)
  );
}

export async function GET() {
  const transcripts = await readTranscripts();

  return NextResponse.json(transcripts);
}

export async function POST(request: Request) {
  const body = await request.json();

  const transcripts = await readTranscripts();

  const transcript = {
    id: `transcript-${Date.now()}`,
    episodeId: body.episodeId,
    createdAt: new Date().toISOString(),
    segments: body.segments ?? [],
  };

  transcripts.push(transcript);

  await writeTranscripts(transcripts);

  return NextResponse.json(transcript, {
    status: 201,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  const transcripts = await readTranscripts();

  const transcript = transcripts.find(
    (item: any) => item.id === body.id
  );

  if (!transcript) {
    return NextResponse.json(
      { message: "Transcript not found" },
      { status: 404 }
    );
  }

  transcript.segments = body.segments;

  await writeTranscripts(transcripts);

  return NextResponse.json(transcript);
}