import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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

  let sync = null;
  try {
    sync = await syncUserContests(session.user.id, "MANUAL");
  } catch (err) {
    return Response.json(
      {
        preference,
        syncError: String(err instanceof Error ? err.message : err),
      },
      { status: 207 }
    );
  }

  return Response.json({ preference, sync });
}
