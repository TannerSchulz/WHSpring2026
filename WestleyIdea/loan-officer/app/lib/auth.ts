import { headers } from "next/headers";

type EasyAuthClaim = {
  typ?: string;
  val?: string;
};

type EasyAuthPrincipal = {
  auth_typ?: string;
  claims?: EasyAuthClaim[];
};

export type PortalUser = {
  id: string;
  email: string | null;
  displayName: string;
  provider: string;
};

function decodePrincipal(value: string | null): EasyAuthPrincipal | null {
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as EasyAuthPrincipal;
  } catch {
    return null;
  }
}

function claimValue(principal: EasyAuthPrincipal | null, types: string[]): string | null {
  const claim = principal?.claims?.find((item) => item.typ && types.includes(item.typ));
  return claim?.val?.trim() || null;
}

export async function getPortalUser(): Promise<PortalUser | null> {
  const requestHeaders = await headers();
  const principal = decodePrincipal(requestHeaders.get("x-ms-client-principal"));
  const id = requestHeaders.get("x-ms-client-principal-id")?.trim()
    || claimValue(principal, ["sub", "oid", "http://schemas.microsoft.com/identity/claims/objectidentifier"]);

  if (!id) {
    if (process.env.NODE_ENV !== "production" && process.env.PORTAL_DEV_USER_ID) {
      return {
        id: process.env.PORTAL_DEV_USER_ID,
        email: process.env.PORTAL_DEV_USER_EMAIL || null,
        displayName: process.env.PORTAL_DEV_USER_NAME || "Development User",
        provider: "development",
      };
    }

    return null;
  }

  const principalName = requestHeaders.get("x-ms-client-principal-name")?.trim() || null;
  const email = claimValue(principal, [
    "email",
    "emails",
    "preferred_username",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  ]) || (principalName?.includes("@") ? principalName : null);
  const displayName = claimValue(principal, [
    "name",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  ]) || principalName || email || "MortgageAI User";

  return {
    id,
    email,
    displayName,
    provider: principal?.auth_typ || "externalid",
  };
}
