import {
  GATE_IDENTITY_HEADER,
  sessionBoundToGateIdentity,
  type GateIdentity,
  type GateLinkedAccount,
} from "./gate-identity.server.ts";

export function sessionRequestHeaders(request: Request, bearerToken?: string): Headers {
  const headers = new Headers();
  for (const name of [
    "cookie",
    "host",
    "x-forwarded-host",
    "x-forwarded-proto",
    "origin",
    GATE_IDENTITY_HEADER,
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const authorization = request.headers.get("authorization");
  if (bearerToken) headers.set("authorization", `Bearer ${bearerToken}`);
  else if (authorization) headers.set("authorization", authorization);
  return headers;
}

export function gateRequestSessionAllowed(
  accounts: readonly GateLinkedAccount[],
  identity: GateIdentity | null,
  hasIdentityHeader: boolean,
  providerId: string,
): boolean {
  if (hasIdentityHeader)
    return Boolean(identity && sessionBoundToGateIdentity(accounts, identity.sub, providerId));
  return !accounts.some((account) => account.providerId === providerId);
}
