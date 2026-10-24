export type Role = "admin" | "guru";

export type TeachingAssignment = {
  subject: string;
  grade: GradeLevel;
};

export type GradeLevel = "VII" | "VIII" | "IX";

export type Teacher = {
  id: string;
  name: string;
  username: string;
  assignments: TeachingAssignment[];
};

export type Question = {
  id: string;
  subject: string;
  grade: GradeLevel;
  teacherId: string;
  teacher: string;
  prompt: string;
  choices: [string, string, string, string];
  correct: "A" | "B" | "C" | "D";
  updatedAt: string;
};

export type DemoSession = {
  role: Role;
  teacherId?: string;
};

export const SCHOOL = {
  name: "SMP Syarif Hidayatullah",
  address: "Jl. Ki Gede Mayaguna No.01 Pasalakan",
};

export const STORAGE_KEY = "ruangsoal-v1";
export const SESSION_KEY = "ruangsoal-session-v1";
export const GRADE_LEVELS: GradeLevel[] = ["VII", "VIII", "IX"];
export const DEFAULT_GRADE: GradeLevel = "VII";

export const starterTeachers: Teacher[] = [
  {
    id: "t-01",
    name: "Nadia Putri",
    username: "nadia",
    assignments: [
      { subject: "Matematika", grade: "VII" },
      { subject: "Matematika", grade: "VIII" },
      { subject: "IPA", grade: "VII" },
    ],
  },
  {
    id: "t-02",
    name: "Raka Pratama",
    username: "raka",
    assignments: [
      { subject: "Bahasa Indonesia", grade: "VII" },
      { subject: "Bahasa Indonesia", grade: "VIII" },
      { subject: "PPKn", grade: "VII" },
    ],
  },
  {
    id: "t-03",
    name: "Dewi Lestari",
    username: "dewi",
    assignments: [
      { subject: "IPA", grade: "VII" },
      { subject: "IPA", grade: "VIII" },
      { subject: "Matematika", grade: "IX" },
    ],
  },
];

export const starterQuestions: Question[] = [
  {
    id: "q-01",
    subject: "Matematika",
    grade: "VII",
    teacherId: "t-01",
    teacher: "Nadia Putri",
    prompt: "Hasil dari 3/4 + 2/3 adalah ...",
    choices: ["17/12", "5/7", "6/12", "13/12"],
    correct: "A",
    updatedAt: "Hari ini, 09.42",
  },
  {
    id: "q-02",
    subject: "Matematika",
    grade: "VIII",
    teacherId: "t-01",
    teacher: "Nadia Putri",
    prompt: "Jika 2x + 5 = 17, nilai x adalah ...",
    choices: ["5", "6", "7", "8"],
    correct: "B",
    updatedAt: "Kemarin, 15.18",
  },
  {
    id: "q-03",
    subject: "Bahasa Indonesia",
    grade: "VII",
    teacherId: "t-02",
    teacher: "Raka Pratama",
    prompt: "Gagasan utama dalam sebuah paragraf disebut ...",
    choices: ["Kalimat penjelas", "Kata penghubung", "Ide pokok", "Simpulan"],
    correct: "C",
    updatedAt: "Kemarin, 13.06",
  },
  {
    id: "q-04",
    subject: "IPA",
    grade: "VII",
    teacherId: "t-03",
    teacher: "Dewi Lestari",
    prompt: "Perubahan wujud dari cair menjadi gas disebut ...",
    choices: ["Membeku", "Menguap", "Mengembun", "Menyublim"],
    correct: "B",
    updatedAt: "22 Okt 2026, 10.31",
  },
];

type LegacyTeacher = Partial<Teacher> & { email?: string; subject?: string };
type LegacyQuestion = Partial<Question> & { teacher?: string; class?: string; className?: string; level?: string };

function normalizeGrade(value: string | undefined, fallback: GradeLevel = DEFAULT_GRADE): GradeLevel {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "VII" || normalized.startsWith("VII-")) return "VII";
  if (normalized === "VIII" || normalized.startsWith("VIII-")) return "VIII";
  if (normalized === "IX" || normalized.startsWith("IX-")) return "IX";
  if (normalized === "7") return "VII";
  if (normalized === "8") return "VIII";
  if (normalized === "9") return "IX";
  return fallback;
}

export function normalizeTeacher(value: LegacyTeacher): Teacher {
  const fallback = starterTeachers.find((teacher) => teacher.id === value.id);
  const assignments = Array.isArray(value.assignments)
    ? value.assignments
      .filter((assignment) => assignment.subject)
      .map((assignment) => ({
        subject: assignment.subject,
        grade: normalizeGrade((assignment as TeachingAssignment & { className?: string; level?: string }).grade
          ?? (assignment as TeachingAssignment & { className?: string; level?: string }).className
          ?? (assignment as TeachingAssignment & { className?: string; level?: string }).level),
      }))
    : fallback?.assignments ?? (value.subject
      ? [{ subject: value.subject, grade: DEFAULT_GRADE }]
      : []);

  return {
    id: value.id ?? crypto.randomUUID(),
    name: value.name ?? "Guru",
    username: value.username ?? fallback?.username ?? value.email?.split("@")[0] ?? "",
    assignments,
  };
}

export function normalizeQuestion(value: LegacyQuestion, teachers: Teacher[]): Question {
  const teacher = teachers.find(
    (item) => item.id === value.teacherId || item.name === value.teacher,
  );
  const fallback = starterQuestions.find((item) => item.id === value.id);

  return {
    id: value.id ?? crypto.randomUUID(),
    subject: value.subject ?? fallback?.subject ?? "Matematika",
    grade: normalizeGrade(value.grade ?? value.level ?? value.className ?? value.class, fallback?.grade),
    teacherId: value.teacherId ?? teacher?.id ?? fallback?.teacherId ?? "",
    teacher: value.teacher ?? teacher?.name ?? fallback?.teacher ?? "Guru",
    prompt: value.prompt ?? fallback?.prompt ?? "",
    choices: (value.choices ?? fallback?.choices ?? ["", "", "", ""]) as Question["choices"],
    correct: value.correct ?? fallback?.correct ?? "A",
    updatedAt: value.updatedAt ?? fallback?.updatedAt ?? "",
  };
}