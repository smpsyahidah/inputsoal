import { getSession } from "@/lib/auth";
import {
  getStoredData,
  updateStoredData,
  type StoredData,
} from "@/lib/database";
import {
  normalizeQuestion,
  normalizeTeacher,
  type Question,
  type Teacher,
} from "@/lib/ruangsoal";

type DataBody = {
  questions?: unknown;
  teachers?: unknown;
  migration?: boolean;
  revision?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseData(body: DataBody): StoredData | null {
  if (!Array.isArray(body.questions) || !Array.isArray(body.teachers)) return null;
  if (body.questions.length > 10000 || body.teachers.length > 1000) return null;

  if (!body.teachers.every(isRecord) || !body.questions.every(isRecord)) return null;
  if (!body.teachers.every((teacher) => (
    (teacher.id === undefined || typeof teacher.id === "string") &&
    (teacher.name === undefined || typeof teacher.name === "string") &&
    (teacher.username === undefined || typeof teacher.username === "string") &&
    (teacher.email === undefined || typeof teacher.email === "string") &&
    (teacher.subject === undefined || typeof teacher.subject === "string") &&
    (teacher.assignments === undefined || (
      Array.isArray(teacher.assignments) &&
      teacher.assignments.every((assignment) =>
        isRecord(assignment) &&
        typeof assignment.subject === "string" &&
        (assignment.grade === undefined || typeof assignment.grade === "string") &&
        (assignment.className === undefined || typeof assignment.className === "string") &&
        (assignment.level === undefined || typeof assignment.level === "string"),
      )
    ))
  ))) return null;
  if (!body.questions.every((question) => (
    Object.entries(question).every(([key, value]) =>
      key === "choices" ? Array.isArray(value) : value === undefined || typeof value === "string",
    ) &&
    (question.correct === undefined || ["A", "B", "C", "D"].includes(String(question.correct))) &&
    (question.choices === undefined || (
      Array.isArray(question.choices) &&
      question.choices.length === 4 &&
      question.choices.every((choice) => typeof choice === "string")
    ))
  ))) return null;

  const teachers = body.teachers.map((teacher) => normalizeTeacher(teacher as Partial<Teacher>));
  if (new Set(teachers.map((teacher) => teacher.id)).size !== teachers.length) return null;
  if (new Set(teachers.map((teacher) => teacher.username.toLowerCase())).size !== teachers.length) return null;
  const questions = body.questions.map((question) =>
    normalizeQuestion(question as Partial<Question>, teachers),
  );
  if (new Set(questions.map((question) => question.id)).size !== questions.length) return null;
  return { questions, teachers };
}

export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 });

  const stored = await getStoredData();
  const data = stored.data;
  if (session.role === "admin") return Response.json({ ...data, revision: stored.revision });

  const teacher = data.teachers.find((item) => item.id === session.teacherId);
  if (!teacher) return Response.json({ error: "Akun guru tidak lagi tersedia." }, { status: 401 });
  return Response.json({
    teachers: [teacher],
    questions: data.questions.filter((question) => question.teacherId === teacher.id),
    revision: stored.revision,
  });
}

export async function PUT(request: Request) {
  const session = getSession(request);
  if (!session) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 });

  const body = await request.json().catch(() => null) as DataBody | null;
  const incoming = body && parseData(body);
  if (!incoming) return Response.json({ error: "Format data tidak valid." }, { status: 400 });

  if (
    typeof body.revision !== "number" ||
    !Number.isInteger(body.revision) ||
    body.revision < 1
  ) {
    return Response.json({ error: "Versi data tidak valid. Muat ulang halaman." }, { status: 400 });
  }
  const stored = await updateStoredData((current) => {
    if (session.role === "admin") return incoming;

    const currentTeacher = current.teachers.find((teacher) => teacher.id === session.teacherId);
    if (!currentTeacher) return current;
    const permittedQuestions = incoming.questions.filter(
      (question) => question.teacherId === currentTeacher.id,
    );
    return {
      teachers: current.teachers,
      questions: [
        ...current.questions.filter((question) => question.teacherId !== currentTeacher.id),
        ...permittedQuestions,
      ],
    };
  }, body.revision);
  if (!stored) {
    return Response.json(
      { error: "Data telah berubah di browser lain. Muat ulang halaman sebelum menyimpan lagi." },
      { status: 409 },
    );
  }

  if (session.role === "guru" && !stored.data.teachers.some((teacher) => teacher.id === session.teacherId)) {
    return Response.json({ error: "Akun guru tidak lagi tersedia." }, { status: 401 });
  }
  return Response.json({ saved: true, revision: stored.revision });
}

export async function POST(request: Request) {
  const session = getSession(request);
  if (!session) return Response.json({ error: "Silakan masuk kembali." }, { status: 401 });
  if (session.role !== "admin") {
    return Response.json({ error: "Hanya administrator yang dapat memigrasikan data." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as DataBody | null;
  if (!body?.migration) return Response.json({ error: "Permintaan migrasi tidak valid." }, { status: 400 });
  const incoming = parseData(body);
  if (!incoming) return Response.json({ error: "Format data migrasi tidak valid." }, { status: 400 });

  const stored = await updateStoredData((current) => {
    const teachersById = new Map(current.teachers.map((teacher) => [teacher.id, teacher]));
    incoming.teachers.forEach((teacher) => teachersById.set(teacher.id, teacher));
    const teachers = Array.from(teachersById.values());
    const questionsById = new Map(current.questions.map((question) => [question.id, question]));
    incoming.questions
      .map((question) => normalizeQuestion(question, teachers))
      .forEach((question) => questionsById.set(question.id, question));
    return { teachers, questions: Array.from(questionsById.values()) };
  });
  if (!stored) return Response.json({ error: "Data migrasi gagal disimpan." }, { status: 500 });
  return Response.json({ migrated: true, revision: stored.revision });
}
