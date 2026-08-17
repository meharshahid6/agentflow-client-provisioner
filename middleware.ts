import { NextRequest, NextResponse } from "next/server";

const platformHosts = new Set(["localhost", "127.0.0.1", "agentflow-client-provisioner.pages.dev"]);

export function middleware(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? request.nextUrl.hostname).split(":")[0].toLowerCase();
  const path = request.nextUrl.pathname;
  if (platformHosts.has(hostname) || hostname.endsWith(".workers.dev") || path.startsWith("/_next/") || path.startsWith("/sites/") || path === "/favicon.ico") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/sites/${encodeURIComponent(hostname)}${path === "/" ? "" : path}`;
  return NextResponse.rewrite(url);
}

export const config = { matcher: "/((?!_next/static|_next/image).*)" };