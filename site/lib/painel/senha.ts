import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Senha do painel em ADMIN_PASSWORD (variável de ambiente da Vercel).
 * Nunca é impressa nem devolvida. Sem ela, a edição fica desativada (falha fechada).
 */
export function senhaConfigurada(): string | null {
  const v = process.env.ADMIN_PASSWORD;
  return v && v.length > 0 ? v.normalize("NFKC") : null;
}

/** Compara em tempo constante. Os dois lados viram SHA-256 para ter o mesmo tamanho. */
export function conferirSenha(digitada: string): boolean {
  const certa = senhaConfigurada();
  if (!certa || typeof digitada !== "string" || digitada.length === 0 || digitada.length > 512) return false;
  const a = createHash("sha256").update(digitada.normalize("NFKC")).digest();
  const b = createHash("sha256").update(certa).digest();
  return timingSafeEqual(a, b);
}

/**
 * Chave do HMAC da sessão, derivada da própria senha: o usuário cadastra uma variável só.
 * Trocar a senha invalida todas as sessões abertas.
 */
export function segredoDaSessao(): Buffer | null {
  const certa = senhaConfigurada();
  if (!certa) return null;
  return createHmac("sha256", "sessao").update(certa).digest();
}
