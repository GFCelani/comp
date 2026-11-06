import { NextResponse, type NextRequest } from "next/server";
import { conferirSenha, segredoDaSessao } from "@/lib/painel/senha";
import { criarBilhete, ehLocalhost, opcoesDoCookie } from "@/lib/painel/sessao";
import { pedidoVeioDaqui } from "@/lib/painel/guarda";
import { esquecerTentativas, ipDaRequisicao, registrarTentativa } from "@/lib/painel/limite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const segredo = segredoDaSessao();
  if (!segredo) {
    return NextResponse.json({ erro: "Edição desativada: ADMIN_PASSWORD não configurada." }, { status: 503 });
  }
  if (!(await pedidoVeioDaqui())) {
    return NextResponse.json({ erro: "Pedido recusado." }, { status: 403 });
  }

  const ip = ipDaRequisicao(request.headers);
  const { permitido } = await registrarTentativa(ip);
  if (!permitido) {
    return NextResponse.json(
      { erro: "Muitas tentativas. Espere 15 minutos e tente de novo." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  let senha = "";
  try {
    const corpo = (await request.json()) as { senha?: unknown };
    senha = typeof corpo.senha === "string" ? corpo.senha : "";
  } catch {
    /* corpo inválido conta como senha errada */
  }

  if (!conferirSenha(senha)) {
    return NextResponse.json({ erro: "Senha incorreta." }, { status: 401 });
  }

  await esquecerTentativas(ip);
  const resposta = NextResponse.json({ ok: true });
  const { name, ...opcoes } = opcoesDoCookie(ehLocalhost(request.headers.get("host")));
  resposta.cookies.set(name, criarBilhete(segredo), opcoes);
  return resposta;
}
