import { NextResponse } from "next/server";

import { assets } from "@/lib/assets";

export async function GET() {
  return NextResponse.json(assets);
}

export async function POST(request: Request) {
  const body = await request.json();

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

  const index = assets.findIndex(
    (asset) => asset.id === id
  );

  if (index === -1) {
    return NextResponse.json(
      { message: "Asset not found" },
      { status: 404 }
    );
  }

  assets.splice(index, 1);

  return NextResponse.json({
    success: true,
  });
}