import { NextResponse, type NextRequest } from "next/server";
import { buscar } from "@/lib/busca";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 300);
  const ataBruta = request.nextUrl.searchParams.get("ata");
  const ata = ataBruta && /^\d+$/.test(ataBruta) ? Number(ataBruta) : null;

  if (!q) {
    return NextResponse.json({ erro: "Informe uma pergunta em q." }, { status: 400 });
  }

  const resultados = buscar(q, ata, 5);
  return NextResponse.json(
    { q, ata, resultados },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
