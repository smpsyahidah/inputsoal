import { createHmac, timingSafeEqual } from "node:crypto";
import type { DemoSession } from "@/lib/ruangsoal";

const COOKIE_NAME = "ruangsoal-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

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
