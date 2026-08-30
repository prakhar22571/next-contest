import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { daysFromNow, errorMessage } from "@/lib/util";
import { fetchContests } from "@/lib/contests";
import { preferencesSchema } from "@/lib/validation/preferences";
import { syncUserContests } from "@/lib/sync/syncUser";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const preference = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });
  return Response.json({ preference });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const parsed = preferencesSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { platforms, daysAhead, timeZone } = parsed.data;

  const preference = await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, platforms, daysAhead, timeZone },
    update: { platforms, daysAhead, timeZone },
  });

  try {
    const contests = await fetchContests({
      resources: platforms,
      startGte: new Date(),
      startLte: daysFromNow(daysAhead),
    });
    const sync = await syncUserContests(session.user.id, "MANUAL", contests);
    return Response.json({ preference, sync });
  } catch (err) {
    return Response.json({ preference, syncError: errorMessage(err) }, { status: 207 });
  }
}
