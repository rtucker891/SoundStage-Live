import Image from "next/image";
import Link from "next/link";

export default function SoundStageLogo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/logo.png"
        alt="SoundStage Live"
        width={1756}
        height={664}
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