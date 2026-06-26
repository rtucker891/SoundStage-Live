import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

import { shows } from "@/lib/mockData";

const EPISODES_FILE = path.join(
  process.cwd(),
  "data",
  "episodes.json"
);

async function readEpisodes() {
  const file = await fs.readFile(
    EPISODES_FILE,
    "utf-8"
  );

  return JSON.parse(file);
}

async function writeEpisodes(episodes: any[]) {
  await fs.writeFile(
    EPISODES_FILE,
    JSON.stringify(episodes, null, 2)
  );
}

export async function GET() {
  const episodes = await readEpisodes();

  return NextResponse.json(episodes);
}

export async function POST(request: Request) {
  const body = await request.json();

  const episodes = await readEpisodes();

  const newEpisode = {
    id: `episode-${Date.now()}`,
    title: body.title,
    show: body.show || "SoundStage Live Demo",
    status: "Planning" as const,
    guest: body.guest || "Pending",
  };

  episodes.push(newEpisode);

  await writeEpisodes(episodes);

  const matchingShow = shows.find(
    (show) => show.title === newEpisode.show
  );

  if (matchingShow) {
    matchingShow.episodes += 1;
  }

  return NextResponse.json(newEpisode, {
    status: 201,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();

  const episodes = await readEpisodes();

  const episode = episodes.find(
    (item: any) => item.id === body.id
  );

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

  await writeEpisodes(episodes);

  return NextResponse.json(episode);
}