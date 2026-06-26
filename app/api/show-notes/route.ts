import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const SHOW_NOTES_FILE = path.join(
  process.cwd(),
  "data",
  "show-notes.json"
);

async function readShowNotes() {
  const file = await fs.readFile(
    SHOW_NOTES_FILE,
    "utf-8"
  );

  return JSON.parse(file);
}

async function writeShowNotes(showNotes: any[]) {
  await fs.writeFile(
    SHOW_NOTES_FILE,
    JSON.stringify(showNotes, null, 2)
  );
}

export async function GET() {
  const showNotes = await readShowNotes();

  return NextResponse.json(showNotes);
}

export async function POST(request: Request) {
  const body = await request.json();

  const showNotes = await readShowNotes();

  const showNote = {
    id: `show-note-${Date.now()}`,
    episodeId: body.episodeId,
    title: body.title,
    summary: body.summary,
    bulletPoints: body.bulletPoints ?? [],
    createdAt: new Date().toISOString(),
  };

  showNotes.push(showNote);

  await writeShowNotes(showNotes);

  return NextResponse.json(showNote, {
    status: 201,
  });
}