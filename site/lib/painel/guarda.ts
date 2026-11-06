import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { segredoDaSessao } from "./senha";
import { lerBilhete, NOME_COOKIE, type Sessao } from "./sessao";

export type Autorizacao = { ok: true; sessao: Sessao } | { ok: false; resposta: NextResponse };

function recusar(erro: string, status: number): { ok: false; resposta: NextResponse } {
  return { ok: false, resposta: NextResponse.json({ erro }, { status }) };
}

/** Segunda barreira contra pedido forjado de outro site (além do SameSite=Strict). */
export async function pedidoVeioDaqui(): Promise<boolean> {
  const h = await headers();
  const local = h.get("sec-fetch-site");
  if (local) return local === "same-origin" || local === "none";
  const origem = h.get("origin");
  if (!origem) return false;
  try {
    return new URL(origem).host === h.get("host");
  } catch {
    return false;
  }
}

/** Primeira linha de toda rota de `api/painel/**` (exceto entrar). */
export async function exigirSessao(): Promise<Autorizacao> {
  const segredo = segredoDaSessao();
  if (!segredo) return recusar("Edição desativada: ADMIN_PASSWORD não configurada.", 503);
  if (!(await pedidoVeioDaqui())) return recusar("Pedido recusado.", 403);
  const sessao = lerBilhete((await cookies()).get(NOME_COOKIE)?.value, segredo);
  if (!sessao) return recusar("Faça login para continuar.", 401);
  return { ok: true, sessao };
}

export async function sessaoAtual(): Promise<Sessao | null> {
  const segredo = segredoDaSessao();
  if (!segredo) return null;
  return lerBilhete((await cookies()).get(NOME_COOKIE)?.value, segredo);
}
