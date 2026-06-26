import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const ASSETS_FILE = path.join(
  process.cwd(),
  "data",
  "assets.json"
);

async function readAssets() {
  const file = await fs.readFile(ASSETS_FILE, "utf-8");

  return JSON.parse(file);
}

async function writeAssets(assets: any[]) {
  await fs.writeFile(
    ASSETS_FILE,
    JSON.stringify(assets, null, 2)
  );
}

export async function GET() {
  const assets = await readAssets();

  return NextResponse.json(assets);
}

export async function POST(request: Request) {
  const body = await request.json();

  const assets = await readAssets();

  const asset = {
    id: `asset-${Date.now()}`,
    episodeId: body.episodeId,
    name: body.name,
    type: body.type,
    fileName: body.fileName,
    fileSize: body.fileSize,
    mimeType: body.mimeType,
    createdAt: new Date().toISOString(),
    url: body.url,
  };

  assets.push(asset);

  await writeAssets(assets);

  return NextResponse.json(asset, {
    status: 201,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);

  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { message: "Missing asset id" },
      { status: 400 }
    );
  }

  const assets = await readAssets();

  const filteredAssets = assets.filter(
    (asset: any) => asset.id !== id
  );

  if (filteredAssets.length === assets.length) {
    return NextResponse.json(
      { message: "Asset not found" },
      { status: 404 }
    );
  }

  await writeAssets(filteredAssets);

  return NextResponse.json({
    success: true,
  });
}