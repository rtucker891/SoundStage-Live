import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

import { recordings } from "@/lib/recordings";

export async function GET() {
  return NextResponse.json(recordings);
}

export async function POST(request: Request) {
  const formData = await request.formData();

const file = formData.get("file");
const episodeId = formData.get("episodeId");
const name = formData.get("name");

if (!(file instanceof File)) {
  return NextResponse.json(
    { message: "No recording file uploaded" },
    { status: 400 }
  );
}

const arrayBuffer = await file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
const uploadsDir = path.join(
  process.cwd(),
  "public",
  "recordings"
);

await fs.mkdir(uploadsDir, {
  recursive: true,
});

const fileName = `recording-${Date.now()}.webm`;

const filePath = path.join(
  uploadsDir,
  fileName
);

await fs.writeFile(filePath, buffer);

const audioUrl = `/recordings/${fileName}`;

 const recording = {
  id: `recording-${Date.now()}`,
  episodeId,
  name,
  createdAt: new Date().toISOString(),
  fileName,
  audioUrl,
};
recordings.push(recording);

return NextResponse.json(recording, {
  status: 201,
});
}