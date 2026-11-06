import "server-only";
import postgres from "postgres";

/**
 * Banco do painel (Postgres/Neon via DATABASE_URL). Sem a variável, nada abre conexão
 * e o site público segue só com o JSON.
 */

export type Edicao = {
  id: number;
  criado_em: string;
  campo: string;
  chave: string;
  valor_antigo: string | null;
  valor_novo: string;
  motivo: string | null;
};

/**
 * A integração Neon da Vercel criou as variáveis com o prefixo `DATABASE_URL_`
 * (ex.: DATABASE_URL_DATABASE_URL). Ordem: DATABASE_URL explícita e depois as URLs com pooling
 * da integração. As versões sem pooling (UNPOOLED/NON_POOLING) ficam por último.
 */
const NOMES_URL = [
  "DATABASE_URL",
  "DATABASE_URL_DATABASE_URL",
  "DATABASE_URL_POSTGRES_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "DATABASE_URL_POSTGRES_URL_NON_POOLING",
];

function urlDoBanco(): string | null {
  for (const nome of NOMES_URL) {
    const v = process.env[nome]?.trim();
    if (v && /^postgres(ql)?:\/\//.test(v)) return v;
  }
  return null;
}

export function bancoConfigurado(): boolean {
  return urlDoBanco() !== null;
}

/** O Neon põe `channel_binding=require` na URL, que o driver não aceita. */
function urlParaODriver(bruta: string): string {
  try {
    const u = new URL(bruta);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return bruta;
  }
}

let cliente: ReturnType<typeof postgres> | null = null;
let tabelasProntas: Promise<void> | null = null;

function sql() {
  if (!cliente) {
    const url = urlDoBanco();
    if (!url) throw new Error("URL do banco ausente");
    cliente = postgres(urlParaODriver(url), {
      max: 1,
      ssl: "require",
      idle_timeout: 20,
      connect_timeout: 5,
      prepare: false,
    });
  }
  return cliente;
}

async function garantirTabelas(): Promise<void> {
  if (!tabelasProntas) {
    tabelasProntas = sql()
      .begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(728301)`;
        await tx`CREATE TABLE IF NOT EXISTS edicoes (
          id BIGSERIAL PRIMARY KEY,
          criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
          campo TEXT NOT NULL,
          chave TEXT NOT NULL,
          valor_antigo TEXT,
          valor_novo TEXT NOT NULL,
          motivo TEXT
        )`;
        await tx`CREATE INDEX IF NOT EXISTS edicoes_campo_chave ON edicoes (campo, chave, id DESC)`;
        await tx`CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`;
        await tx`CREATE TABLE IF NOT EXISTS painel_tentativas (
          id BIGSERIAL PRIMARY KEY,
          chave TEXT NOT NULL,
          em TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
        await tx`CREATE INDEX IF NOT EXISTS painel_tentativas_chave_em ON painel_tentativas (chave, em)`;
      })
      .then(() => undefined)
      .catch((e) => {
        tabelasProntas = null;
        throw e;
      });
  }
  return tabelasProntas;
}

export async function registrarEdicao(e: {
  campo: string;
  chave: string;
  valor_antigo: string | null;
  valor_novo: string;
  motivo: string | null;
}): Promise<Edicao> {
  await garantirTabelas();
  const [linha] = await sql()<Edicao[]>`
    INSERT INTO edicoes (campo, chave, valor_antigo, valor_novo, motivo)
    VALUES (${e.campo}, ${e.chave}, ${e.valor_antigo}, ${e.valor_novo}, ${e.motivo})
    RETURNING id, criado_em, campo, chave, valor_antigo, valor_novo, motivo`;
  return linha;
}

export async function listarEdicoes(limite = 100): Promise<Edicao[]> {
  await garantirTabelas();
  return sql()<Edicao[]>`
    SELECT id, criado_em, campo, chave, valor_antigo, valor_novo, motivo
    FROM edicoes ORDER BY id DESC LIMIT ${limite}`;
}

/** A edição mais recente de cada campo+chave: é o estado atual. O histórico nunca é apagado. */
export async function estadoAtual(): Promise<Edicao[]> {
  await garantirTabelas();
  return sql()<Edicao[]>`
    SELECT DISTINCT ON (campo, chave) id, criado_em, campo, chave, valor_antigo, valor_novo, motivo
    FROM edicoes ORDER BY campo, chave, id DESC`;
}

export async function lerConfig(): Promise<Record<string, string>> {
  await garantirTabelas();
  const linhas = await sql()<{ chave: string; valor: string }[]>`SELECT chave, valor FROM config`;
  return Object.fromEntries(linhas.map((l) => [l.chave, l.valor]));
}

export async function gravarConfig(chave: string, valor: string): Promise<void> {
  await garantirTabelas();
  await sql()`INSERT INTO config (chave, valor) VALUES (${chave}, ${valor})
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`;
}

/** Registra a tentativa e devolve quantas houve da mesma chave na janela. */
export async function contarTentativa(chave: string, janelaMs: number): Promise<number> {
  await garantirTabelas();
  const segundos = Math.floor(janelaMs / 1000);
  await sql()`DELETE FROM painel_tentativas WHERE em < now() - make_interval(secs => ${segundos * 4})`;
  await sql()`INSERT INTO painel_tentativas (chave) VALUES (${chave})`;
  const [{ n }] = await sql()<{ n: number }[]>`
    SELECT count(*)::int AS n FROM painel_tentativas
    WHERE chave = ${chave} AND em > now() - make_interval(secs => ${segundos})`;
  return n;
}

export async function limparTentativas(chave: string): Promise<void> {
  await garantirTabelas();
  await sql()`DELETE FROM painel_tentativas WHERE chave = ${chave}`;
}
