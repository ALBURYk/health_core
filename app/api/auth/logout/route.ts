import { cookies } from "next/headers";
import { SESSION_COOKIE, deleteSession } from "@/app/lib/database";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  await deleteSession(token);
  cookieStore.delete(SESSION_COOKIE);

  return Response.json({ ok: true });
}
