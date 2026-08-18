import { NextRequest, NextResponse } from "next/server";

const platformHosts = new Set([
  "localhost",
  "127.0.0.1",
  "agentflow-client-provisioner.pages.dev",
]);

export function middleware(request: NextRequest) {
  const requestHostname = (
    request.headers.get("host") ?? request.nextUrl.hostname
  )
    .split(":")[0]
    .toLowerCase();
  const hostname = requestHostname.replace(/^www\./, "");

  const path = request.nextUrl.pathname;

  if (
    platformHosts.has(requestHostname) ||
    requestHostname.endsWith(".workers.dev") ||
    path.startsWith("/_next/") ||
    path.startsWith("/sites/") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/sites/${encodeURIComponent(hostname)}${
    path === "/" ? "" : path
  }`;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-agentflow-public-site", "1");
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: "/((?!_next/static|_next/image).*)",
};