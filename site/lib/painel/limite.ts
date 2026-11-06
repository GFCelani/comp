import "server-only";
import { bancoConfigurado, contarTentativa, limparTentativas } from "./db";

/**
 * 8 tentativas de senha por IP a cada 15 minutos. Conta em memória (atalho e reserva)
 * e na tabela painel_tentativas (vale entre instâncias serverless).
 * Na Vercel o IP vem de `x-vercel-forwarded-for`, escrito pela plataforma.
 */

export const JANELA_MS = 15 * 60 * 1000;
export const LIMITE = 8;
const LIMITE_SEM_IP = 200;
const SEM_IP = "sem-ip-confiavel";

export function ipDaRequisicao(h: Headers): string | null {
  if (process.env.VERCEL === "1") {
    const ip = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (ip) return ip;
  }
  return null;
}

/** IPv6 conta pelo /64: trocar de endereço dentro do bloco não zera o limite. */
function chaveDoIp(ip: string): string {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) return v4[1];
  if (!s.includes(":")) return s;
  return s.split(":").slice(0, 4).join(":") + "::/64";
}

const memoria = new Map<string, number[]>();

function contarEmMemoria(chave: string, agora: number): number {
  const marcas = (memoria.get(chave) ?? []).filter((m) => m > agora - JANELA_MS);
  marcas.push(agora);
  memoria.set(chave, marcas);
  if (memoria.size > 5000) memoria.delete(memoria.keys().next().value as string);
  return marcas.length;
}

/** Conta ANTES de conferir a senha. */
export async function registrarTentativa(ip: string | null): Promise<{ permitido: boolean }> {
  const chave = ip ? chaveDoIp(ip) : SEM_IP;
  const limite = ip ? LIMITE : LIMITE_SEM_IP;
  const naMemoria = contarEmMemoria(chave, Date.now());
  let total = naMemoria;
  if (naMemoria <= limite && bancoConfigurado()) {
    try {
      total = Math.max(total, await contarTentativa(chave, JANELA_MS));
    } catch (e) {
      console.error("[painel] contador no banco indisponível, usando memória:", e);
    }
  }
  return { permitido: total <= limite };
}

export async function esquecerTentativas(ip: string | null): Promise<void> {
  if (!ip) return;
  const chave = chaveDoIp(ip);
  memoria.delete(chave);
  if (bancoConfigurado()) {
    try {
      await limparTentativas(chave);
    } catch {
      /* não impede o login */
    }
  }
}
