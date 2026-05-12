import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSession,
  validateCredentials,
  verifyUser,
} from "@/app/lib/database";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = validateCredentials(body?.login, body?.password);

  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const user = await verifyUser(validation.login, validation.password);

  if (!user) {
    return Response.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  const token = await createSession(user.id);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === "production",
  });

  return Response.json({ user });
}
