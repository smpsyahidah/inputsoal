"use client";

import { Editor } from "@tinymce/tinymce-react";
import ExcelJS from "exceljs";
import {
  ArrowDownToLine,
  BookOpenCheck,
  Check,
  ChevronDown,
  CircleHelp,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  DEFAULT_GRADE,
  GRADE_LEVELS,
  SCHOOL,
  type DemoSession,
  type GradeLevel,
  type Question,
  type Role,
  type Teacher,
  type TeachingAssignment,
} from "@/lib/ruangsoal";

const choiceLabels = ["A", "B", "C", "D"] as const;

const emptyDraft = (assignment?: TeachingAssignment): Pick<Question, "subject" | "grade" | "prompt" | "choices" | "correct"> => ({
  subject: assignment?.subject ?? "Matematika",
  grade: assignment?.grade ?? DEFAULT_GRADE,
  prompt: "",
  choices: ["", "", "", ""],
  correct: "A",
});

function getAssignmentKey(assignment: TeachingAssignment) {
  return `${assignment.subject}::${assignment.grade}`;
}

function plainText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function embeddedImages(value: string) {
  const document = new DOMParser().parseFromString(value, "text/html");
  return Array.from(document.querySelectorAll("img"), (image) => image.src)
    .filter((src) => src.startsWith("data:image/"));
}

function TinyEditor({
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  compact?: boolean;
}) {
  return (
    <Editor
      tinymceScriptSrc="/tinymce/tinymce.min.js"
      licenseKey="gpl"
      value={value}
      onEditorChange={onChange}
      init={{
        height: compact ? 106 : 172,
        menubar: false,
        statusbar: false,
        branding: false,
        placeholder,
        plugins: "lists link table code image",
        toolbar: compact
          ? "image | bold italic underline | bullist numlist"
          : "image | undo redo | bold italic underline | blocks | bullist numlist | link table | removeformat",
        toolbar_mode: "sliding",
        content_style:
          "body { font-family: Georgia, serif; font-size: 15px; color: #282a24; line-height: 1.65; padding: 8px 12px; } p { margin: 0 0 8px; }",
        skin: "oxide",
        resize: false,
        file_picker_types: "image",
        image_caption: true,
        image_dimensions: false,
        paste_data_images: true,
        file_picker_callback: (callback, _value, meta) => {
          if (meta.filetype !== "image") return;
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.addEventListener("change", () => {
            const file = input.files?.[0];
            if (!file) return;
            const imageUrl = URL.createObjectURL(file);
            const image = document.createElement("img");
            image.onload = () => {
              const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
              const canvas = document.createElement("canvas");
              canvas.width = Math.max(1, Math.round(image.width * scale));
              canvas.height = Math.max(1, Math.round(image.height * scale));
              canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
              callback(canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.82), { alt: file.name });
              URL.revokeObjectURL(imageUrl);
            };
            image.onerror = () => URL.revokeObjectURL(imageUrl);
            image.src = imageUrl;
          });
          input.click();
        },
      }}
    />
  );
}

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("guru");
  const [session, setSession] = useState<DemoSession | null>(null);
  const [activeTeacherId, setActiveTeacherId] = useState("");
  const [activeAssignmentKey, setActiveAssignmentKey] = useState("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"questions" | "users">("questions");
  const [filterSubject, setFilterSubject] = useState("Semua mapel");
  const [filterGrade, setFilterGrade] = useState("Semua tingkat");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ name: "", username: "", assignments: [] as TeachingAssignment[] });
  const [assignmentDraft, setAssignmentDraft] = useState({ subject: "", grade: DEFAULT_GRADE as GradeLevel });
  const [assignmentEditorTeacherId, setAssignmentEditorTeacherId] = useState<string | null>(null);
  const [existingAssignmentDraft, setExistingAssignmentDraft] = useState({ subject: "", grade: DEFAULT_GRADE as GradeLevel });
  const [teacherFormError, setTeacherFormError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saving" | "saved" | "error">("saved");
  const [ready, setReady] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const revision = useRef(0);
  const lastSavedSnapshot = useRef("");

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      try {
        const authResponse = await fetch("/api/auth", { cache: "no-store" });
        if (authResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (!authResponse.ok) {
          const authError = await authResponse.json().catch(() => null) as { error?: string } | null;
          throw new Error(authError?.error ?? "Layanan login belum siap. Periksa konfigurasi server.");
        }
        const authResult = await authResponse.json() as { session: DemoSession };
        const dataResponse = await fetch("/api/data", { cache: "no-store" });
        const dataResult = await dataResponse.json().catch(() => null) as {
          error?: string;
          teachers?: Teacher[];
          questions?: Question[];
          revision?: number;
        } | null;
        if (!dataResponse.ok) throw new Error(dataResult?.error ?? "Data gagal dimuat.");
        if (!dataResult?.teachers || !dataResult.questions || !dataResult.revision) {
          throw new Error("Format data dari server tidak valid.");
        }
        if (cancelled) return;

        revision.current = dataResult.revision;
        lastSavedSnapshot.current = JSON.stringify({
          questions: dataResult.questions,
          teachers: dataResult.teachers,
        });
        setSession(authResult.session);
        setRole(authResult.session.role);
        setTeachers(dataResult.teachers);
        setQuestions(dataResult.questions);
        if (authResult.session.role === "guru") {
          const teacher = dataResult.teachers.find((item) => item.id === authResult.session.teacherId);
          if (!teacher) throw new Error("Akun guru tidak lagi tersedia.");
          setActiveTeacherId(teacher.id);
          if (teacher.assignments[0]) setActiveAssignmentKey(getAssignmentKey(teacher.assignments[0]));
        }
        setReady(true);
      } catch (cause) {
        if (!cancelled) {
          setLoadError(cause instanceof Error ? cause.message : "Data gagal dimuat.");
        }
      }
    }
    void loadWorkspace();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!ready || !session) return;
    const snapshot = { questions, teachers };
    const serializedSnapshot = JSON.stringify(snapshot);
    if (serializedSnapshot === lastSavedSnapshot.current) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current
        .then(async () => {
          const response = await fetch("/api/data", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...snapshot, revision: revision.current }),
          });
          const result = await response.json() as { error?: string; revision?: number };
          if (!response.ok) {
            throw new Error(result.error ?? "Perubahan gagal disimpan.");
          }
          if (typeof result.revision !== "number") throw new Error("Versi data dari server tidak valid.");
          revision.current = result.revision;
          lastSavedSnapshot.current = serializedSnapshot;
          setSaveError("");
          setSaveStatus("saved");
        })
        .catch((cause: unknown) => {
          setSaveError(cause instanceof Error ? cause.message : "Perubahan gagal disimpan.");
          setSaveStatus("error");
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [questions, ready, session, teachers]);

  const activeTeacher = teachers.find((teacher) => teacher.id === activeTeacherId);
  const activeAssignment = activeTeacher?.assignments.find(
    (assignment) => getAssignmentKey(assignment) === activeAssignmentKey,
  ) ?? activeTeacher?.assignments[0];
  const selectedAssignmentKey = activeAssignment ? getAssignmentKey(activeAssignment) : "";
  const availableSubjects = Array.from(new Set(questions.map((question) => question.subject)));
  const availableGrades = Array.from(new Set(questions.map((question) => question.grade)));
  const assignmentSubjects = Array.from(new Set(teachers.flatMap((teacher) => teacher.assignments.map((assignment) => assignment.subject))));
  const visibleQuestions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return questions.filter((question) => {
      const matchesSubject = filterSubject === "Semua mapel" || question.subject === filterSubject;
      const matchesGrade = filterGrade === "Semua tingkat" || question.grade === filterGrade;
      const matchesSearch =
        !needle ||
        [question.prompt, question.subject, question.grade, question.teacher].some((part) =>
          plainText(part).toLowerCase().includes(needle),
        );
      const matchesRole = role === "admin" || (
        question.teacherId === activeTeacher?.id &&
        question.subject === activeAssignment?.subject &&
        question.grade === activeAssignment?.grade
      );
      return matchesSubject && matchesGrade && matchesSearch && matchesRole;
    });
  }, [activeAssignment?.grade, activeAssignment?.subject, activeTeacher?.id, filterGrade, filterSubject, questions, role, search]);

  function openNewQuestion() {
    setDraft(emptyDraft(activeAssignment));
    setEditingId(null);
    setShowForm(true);
  }

  function editQuestion(question: Question) {
    setDraft({
      subject: question.subject,
      grade: question.grade,
      prompt: question.prompt,
      choices: [...question.choices],
      correct: question.correct,
    });
    setEditingId(question.id);
    setShowForm(true);
  }

  function saveQuestion() {
    if (!activeTeacher || !activeAssignment || !plainText(draft.prompt) || draft.choices.some((choice) => !plainText(choice))) return;
    const { subject, grade } = activeAssignment;
    const now = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    if (editingId) {
      setQuestions((current) =>
        current.map((question) =>
          question.id === editingId
            ? { ...question, ...draft, subject, grade, teacherId: activeTeacher.id, teacher: activeTeacher.name, updatedAt: now }
            : question,
        ),
      );
    } else {
      setQuestions((current) => [
        {
          id: crypto.randomUUID(),
          ...draft,
          subject,
          grade,
          teacherId: activeTeacher.id,
          teacher: activeTeacher.name,
          updatedAt: now,
        },
        ...current,
      ]);
    }
    setShowForm(false);
    setEditingId(null);
  }

  async function exportQuestions() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Bank Soal");
    sheet.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Soal", key: "prompt", width: 54 },
      { header: "Jawaban A", key: "answerA", width: 28 },
      { header: "Jawaban B", key: "answerB", width: 28 },
      { header: "Jawaban C", key: "answerC", width: 28 },
      { header: "Jawaban D", key: "answerD", width: 28 },
      { header: "Jawaban Benar", key: "correct", width: 18 },
      { header: "Mata Pelajaran", key: "subject", width: 24 },
      { header: "Tingkat", key: "grade", width: 14 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B473C" } };
    sheet.getRow(1).alignment = { vertical: "middle" };
    sheet.getColumn(2).alignment = { vertical: "top", wrapText: true };
    for (const column of [3, 4, 5, 6]) {
      sheet.getColumn(column).alignment = { vertical: "top", wrapText: true };
    }
    visibleQuestions.forEach((question, index) => {
      sheet.addRow({
        no: index + 1,
        prompt: plainText(question.prompt),
        answerA: plainText(question.choices[0]),
        answerB: plainText(question.choices[1]),
        answerC: plainText(question.choices[2]),
        answerD: plainText(question.choices[3]),
        correct: question.correct,
        subject: question.subject,
        grade: question.grade,
      });
      const imageContent = [
        { value: question.prompt, column: 2, label: "Soal" },
        ...question.choices.map((value, choiceIndex) => ({
          value,
          column: choiceIndex + 3,
          label: `Jawaban ${String.fromCharCode(65 + choiceIndex)}`,
        })),
      ];
      for (const content of imageContent) {
        for (const src of embeddedImages(content.value)) {
          const match = src.match(/^data:image\/(png|jpe?g);base64,/i);
          if (!match) continue;
          const extension = match[1].toLowerCase().replace("jpg", "jpeg") as "png" | "jpeg";
          const attachmentRow = sheet.addRow([]);
          attachmentRow.height = 58;
          attachmentRow.getCell(1).value = `Gambar ${content.label}`;
          const imageId = workbook.addImage({ base64: src, extension });
          sheet.addImage(imageId, {
            tl: { col: content.column - 1, row: attachmentRow.number - 1 },
            ext: { width: 96, height: 54 },
          });
        }
      }
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const file = new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bank-soal-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function addTeacher(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (teachers.some((teacher) => teacher.username.toLowerCase() === newTeacher.username.trim().toLowerCase())) {
      setTeacherFormError("Username tersebut sudah digunakan.");
      return;
    }
    const teacher = { ...newTeacher, id: crypto.randomUUID() };
    setTeachers((current) => [...current, teacher]);
    setNewTeacher({ name: "", username: "", assignments: [] });
    setAssignmentDraft({ subject: "", grade: DEFAULT_GRADE });
    setTeacherFormError("");
  }

  function addTeachingAssignment() {
    const subject = assignmentDraft.subject.trim();
    const grade = assignmentDraft.grade;
    if (!subject || newTeacher.assignments.some((assignment) => assignment.subject === subject && assignment.grade === grade)) return;
    setNewTeacher((current) => ({ ...current, assignments: [...current.assignments, { subject, grade }] }));
    setAssignmentDraft({ subject: "", grade });
  }

  function addAssignmentToTeacher(teacherId: string) {
    const subject = existingAssignmentDraft.subject.trim();
    const grade = existingAssignmentDraft.grade;
    if (!subject) return;
    setTeachers((current) => current.map((teacher) => {
      if (teacher.id !== teacherId || teacher.assignments.some((assignment) => assignment.subject === subject && assignment.grade === grade)) return teacher;
      return { ...teacher, assignments: [...teacher.assignments, { subject, grade }] };
    }));
    setExistingAssignmentDraft({ subject: "", grade });
  }

  function removeTeacherAssignment(teacherId: string, assignmentIndex: number) {
    setTeachers((current) => current.map((teacher) => {
      if (teacher.id !== teacherId || teacher.assignments.length <= 1) return teacher;
      return { ...teacher, assignments: teacher.assignments.filter((_, index) => index !== assignmentIndex) };
    }));
  }

  function logout() {
    void fetch("/api/auth", { method: "DELETE" })
      .finally(() => router.replace("/login"));
  }

  function removeTeacher(id: string) {
    setTeachers((current) => current.filter((teacher) => teacher.id !== id));
    if (activeTeacherId === id) logout();
  }

  if (loadError) {
    return <main className="auth-loading"><span role="alert">Gagal memuat ruang kerja: {loadError}</span><button onClick={() => window.location.reload()}>Muat ulang</button></main>;
  }

  if (!ready || !session) {
    return <main className="auth-loading"><span>Memuat ruang kerja sekolah...</span></main>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" aria-label="RuangSoal, beranda">
          <span className="brand-mark"><BookOpenCheck size={21} strokeWidth={2.2} /></span>
          <span className="brand-name">ruang<span>soal</span></span>
        </a>

        <div className="school-switcher">
          <Image className="school-logo-small" src="/smp-syarif-hidayatullah.svg" width={42} height={40} alt="Lambang SMP Syarif Hidayatullah" />
          <div className="school-meta"><strong>{SCHOOL.name}</strong><span>{SCHOOL.address}</span></div>
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Navigasi utama">
          <button className={`nav-item ${activeView === "questions" ? "selected" : ""}`} onClick={() => setActiveView("questions")}>
            <LayoutDashboard size={17} /> <span>Bank soal</span><span className="nav-count">{questions.length}</span>
          </button>
          {role === "admin" && (
            <button className={`nav-item ${activeView === "users" ? "selected" : ""}`} onClick={() => setActiveView("users")}>
              <Users size={17} /> <span>Pengguna</span><span className="nav-count">{teachers.length}</span>
            </button>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-link"><CircleHelp size={16} /><span>Pusat bantuan</span><span className="help-shortcut">?</span></div>
          <div className="sidebar-user">
            <div className="avatar avatar-green">{role === "admin" ? "AS" : activeTeacher?.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
            <div className="sidebar-user-meta"><strong>{role === "admin" ? "Admin Sekolah" : activeTeacher?.name}</strong><span>{role === "admin" ? "Administrator" : `${activeAssignment?.subject ?? "Guru"} · Tingkat ${activeAssignment?.grade ?? ""}`}</span></div>
            <Settings2 size={17} className="muted-icon" />
          </div>
        </div>
      </aside>

      <section className="workspace" id="dashboard">
        {saveError && <div className="login-error" role="alert">Perubahan belum tersimpan: {saveError} <button onClick={() => window.location.reload()}>Muat ulang</button></div>}
        <header className="topbar">
          <div className="breadcrumbs"><span>Ruang kerja</span><span className="crumb-divider">/</span><strong>{activeView === "users" ? "Pengguna" : "Bank soal"}</strong></div>
          <div className="topbar-actions">
            <span className="role-badge">{role === "admin" ? "Administrator" : "Guru"}</span>
            {role === "guru" && activeTeacher && (
              <label className="teacher-picker"><span className="sr-only">Pilih mapel dan tingkat</span><select value={selectedAssignmentKey} onChange={(event) => setActiveAssignmentKey(event.target.value)} aria-label="Pilih mapel dan tingkat">
                {activeTeacher.assignments.map((assignment) => <option key={getAssignmentKey(assignment)} value={getAssignmentKey(assignment)}>{assignment.subject} · Tingkat {assignment.grade}</option>)}
              </select><ChevronDown size={14} /></label>
            )}
            <div className="topbar-avatar">{role === "admin" ? "AS" : activeTeacher?.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
            <button className="logout-button" onClick={logout} title="Keluar" aria-label="Keluar"><LogOut size={16} /><span>Keluar</span></button>
          </div>
        </header>

        {activeView === "users" && role === "admin" ? (
          <div className="content users-content">
            <div className="page-heading">
              <div><div className="eyebrow"><ShieldCheck size={14} /> ADMINISTRASI</div><h1>Pengguna</h1><p>Kelola akun guru dan mata pelajaran yang mereka ampu.</p></div>
            </div>
            <section className="panel user-panel">
              <div className="panel-heading"><div><h2>Guru terdaftar</h2><p>{teachers.length} pengguna dengan akses guru</p></div><span className="soft-badge"><Users size={14} /> {teachers.length} guru</span></div>
              <div className="teacher-list">
                {teachers.map((teacher, index) => <div className="teacher-item" key={teacher.id}>
                  <div className="teacher-row">
                    <div className={`avatar ${index % 2 ? "avatar-peach" : "avatar-green"}`}>{teacher.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
                    <div className="teacher-info"><strong>{teacher.name}</strong><span>@{teacher.username}</span></div>
                    <div className="teacher-assignments">{teacher.assignments.map((assignment) => <span className="subject-pill" key={getAssignmentKey(assignment)}>{assignment.subject} · Tingkat {assignment.grade}</span>)}</div>
                    <button className="icon-button manage-assignments" aria-label={`Atur pengampu ${teacher.name}`} title="Atur mapel dan tingkat" onClick={() => { setAssignmentEditorTeacherId(assignmentEditorTeacherId === teacher.id ? null : teacher.id); setExistingAssignmentDraft({ subject: "", grade: DEFAULT_GRADE }); }}><Settings2 size={16} /></button>
                    <button className="icon-button remove-button" aria-label={`Hapus ${teacher.name}`} title="Hapus guru" onClick={() => removeTeacher(teacher.id)}><Trash2 size={16} /></button>
                  </div>
                  {assignmentEditorTeacherId === teacher.id && <div className="teacher-assignment-editor">
                    <div className="assignment-entry">
                      <label>Mata pelajaran<input list="subject-options" value={existingAssignmentDraft.subject} onChange={(event) => setExistingAssignmentDraft({ ...existingAssignmentDraft, subject: event.target.value })} placeholder="Contoh: IPA" /></label>
                      <label>Tingkat<select value={existingAssignmentDraft.grade} onChange={(event) => setExistingAssignmentDraft({ ...existingAssignmentDraft, grade: event.target.value as GradeLevel })}>{GRADE_LEVELS.map((grade) => <option key={grade} value={grade}>Tingkat {grade}</option>)}</select></label>
                      <button className="button button-secondary" type="button" onClick={() => addAssignmentToTeacher(teacher.id)} disabled={!existingAssignmentDraft.subject.trim()}><Plus size={15} /> Tambah penugasan</button>
                    </div>
                    <div className="assignment-chips">{teacher.assignments.map((assignment, assignmentIndex) => <span className="assignment-chip" key={`${getAssignmentKey(assignment)}-${assignmentIndex}`}>{assignment.subject} · Tingkat {assignment.grade}<button type="button" onClick={() => removeTeacherAssignment(teacher.id, assignmentIndex)} disabled={teacher.assignments.length <= 1} aria-label={`Hapus penugasan ${assignment.subject} tingkat ${assignment.grade}`}><X size={13} /></button></span>)}</div>
                  </div>}
                </div>)}
              </div>
              <form className="add-teacher-form" onSubmit={addTeacher}>
                <h3>Tambah guru</h3>
                <div className="form-grid">
                  <label>Nama lengkap<input required value={newTeacher.name} onChange={(event) => setNewTeacher({ ...newTeacher, name: event.target.value })} placeholder="Contoh: Siti Aminah" /></label>
                  <label>Username<input required autoComplete="off" value={newTeacher.username} onChange={(event) => setNewTeacher({ ...newTeacher, username: event.target.value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") })} placeholder="Contoh: siti.aminah" /></label>
                </div>
                <div className="assignment-builder">
                  <div className="assignment-builder-heading"><strong>Penugasan mengajar</strong><span>{newTeacher.assignments.length} ditambahkan</span></div>
                  <div className="assignment-entry">
                    <label>Mata pelajaran<input list="subject-options" value={assignmentDraft.subject} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, subject: event.target.value })} placeholder="Contoh: IPA" /></label>
                    <label>Tingkat<select value={assignmentDraft.grade} onChange={(event) => setAssignmentDraft({ ...assignmentDraft, grade: event.target.value as GradeLevel })}>{GRADE_LEVELS.map((grade) => <option key={grade} value={grade}>Tingkat {grade}</option>)}</select></label>
                    <button className="button button-secondary" type="button" onClick={addTeachingAssignment} disabled={!assignmentDraft.subject.trim()}><Plus size={15} /> Tambah</button>
                    <datalist id="subject-options">{assignmentSubjects.map((subject) => <option key={subject} value={subject} />)}</datalist>
                  </div>
                  <div className="assignment-chips">{newTeacher.assignments.map((assignment, index) => <span className="assignment-chip" key={`${getAssignmentKey(assignment)}-${index}`}>{assignment.subject} · Tingkat {assignment.grade}<button type="button" onClick={() => setNewTeacher((current) => ({ ...current, assignments: current.assignments.filter((_, assignmentIndex) => assignmentIndex !== index) }))} aria-label={`Hapus penugasan ${assignment.subject} tingkat ${assignment.grade}`}><X size={13} /></button></span>)}</div>
                  <p className="teacher-password-note">Kata sandi awal akun guru baru: <strong>guru12345</strong></p>
                </div>
                {teacherFormError && <div className="login-error" role="alert">{teacherFormError}</div>}
                <button className="button button-primary" type="submit" disabled={newTeacher.assignments.length === 0}><Plus size={16} /> Tambahkan guru</button>
              </form>
            </section>
          </div>
        ) : (
          <div className="content">
            <div className="page-heading">
              <div>
                <div className="eyebrow"><GraduationCap size={15} /> {role === "admin" ? "PANEL ADMINISTRATOR" : "RUANG GURU"}</div>
                <h1>{role === "admin" ? "Bank soal sekolah" : "Bank soal saya"}</h1>
                <p>{role === "admin" ? "Pantau dan ekspor kumpulan soal dari seluruh guru." : <>Halo, {activeTeacher?.name.split(" ")[0]}. Siapkan soal terbaik untuk kelasmu.</>}</p>
              </div>
              {role === "guru" && <button className="button button-primary add-question-top" onClick={openNewQuestion}><Plus size={17} /> Buat soal</button>}
            </div>

            <div className="stats-row">
              <div className="stat-block"><span className="stat-icon stat-icon-green"><FileText size={17} /></span><div><span className="stat-label">Total soal</span><strong>{role === "admin" ? questions.length : questions.filter((question) => question.teacherId === activeTeacher?.id).length}</strong></div><span className="stat-note">tersimpan</span></div>
              <div className="stat-block"><span className="stat-icon stat-icon-orange"><BookOpenCheck size={17} /></span><div><span className="stat-label">Mapel diampu</span><strong>{role === "admin" ? availableSubjects.length : new Set(activeTeacher?.assignments.map((assignment) => assignment.subject)).size}</strong></div><span className="stat-note">aktif</span></div>
              <div className="stat-block"><span className="stat-icon stat-icon-sage"><Check size={17} /></span><div><span className="stat-label">Siap diekspor</span><strong>{visibleQuestions.length}</strong></div><span className="stat-note">soal lengkap</span></div>
            </div>

            <div className="section-heading"><div><h2>Daftar soal</h2><p>Kelola, periksa, dan unduh soal dalam format Excel.</p></div><span className="last-saved"><span className="status-dot" /> {saveStatus === "saving" ? "Menyimpan..." : saveStatus === "error" ? "Belum tersimpan" : "Perubahan tersimpan"}</span></div>

            <section className="panel question-panel">
              <div className="table-toolbar">
                <div className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari soal atau mata pelajaran..." aria-label="Cari soal" />{search && <button onClick={() => setSearch("")} aria-label="Hapus pencarian"><X size={14} /></button>}</div>
                <div className="toolbar-actions">
                  <label className="filter-select"><span className="sr-only">Filter mata pelajaran</span><select value={filterSubject} onChange={(event) => setFilterSubject(event.target.value)}><option>Semua mapel</option>{availableSubjects.map((subject) => <option key={subject}>{subject}</option>)}</select><ChevronDown size={14} /></label>
                  {role === "admin" && <label className="filter-select"><span className="sr-only">Filter tingkat</span><select value={filterGrade} onChange={(event) => setFilterGrade(event.target.value)}><option value="Semua tingkat">Semua tingkat</option>{availableGrades.map((grade) => <option key={grade} value={grade}>Tingkat {grade}</option>)}</select><ChevronDown size={14} /></label>}
                  {role === "admin" && <button className="button button-primary" onClick={exportQuestions} disabled={!visibleQuestions.length}><ArrowDownToLine size={16} /> Ekspor Excel</button>}
                </div>
              </div>

              <div className="question-table-wrap">
                <table className="question-table">
                  <thead><tr><th className="number-column">NO.</th><th>SOAL</th>{role === "admin" && <th>GURU</th>}<th>MATA PELAJARAN</th><th>TINGKAT</th><th>JAWABAN BENAR</th><th>DIUBAH</th><th aria-label="Aksi" /></tr></thead>
                  <tbody>
                    {visibleQuestions.map((question, index) => <tr key={question.id} onClick={() => role === "guru" && editQuestion(question)} className={role === "guru" ? "clickable-row" : ""}>
                      <td className="number-cell">{String(index + 1).padStart(2, "0")}</td>
                      <td><div className="question-cell"><strong>{plainText(question.prompt)}</strong><span>{question.choices.length} pilihan jawaban</span></div></td>
                      {role === "admin" && <td><span className="teacher-cell">{question.teacher}</span></td>}
                      <td><span className="subject-pill">{question.subject}</span></td>
                      <td><span className="class-pill">{question.grade}</span></td>
                      <td><span className="answer-key"><span>{question.correct}</span> pilihan</span></td>
                      <td className="updated-cell">{question.updatedAt}</td>
                      <td>{role === "guru" && <button className="icon-button row-delete" aria-label="Hapus soal" title="Hapus soal" onClick={(event) => { event.stopPropagation(); setQuestions((current) => current.filter((item) => item.id !== question.id)); }}><Trash2 size={15} /></button>}</td>
                    </tr>)}
                  </tbody>
                </table>
                {visibleQuestions.length === 0 && <div className="empty-state"><div className="empty-icon"><FileSpreadsheet size={20} /></div><strong>Belum ada soal di sini</strong><span>Coba ubah pencarian atau tambahkan soal baru.</span>{role === "guru" && <button className="button button-primary" onClick={openNewQuestion}><Plus size={16} /> Buat soal pertama</button>}</div>}
              </div>
              <div className="table-footer"><span>Menampilkan <strong>{visibleQuestions.length}</strong> dari <strong>{role === "admin" ? questions.length : questions.filter((question) => question.teacherId === activeTeacher?.id).length}</strong> soal</span><span className="footer-caption"><ShieldCheck size={14} /> Data tersimpan di perangkat ini</span></div>
            </section>
          </div>
        )}
      </section>

      {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
        <section className="question-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-heading"><div><div className="eyebrow"><FileText size={14} /> EDITOR SOAL</div><h2 id="modal-title">{editingId ? "Ubah soal" : "Buat soal baru"}</h2><p>Lengkapi naskah dan empat pilihan jawaban.</p></div><button className="icon-button modal-close" onClick={() => setShowForm(false)} aria-label="Tutup"><X size={19} /></button></div>
          <div className="modal-scroll">
            <div className="question-context-grid"><div className="subject-field"><span>Mata pelajaran</span><div className="readonly-subject"><span className="subject-pill">{draft.subject}</span></div></div><div className="subject-field"><span>Tingkat</span><div className="readonly-subject"><span className="class-pill">{draft.grade}</span><span className="subject-helper">Mengikuti penugasan guru</span></div></div></div>
            <div className="editor-field"><div className="field-heading"><label>Naskah soal</label><span>Wajib diisi</span></div><TinyEditor value={draft.prompt} onChange={(prompt) => setDraft((current) => ({ ...current, prompt }))} placeholder="Tuliskan naskah soal di sini..." /></div>
            <div className="answer-section"><div className="field-heading"><label>Pilihan jawaban</label><span>Pilih satu jawaban benar</span></div>
              <div className="choice-list">{draft.choices.map((choice, index) => <div className={`choice-row ${draft.correct === choiceLabels[index] ? "correct-choice" : ""}`} key={choiceLabels[index]}>
                <button className="choice-toggle" onClick={() => setDraft({ ...draft, correct: choiceLabels[index] })} aria-label={`Tandai jawaban ${choiceLabels[index]} sebagai benar`} title={draft.correct === choiceLabels[index] ? "Jawaban benar" : "Tandai sebagai jawaban benar"}>{draft.correct === choiceLabels[index] ? <Check size={15} /> : choiceLabels[index]}</button>
                <div className="choice-editor"><TinyEditor compact value={choice} onChange={(value) => setDraft((current) => ({ ...current, choices: current.choices.map((item, choiceIndex) => choiceIndex === index ? value : item) as Question["choices"] }))} placeholder={`Tulis jawaban ${choiceLabels[index]}...`} /></div>
                {draft.correct === choiceLabels[index] && <span className="correct-label">Benar</span>}
              </div>)}</div>
            </div>
          </div>
          <div className="modal-footer"><span><span className="required-mark">*</span> Semua kolom wajib diisi</span><div><button className="button button-quiet" onClick={() => setShowForm(false)}>Batal</button><button className="button button-primary" onClick={saveQuestion}><Check size={16} /> {editingId ? "Simpan perubahan" : "Simpan soal"}</button></div></div>
        </section>
      </div>}
    </main>
  );
}
