import { getStoredData } from "@/lib/database";

export async function GET(request: Request) {
  void request.url;
  try {
    await getStoredData();
    return Response.json(
      { ok: true, database: "connected" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    console.error("Pemeriksaan database RuangSoal gagal:", cause);
    return Response.json(
      { ok: false, database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
