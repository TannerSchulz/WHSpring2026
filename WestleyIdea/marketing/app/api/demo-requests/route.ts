import { getDb } from "../../../db";
import { demoRequests } from "../../../db/schema";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    if (clean(payload.website, 200)) return Response.json({ ok: true }, { status: 201 });

    const firstName = clean(payload.firstName, 80);
    const lastName = clean(payload.lastName, 80);
    const email = clean(payload.email, 160).toLowerCase();
    const company = clean(payload.company, 160);
    const role = clean(payload.role, 80);
    const teamSize = clean(payload.teamSize, 80);
    const message = clean(payload.message, 1500);

    if (!firstName || !lastName || !company || !role || !teamSize || !emailPattern.test(email)) {
      return Response.json({ error: "Please complete all required fields with a valid work email." }, { status: 400 });
    }

    const db = getDb();
    const [created] = await db.insert(demoRequests).values({
      firstName,
      lastName,
      email,
      company,
      role,
      teamSize,
      message,
      source: "marketing-site",
    }).returning({ id: demoRequests.id });

    return Response.json({ ok: true, id: created.id }, { status: 201 });
  } catch (error) {
    const text = error instanceof Error ? error.message : "Unexpected error";
    const missingTable = text.includes("no such table") || text.includes("demo_requests");
    return Response.json(
      { error: missingTable ? "The request form is still being configured. Please try again shortly." : "We could not submit your request. Please try again." },
      { status: 500 },
    );
  }
}
