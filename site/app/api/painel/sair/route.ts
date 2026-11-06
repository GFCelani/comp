import { NextResponse, type NextRequest } from "next/server";
import { pedidoVeioDaqui } from "@/lib/painel/guarda";
import { ehLocalhost, opcoesDoCookie } from "@/lib/painel/sessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!(await pedidoVeioDaqui())) {
    return NextResponse.json({ erro: "Pedido recusado." }, { status: 403 });
  }
  const resposta = NextResponse.json({ ok: true });
  const { name, ...opcoes } = opcoesDoCookie(ehLocalhost(request.headers.get("host")));
  resposta.cookies.set(name, "", { ...opcoes, maxAge: 0 });
  return resposta;
}
