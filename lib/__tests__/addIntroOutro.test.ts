import { describe, it, expect, vi } from "vitest";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

import {
  addIntroOutro,
  buildFilterGraph,
  type AddIntroOutroDeps,
} from "../audio/addIntroOutro";

/**
 * A mock FFmpeg instance recording every call. We only implement the four
 * methods addIntroOutro touches; no real WASM is loaded.
 */
function mockFFmpeg() {
  const written: string[] = [];
  const ffmpeg = {
    writeFile: vi.fn(async (name: string) => {
      written.push(name);
    }),
    exec: vi.fn(async () => 0),
    readFile: vi.fn(async () => new Uint8Array([1, 2, 3])),
    deleteFile: vi.fn(async () => undefined),
  };
  return { ffmpeg, written };
}

function makeDeps(ffmpeg: unknown): AddIntroOutroDeps {
  return {
    getFFmpeg: vi.fn(async () => ffmpeg as FFmpeg),
    // fetchFile just needs to yield some bytes; content is irrelevant here.
    fetchFile: vi.fn(async () => new Uint8Array([0])),
  };
}

const episode = new Blob(["episode"], { type: "audio/mpeg" });
const intro = new Blob(["intro"], { type: "audio/mpeg" });
const outro = new Blob(["outro"], { type: "audio/mpeg" });

/** Pull the single exec() argv out of the mock. */
function execArgs(ffmpeg: { exec: { mock: { calls: unknown[][] } } }): string[] {
  expect(ffmpeg.exec.mock.calls).toHaveLength(1);
  return ffmpeg.exec.mock.calls[0][0] as string[];
}

describe("buildFilterGraph", () => {
  it("uses concat for a hard cut (crossfade = 0)", () => {
    expect(buildFilterGraph(2, 0)).toEqual({
      filter: "[0:a][1:a]concat=n=2:v=0:a=1[out]",
      outLabel: "out",
    });
    expect(buildFilterGraph(3, 0).filter).toBe(
      "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]"
    );
  });

  it("chains acrossfade for a crossfade (crossfade > 0)", () => {
    expect(buildFilterGraph(2, 1.5).filter).toBe(
      "[0:a][1:a]acrossfade=d=1.5:c1=tri:c2=tri[out]"
    );
    expect(buildFilterGraph(3, 2).filter).toBe(
      "[0:a][1:a]acrossfade=d=2:c1=tri:c2=tri[a1];" +
        "[a1][2:a]acrossfade=d=2:c1=tri:c2=tri[out]"
    );
  });

  it("maps a single input straight through with no filter", () => {
    expect(buildFilterGraph(1, 0)).toEqual({ filter: "", outLabel: "0:a" });
  });
});

describe("addIntroOutro", () => {
  it("intro only: two inputs (intro, episode), hard-cut concat", async () => {
    const { ffmpeg, written } = mockFFmpeg();
    const deps = makeDeps(ffmpeg);

    const out = await addIntroOutro({ episode, intro }, deps);

    // Two segments written in play order: intro then episode.
    expect(written).toEqual(["in0", "in1"]);

    const args = execArgs(ffmpeg);
    expect(args).toContain("-filter_complex");
    expect(args[args.indexOf("-filter_complex") + 1]).toBe(
      "[0:a][1:a]concat=n=2:v=0:a=1[out]"
    );
    // Two "-i" input flags, mapped output, MP3 encode.
    expect(args.filter((a) => a === "-i")).toHaveLength(2);
    expect(args).toContain("-map");
    expect(args[args.indexOf("-map") + 1]).toBe("[out]");
    expect(args).toContain("libmp3lame");
    expect(out.type).toBe("audio/mpeg");
  });

  it("outro only: two inputs (episode, outro), hard-cut concat", async () => {
    const { ffmpeg, written } = mockFFmpeg();
    const deps = makeDeps(ffmpeg);

    await addIntroOutro({ episode, outro }, deps);

    // Episode first, then outro.
    expect(written).toEqual(["in0", "in1"]);

    const args = execArgs(ffmpeg);
    expect(args[args.indexOf("-filter_complex") + 1]).toBe(
      "[0:a][1:a]concat=n=2:v=0:a=1[out]"
    );
    expect(args.filter((a) => a === "-i")).toHaveLength(2);
  });

  it("both + crossfade: three inputs, chained acrossfade", async () => {
    const { ffmpeg, written } = mockFFmpeg();
    const deps = makeDeps(ffmpeg);

    await addIntroOutro(
      { episode, intro, outro, crossfadeSeconds: 2 },
      deps
    );

    // intro, episode, outro in order.
    expect(written).toEqual(["in0", "in1", "in2"]);

    const args = execArgs(ffmpeg);
    expect(args.filter((a) => a === "-i")).toHaveLength(3);
    expect(args[args.indexOf("-filter_complex") + 1]).toBe(
      "[0:a][1:a]acrossfade=d=2:c1=tri:c2=tri[a1];" +
        "[a1][2:a]acrossfade=d=2:c1=tri:c2=tri[out]"
    );
    expect(args[args.indexOf("-map") + 1]).toBe("[out]");
  });

  it("cleans up every in-memory file afterward", async () => {
    const { ffmpeg } = mockFFmpeg();
    const deps = makeDeps(ffmpeg);

    await addIntroOutro({ episode, intro, outro }, deps);

    // in0, in1, in2 + output.mp3 = 4 deletions.
    expect(ffmpeg.deleteFile).toHaveBeenCalledTimes(4);
    expect(ffmpeg.deleteFile).toHaveBeenCalledWith("output.mp3");
  });
});
