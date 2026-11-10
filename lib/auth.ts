// Single-user login: one password (APP_PASSWORD) and a signed cookie.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "jt_session";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compare two strings without leaking where they differ. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The cookie value that proves a login. Changes when the password or secret changes. */
export async function expectedSession(): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!password || !secret) return null;
  return sha256Hex(`job-tracker:v1:${secret}:${password}`);
}

export async function isValidSession(value: string | undefined): Promise<boolean> {
  const expected = await expectedSession();
  return !!expected && !!value && safeEqual(value, expected);
}

/** Call at the top of every server action and protected page. */
export async function requireAuth(): Promise<void> {
  const jar = await cookies();
  if (!(await isValidSession(jar.get(SESSION_COOKIE)?.value))) redirect("/login");
}
