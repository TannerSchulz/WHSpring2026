import { NextResponse } from "next/server";

import { getPortalUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getPortalUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authenticated identity headers were not provided." },
      { status: 401 },
    );
  }

  return NextResponse.json({ user });
}
