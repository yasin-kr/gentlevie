import { getAuth, getAuthAvailability } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unavailable() {
  return Response.json(
    { code: "SERVICE_UNAVAILABLE", message: "Üyelik işlemleri şu anda kullanılamıyor. Lütfen daha sonra tekrar dene" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function handle(request: Request) {
  if (!getAuthAvailability()) return unavailable();
  try {
    const auth = await getAuth();
    return await auth.handler(request);
  } catch {
    console.error("[auth] Request could not be completed");
    return unavailable();
  }
}

export { handle as GET, handle as POST };
