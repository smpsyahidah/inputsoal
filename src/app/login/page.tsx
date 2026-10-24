"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, BookOpenCheck, Eye, EyeOff, GraduationCap, ShieldCheck } from "lucide-react";
import {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  SESSION_KEY,
  SCHOOL,
  STORAGE_KEY,
  TEACHER_PASSWORD,
  type Role,
} from "@/lib/ruangsoal";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("guru");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth", { cache: "no-store" })
      .then((response) => {
        if (response.ok) router.replace("/");
        else if (response.status !== 401) {
          return response.json().catch(() => null).then((result: { error?: string } | null) => {
            setError(result?.error ?? "Layanan login belum siap. Periksa konfigurasi server.");
          });
        }
      })
      .catch(() => setError("Tidak dapat memeriksa sesi. Periksa koneksi lalu muat ulang halaman."));
  }, [router]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, username, password }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error ?? "Tidak dapat masuk. Pastikan PostgreSQL dan konfigurasi server sudah aktif.");
        return;
      }

      if (role === "admin") {
        const legacy = localStorage.getItem(STORAGE_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy) as {
            questions?: unknown[];
            teachers?: unknown[];
          };
          if (!Array.isArray(parsed.questions) || !Array.isArray(parsed.teachers)) {
            throw new Error("Format data lama tidak valid. Data lama tetap tersimpan di browser ini.");
          }
          const migration = await fetch("/api/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...parsed, migration: true }),
          });
          if (!migration.ok) {
            const migrationResult = await migration.json().catch(() => null) as { error?: string } | null;
            throw new Error(migrationResult?.error ?? "Data lama gagal dipindahkan.");
          }
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      localStorage.removeItem(SESSION_KEY);
      router.replace("/");
    } catch (cause) {
      await fetch("/api/auth", { method: "DELETE" }).catch((cleanupError: unknown) => {
        console.error("Gagal membersihkan sesi login yang tidak lengkap:", cleanupError);
      });
      setError(cause instanceof Error
        ? `Login atau migrasi data gagal: ${cause.message}`
        : "Login atau migrasi data gagal. Periksa koneksi lalu coba lagi.");
    }
  }

  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="login-story-grid" />
        <a className="brand login-brand" href="/login" aria-label="RuangSoal">
          <span className="brand-mark"><BookOpenCheck size={21} strokeWidth={2.2} /></span>
          <span className="brand-name">ruang<span>soal</span></span>
        </a>
        <div className="login-school-mark"><Image src="/smp-syarif-hidayatullah.svg" width={126} height={121} alt="Lambang SMP Syarif Hidayatullah" priority /></div>
        <div className="login-story-copy">
          <div className="login-kicker"><span /> PORTAL AKADEMIK</div>
          <h1>{SCHOOL.name}</h1>
          <p>{SCHOOL.address}</p>
          <div className="login-rule" />
          <div className="login-story-caption"><span>01</span><span>Bank soal terstruktur, untuk setiap kelas.</span></div>
        </div>
        <div className="login-story-footer"><span>RUANG KERJA DIGITAL</span><span>TA 2026 / 2027</span></div>
      </section>

      <section className="login-panel">
        <div className="login-panel-inner">
          <div className="login-mobile-brand">
            <span className="brand-mark"><BookOpenCheck size={19} /></span>
            <span className="brand-name">ruang<span>soal</span></span>
            <Image src="/smp-syarif-hidayatullah.svg" width={42} height={40} alt="Lambang SMP Syarif Hidayatullah" priority />
          </div>
          <div className="login-heading">
            <div className="login-eyebrow"><ShieldCheck size={14} /> AKSES SEKOLAH</div>
            <h2>Selamat datang</h2>
            <p>Masuk untuk mengelola bank soal sekolah.</p>
          </div>

          <div className="login-role-switch" aria-label="Pilih jenis akun">
            <button type="button" className={role === "guru" ? "active" : ""} onClick={() => { setRole("guru"); setError(""); }}><GraduationCap size={15} /> Guru</button>
            <button type="button" className={role === "admin" ? "active" : ""} onClick={() => { setRole("admin"); setError(""); }}><ShieldCheck size={15} /> Admin</button>
          </div>

          <form className="login-form" onSubmit={signIn}>
            <label>Username {role === "guru" ? "guru" : "administrator"}
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={role === "guru" ? "Contoh: nadia" : "Contoh: admin"}
              />
            </label>
            <label>Kata sandi
              <span className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Masukkan kata sandi"
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="login-submit" type="submit">Masuk ke ruang soal <ArrowRight size={17} /></button>
          </form>

          <div className="demo-access">
            <span className="demo-access-title">AKUN DEMO</span>
            <p>{role === "admin" ? <><strong>{ADMIN_USERNAME}</strong><span>Kata sandi: {ADMIN_PASSWORD}</span></> : <><strong>nadia</strong><span>Kata sandi guru: {TEACHER_PASSWORD}</span></>}</p>
          </div>

          <div className="login-address"><span>{SCHOOL.name}</span><span>{SCHOOL.address}</span></div>
        </div>
      </section>
    </main>
  );
}