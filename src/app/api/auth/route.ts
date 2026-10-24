import {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  TEACHER_PASSWORD,
} from "@/lib/ruangsoal";
import { clearSessionCookie, createSessionCookie, getSession } from "@/lib/auth";
import { getStoredData } from "@/lib/database";

export async function GET(request: Request) {
  try {
    const session = getSession(request);
    if (!session) return Response.json({ error: "Sesi tidak valid." }, { status: 401 });
    return Response.json({ session }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("Gagal memeriksa sesi RuangSoal:", cause);
    return Response.json(
      { error: "AUTH_SECRET belum siap. Periksa .env.local lalu restart aplikasi." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    role?: string;
    username?: string;
    password?: string;
  } | null;
  if (
    !body ||
    (body.role !== "admin" && body.role !== "guru") ||
    typeof body.username !== "string" ||
    typeof body.password !== "string"
  ) {
    return Response.json({ error: "Username, kata sandi, dan jenis akun wajib diisi." }, { status: 400 });
  }

  try {
    const username = body.username.trim().toLowerCase();
    let session = null;
    if (body.role === "admin") {
      if (username === ADMIN_USERNAME && body.password === ADMIN_PASSWORD) {
        session = { role: "admin" as const };
      }
    } else if (body.password === TEACHER_PASSWORD) {
      const { teachers } = (await getStoredData()).data;
      const teacher = teachers.find((item) => item.username.toLowerCase() === username);
      if (teacher) session = { role: "guru" as const, teacherId: teacher.id };
    }

    if (!session) {
      return Response.json({ error: "Username atau kata sandi tidak sesuai dengan akun demo." }, { status: 401 });
    }

    return new Response(JSON.stringify({ session }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": createSessionCookie(session),
        "Cache-Control": "no-store",
      },
    });
  } catch (cause) {
    console.error("Gagal membuat sesi RuangSoal:", cause);
    return Response.json(
      { error: "Login server belum siap. Pastikan PostgreSQL aktif dan AUTH_SECRET sudah diatur." },
      { status: 503 },
    );
  }
}

export async function DELETE() {
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}
