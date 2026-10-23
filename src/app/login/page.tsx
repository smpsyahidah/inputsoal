"use client";

import { startTransition, useEffect, useState } from "react";
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
  normalizeTeacher,
  starterTeachers,
  type DemoSession,
  type Role,
  type Teacher,
} from "@/lib/ruangsoal";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("guru");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [teachers, setTeachers] = useState(starterTeachers);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      router.replace("/");
      return;
    }

    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData) as { teachers?: Array<Partial<Teacher> & { email?: string; subject?: string }> };
        if (parsed.teachers) startTransition(() => setTeachers(parsed.teachers!.map(normalizeTeacher)));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [router]);

  function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    let session: DemoSession | null = null;

    if (role === "admin") {
      if (username.trim().toLowerCase() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        session = { role: "admin" };
      }
    } else {
      const teacher = teachers.find((item) => item.username.toLowerCase() === username.trim().toLowerCase());
      if (teacher && password === TEACHER_PASSWORD) session = { role: "guru", teacherId: teacher.id };
    }

    if (!session) {
      setError("Username atau kata sandi tidak sesuai dengan akun demo.");
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    router.replace("/");
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