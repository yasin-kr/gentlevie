import { getSession, isAdmin } from "@/lib/auth";
import { dispatchNewsletterBatch, getNewsletterQueueCounts } from "@/lib/newsletter";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function response(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorize(request: Request) {
  const session = await getSession(request.headers);
  if (!session) return response(401, { ok: false, message: "Önce giriş yapmalısın" });
  if (!isAdmin(session)) return response(403, { ok: false, message: "Bu işlem için yetkin yok" });
  return null;
}

export async function GET(request: Request) {
  try {
    const denied = await authorize(request);
    if (denied) return denied;
    return response(200, { ok: true, counts: await getNewsletterQueueCounts() });
  } catch {
    return response(503, { ok: false, message: "Duyurular şu anda yüklenemiyor" });
  }
}

export async function POST(request: Request) {
  try {
    const denied = await authorize(request);
    if (denied) return denied;
    if (request.headers.get("origin") !== siteUrl || request.headers.get("sec-fetch-site") === "cross-site") {
      return response(403, { ok: false, message: "Bu isteğe izin verilmiyor" });
    }
    // This action has no client-selectable recipients or content.
    const result = await dispatchNewsletterBatch();
    return response(200, { ok: true, result, counts: await getNewsletterQueueCounts() });
  } catch {
    console.error("[newsletter] Delivery temporarily unavailable");
    return response(503, { ok: false, message: "Duyurular şu anda gönderilemiyor. Gönderim ayarlarını kontrol edip yeniden deneyebilirsin." });
  }
}
