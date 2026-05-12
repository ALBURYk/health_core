import { cookies } from "next/headers";
import { SESSION_COOKIE, getLeaders, getUserBySession, recordTraining } from "@/app/lib/database";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const user = await getUserBySession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!user) {
    return Response.json({ error: "Сначала войди в аккаунт" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const minutes = Number(body?.minutes);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return Response.json({ error: "Минуты тренировки должны быть больше 0" }, { status: 400 });
  }

  const updatedUser = await recordTraining(user.id, minutes);
  const leaders = await getLeaders();

  return Response.json({ user: updatedUser, leaders });
}
