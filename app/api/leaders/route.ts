import { getLeaders } from "@/app/lib/database";

export async function GET() {
  const leaders = await getLeaders();

  return Response.json({ leaders });
}
