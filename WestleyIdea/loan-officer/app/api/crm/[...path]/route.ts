import { NextRequest, NextResponse } from "next/server";

import { getPortalUser } from "../../../lib/auth";
import { PortalApiError, portalApi } from "../../../lib/portal-api";

type RouteContext = { params: Promise<{ path: string[] }> };

function isAllowed(method: string, path: string) {
  if (method === "POST" && /^(organizations|links)$/.test(path)) return true;
  if (method === "POST" && path === "team/invitations") return true;
  if (method === "POST" && /^borrowers\/[0-9a-f-]{36}\/notes$/i.test(path)) return true;
  if (method === "PATCH" && /^borrowers\/[0-9a-f-]{36}\/status$/i.test(path)) return true;
  if (method === "PATCH" && /^team\/members\/[0-9a-f-]{36}$/i.test(path)) return true;
  if (method === "PATCH" && path === "settings/workspace") return true;
  if (method === "PUT" && /^(branding|settings\/profile)$/.test(path)) return true;
  return false;
}

async function proxy(request: NextRequest, context: RouteContext) {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const path = (await context.params).path.join("/");
  if (!isAllowed(request.method, path)) {
    return NextResponse.json({ error: "CRM operation is not available." }, { status: 404 });
  }

  try {
    const body = await request.text();
    const payload = await portalApi<unknown>(`/${path}`, user, {
      method: request.method,
      body: body || undefined,
    });
    return NextResponse.json(payload, { status: request.method === "POST" ? 201 : 200 });
  } catch (error) {
    if (error instanceof PortalApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "CRM operation failed." }, { status: 500 });
  }
}

export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
