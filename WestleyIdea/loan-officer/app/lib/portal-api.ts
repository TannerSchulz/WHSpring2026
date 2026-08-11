import "server-only";

import type { PortalUser } from "./auth";

export class PortalApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function portalApi<T>(path: string, user: PortalUser, init: RequestInit = {}): Promise<T> {
  const upstream = (process.env.API_UPSTREAM || "http://api").replace(/\/$/, "");
  const apiKey = process.env.PORTAL_API_KEY;
  if (!apiKey) throw new PortalApiError("The portal service credential is not configured.", 503);
  if (!user.email) throw new PortalApiError("The identity provider did not supply a verified email address.", 400);

  let response: Response;
  try {
    response = await fetch(`${upstream}/api/portal${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Portal-Api-Key": apiKey,
        "X-Portal-Subject": user.id,
        "X-Portal-Email": user.email,
        "X-Portal-Name": user.displayName,
        "X-Portal-Provider": user.provider,
        ...init.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new PortalApiError("The CRM service is temporarily unavailable.", 503);
  }

  const payload = await response.json().catch(() => null) as { detail?: string } | null;
  if (!response.ok) {
    throw new PortalApiError(payload?.detail || "The CRM request could not be completed.", response.status);
  }
  return payload as T;
}
