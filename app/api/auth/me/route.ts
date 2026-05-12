import { cookies } from "next/headers";
import { SESSION_COOKIE, getUserBySession } from "@/app/lib/database";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getUserBySession(cookieStore.get(SESSION_COOKIE)?.value);

  return Response.json({ user });
}
