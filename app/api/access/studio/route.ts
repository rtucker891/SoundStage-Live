import { admin, callerId } from "@/lib/teamServer";
import { getPlan, isStudioPlan } from "@/lib/plan";
import { studioJson, studioOptions } from "@/lib/studioBridge";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return studioOptions();
}

export async function GET(request: Request) {
  const db = admin();
  if (!db) return studioJson({ allowed: false, plan: null, reason: "The access service is not configured." }, 500);

  const uid = await callerId(db, request);
  if (!uid) return studioJson({ allowed: false, plan: null, reason: "not_signed_in" });

  const plan = await getPlan(db, uid);
  if (!isStudioPlan(plan)) {
    return studioJson({ allowed: false, plan, reason: "Upgrade to the Studio plan to use the desktop editor." });
  }

  return studioJson({ allowed: true, plan });
}
