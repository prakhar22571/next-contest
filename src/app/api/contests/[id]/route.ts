import { auth } from "@/auth";
import { removeUserContest } from "@/lib/sync/removeUserContest";
import { errorMessage } from "@/lib/util";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Sign in to remove calendar events." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const result = await removeUserContest(session.user.id, id);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[calendar] contest removal failed:", errorMessage(err));
    return Response.json(
      { error: "Could not remove this event. Please try again. If the problem continues, sign out and sign in with Google again." },
      { status: 502 }
    );
  }
}
