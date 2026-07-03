import Link from "next/link";

export default function SoundStageLogo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <img
        src="/logo.png"
        alt="SoundStage Live"
        className="h-14 w-auto"
      />

      <div>
        <div className="text-3xl font-black">
          SoundStage Live
        </div>

        <div className="text-xs uppercase tracking-widest text-slate-500">
          Create. Publish. Be Heard.
        </div>
      </div>
    </Link>
  );
}