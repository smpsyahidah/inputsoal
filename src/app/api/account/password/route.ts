import {
  getLoginCredentials,
  getPasswordAccountId,
  getSession,
  updateAccountPassword,
  verifyAccountPassword,
} from "@/lib/auth";
import { getStoredData } from "@/lib/database";

type PasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
  teacherId?: unknown;
};

export async function POST(request: Request) {
  let session: ReturnType<typeof getSession>;
  try {
    session = getSession(request);
  } catch (cause) {
    console.error("Gagal memeriksa sesi sebelum memperbarui password:", cause);
    return Response.json(
      { error: "Konfigurasi sesi belum siap. Periksa AUTH_SECRET di environment server." },
      { status: 503 },
    );
  }
  if (!session) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 });

  const body = await request.json().catch(() => null) as PasswordBody | null;
  if (
    !body ||
    typeof body.newPassword !== "string" ||
    body.newPassword.length < 12 ||
    body.newPassword.length > 128
  ) {
    return Response.json(
      { error: "Password baru harus terdiri dari 12 sampai 128 karakter." },
      { status: 400 },
    );
  }

  try {
    const stored = await getStoredData();
    let accountId: string;
    if (typeof body.teacherId === "string") {
      if (session.role !== "admin") {
        return Response.json({ error: "Hanya admin yang dapat mereset password guru." }, { status: 403 });
      }
      if (!stored.data.teachers.some((teacher) => teacher.id === body.teacherId)) {
        return Response.json({ error: "Akun guru tidak ditemukan." }, { status: 404 });
      }
      accountId = `teacher:${body.teacherId}`;
    } else {
      if (typeof body.currentPassword !== "string") {
        return Response.json({ error: "Password saat ini wajib diisi." }, { status: 400 });
      }

      const credentials = getLoginCredentials();
      const initialPassword = session.role === "admin"
        ? credentials.adminPassword
        : credentials.teacherPassword;
      if (!await verifyAccountPassword(
        getPasswordAccountId(session),
        body.currentPassword,
        initialPassword,
      )) {
        return Response.json({ error: "Password saat ini tidak sesuai." }, { status: 401 });
      }
      accountId = getPasswordAccountId(session);
    }

    await updateAccountPassword(accountId, body.newPassword);
    return Response.json({ updated: true });
  } catch (cause) {
    console.error("Gagal memperbarui password akun:", cause);
    return Response.json({ error: "Password gagal disimpan. Periksa koneksi database lalu coba lagi." }, { status: 503 });
  }
}
