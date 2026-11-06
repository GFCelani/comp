import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Sessão sem estado: cookie com `dados.assinatura`, onde dados = base64url de
 * {v, criadaEm, expiraEm, id} e assinatura = HMAC-SHA256 com o segredo do servidor.
 */

export const NOME_COOKIE = "copom_painel";
export const DURACAO_MS = 8 * 60 * 60 * 1000;
const VERSAO = "1";

export type Sessao = { criadaEm: number; expiraEm: number };

function assinar(dados: string, segredo: Buffer): string {
  return createHmac("sha256", segredo).update(dados).digest("base64url");
}

export function criarBilhete(segredo: Buffer, agora = Date.now()): string {
  const carga = { v: VERSAO, criadaEm: agora, expiraEm: agora + DURACAO_MS, id: randomBytes(9).toString("base64url") };
  const dados = Buffer.from(JSON.stringify(carga)).toString("base64url");
  return `${dados}.${assinar(dados, segredo)}`;
}

export function lerBilhete(bilhete: string | undefined, segredo: Buffer | null, agora = Date.now()): Sessao | null {
  if (!bilhete || !segredo) return null;
  const i = bilhete.lastIndexOf(".");
  if (i <= 0) return null;
  const dados = bilhete.slice(0, i);
  const a = Buffer.from(bilhete.slice(i + 1));
  const b = Buffer.from(assinar(dados, segredo));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const c = JSON.parse(Buffer.from(dados, "base64url").toString("utf8"));
    if (c?.v !== VERSAO || typeof c.criadaEm !== "number" || typeof c.expiraEm !== "number") return null;
    if (c.expiraEm <= agora || c.expiraEm - c.criadaEm > DURACAO_MS) return null;
    return { criadaEm: c.criadaEm, expiraEm: c.expiraEm };
  } catch {
    return null;
  }
}

/** Só localhost recebe cookie sem `secure`; o critério é o endereço, não o NODE_ENV. */
export function ehLocalhost(host: string | null | undefined): boolean {
  if (!host) return false;
  try {
    const nome = new URL(`http://${host}`).hostname.toLowerCase();
    return nome === "localhost" || nome === "127.0.0.1" || nome === "[::1]";
  } catch {
    return false;
  }
}

export function opcoesDoCookie(emLocalhost: boolean) {
  return {
    name: NOME_COOKIE,
    httpOnly: true,
    secure: !emLocalhost,
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.floor(DURACAO_MS / 1000),
  };
}
