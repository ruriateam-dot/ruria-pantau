import { NextResponse, type NextRequest } from "next/server";

// Pemeriksaan ringan: cek ada cookie sesi. Validasi sebenarnya di server (getUser).
export function middleware(request: NextRequest) {
  const has = !!request.cookies.get("rp_sesi")?.value;
  const path = request.nextUrl.pathname;
  if (!has && path.startsWith("/dashboard")) return NextResponse.redirect(new URL("/login", request.url));
  if (has && path === "/") return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/dashboard/:path*"] };
