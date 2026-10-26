import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rotas públicas de autenticação não precisam de verificação/bloqueio no middleware
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/cadastrar") ||
    pathname.startsWith("/recuperar") ||
    pathname.startsWith("/nova-senha") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  return createClient(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
