import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  createAccountPasswordHashIfMissing,
  getAccountPasswordHash,
  setAccountPasswordHash,
} from "@/lib/database";
import type { DemoSession } from "@/lib/ruangsoal";

const COOKIE_NAME = "ruangsoal-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const PASSWORD_KEY_LENGTH = 64;
const scryptAsync = promisify(scrypt);

export type LoginCredentials = {
  adminUsername: string;
  adminPassword: string | null;
  teacherPassword: string | null;
};

export function getLoginCredentials(): LoginCredentials {
  const isProduction = process.env.NODE_ENV === "production";
  const adminUsername = process.env.RUANGSOAL_ADMIN_USERNAME ?? (isProduction ? "" : "admin");
  const adminPassword = process.env.RUANGSOAL_ADMIN_PASSWORD ?? (isProduction ? null : "admin12345");
  const teacherPassword = process.env.RUANGSOAL_TEACHER_PASSWORD ?? (isProduction ? null : "guru12345");

  if (!adminUsername.trim()) {
    throw new Error("RUANGSOAL_ADMIN_USERNAME harus diatur di environment server.");
  }

  return { adminUsername: adminUsername.trim(), adminPassword, teacherPassword };
}

function passwordAccountId(session: DemoSession) {
  return session.role === "admin" ? "admin" : `teacher:${session.teacherId}`;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function matchesPassword(password: string, encodedHash: string) {
  const [algorithm, saltValue, hashValue] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue) return false;

  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(hashValue, "base64url");
  if (!salt.length || expected.length !== PASSWORD_KEY_LENGTH) return false;

  const actual = await scryptAsync(password, salt, PASSWORD_KEY_LENGTH) as Buffer;
  return timingSafeEqual(expected, actual);
}

export async function verifyAccountPassword(
  accountId: string,
  password: string,
  initialPassword: string | null,
) {
  let encodedHash = await getAccountPasswordHash(accountId);
  if (!encodedHash) {
    if (!initialPassword) {
      throw new Error("Password awal belum diatur. Isi variabel password di Vercel untuk bootstrap akun.");
    }
    if (password !== initialPassword) return false;
    const minimumLength = process.env.NODE_ENV === "production" ? 12 : 8;
    if (initialPassword.length < minimumLength) {
      throw new Error(`Password awal harus terdiri dari minimal ${minimumLength} karakter.`);
    }
    encodedHash = await createAccountPasswordHashIfMissing(accountId, await hashPassword(initialPassword));
  }

  if (!encodedHash) throw new Error("Password akun gagal disiapkan.");
  return matchesPassword(password, encodedHash);
}

export async function updateAccountPassword(accountId: string, password: string) {
  await setAccountPasswordHash(accountId, await hashPassword(password));
}

export function getPasswordAccountId(session: DemoSession) {
  return passwordAccountId(session);
}

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET harus diatur dan memiliki minimal 32 karakter.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createSessionCookie(session: DemoSession) {
  const payload = Buffer.from(
    JSON.stringify({ ...session, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 }),
  ).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function getSession(request: Request): DemoSession | null {
  const cookieHeader = request.headers.get("cookie");
  const token = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as DemoSession & {
      expiresAt?: number;
    };
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) return null;
    if (parsed.role === "admin") return { role: "admin" };
    if (parsed.role === "guru" && typeof parsed.teacherId === "string") {
      return { role: "guru", teacherId: parsed.teacherId };
    }
  } catch {
    return null;
  }

  return null;
}
