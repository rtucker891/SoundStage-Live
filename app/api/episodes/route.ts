import { NextResponse } from "next/server";

import { episodes, shows } from "@/lib/mockData";

export async function GET() {
  return NextResponse.json(episodes);
}

export async function POST(request: Request) {
  const body = await request.json();

  const newEpisode = {
    id: `episode-${Date.now()}`,
    title: body.title,
    show: body.show || "SoundStage Live Demo",
    status: "Draft" as const,
    guest: body.guest || "Pending",
  };

  episodes.push(newEpisode);

  const matchingShow = shows.find(
    (show) => show.title === newEpisode.show
  );

  if (matchingShow) {
    matchingShow.episodes += 1;
  }

  return NextResponse.json(newEpisode, { status: 201 });
}