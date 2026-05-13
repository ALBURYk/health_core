import { cookies } from "next/headers";
import { SESSION_COOKIE, getFoodScanHistory, getUserBySession } from "@/app/lib/database";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getUserBySession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!user) {
    return Response.json({ history: [] });
  }

  const history = await getFoodScanHistory(user.id);

  return Response.json({ history });
}
