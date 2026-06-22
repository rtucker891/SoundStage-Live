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
    status: "Planning" as const,
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

export async function PATCH(request: Request) {
  const body = await request.json();

  const episode = episodes.find((item) => item.id === body.id);

  if (!episode) {
    return NextResponse.json(
      { message: "Episode not found" },
      { status: 404 }
    );
  }

  if (body.title) {
    episode.title = body.title;
  }

  if (body.guest) {
    episode.guest = body.guest;
  }

  if (body.show) {
    episode.show = body.show;
  }

  if (body.status) {
    episode.status = body.status;
  }

  return NextResponse.json(episode);
}