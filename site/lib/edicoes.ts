import "server-only";
import { dados as original, type DadosSite } from "./dados";
import { bancoConfigurado, estadoAtual, lerConfig, type Edicao } from "./painel/db";
import { textoDoParagrafo } from "./busca";
import { aplicarEdicoesTextos } from "./edicoesTextos";

/**
 * Edições do time, aplicadas por cima do JSON na hora de montar a página.
 * O JSON nunca muda. Se o banco não responder em 2 s, o site mostra o JSON.
 *
 * Campos e chaves:
 *  - "mudanca.trecho" / "mudanca.explicacao"  chave "<ata>.<índice>"
 *  - "impacto.texto"                           chave "<ata>"
 *  - "nota"                                    chave "<ata>.<parágrafo>"
 *  - "manchete.texto" / "manchete.linha_fina"  chave "<ata>"
 *  - "relatorio.paragrafo"                     chave "<ata>.<secao>.<i>"  (ver lib/edicoesTextos.ts)
 * As chaves levam o nº da ata: quando sai uma ata nova, edições da anterior deixam de valer.
 */

export type Revisados = {
  mudancas: Set<number>;
  impacto: boolean;
  notas: Set<string>;
  /** manchete.texto revisado pelo time. */
  manchete?: boolean;
  /** manchete.linha_fina revisada pelo time. */
  linhaFina?: boolean;
  /** Chaves "<ata>.<secao>.<i>" dos parágrafos do relatório revisados. */
  relatorioParagrafos?: Set<string>;
};

export type DadosRevisados = { dados: DadosSite; revisados: Revisados; fonteIndiceEscolhida: string | null };

const vazio = (): Revisados => ({
  mudancas: new Set(),
  impacto: false,
  notas: new Set(),
  manchete: false,
  linhaFina: false,
  relatorioParagrafos: new Set(),
});

function comTempoLimite<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, recusar) => setTimeout(() => recusar(new Error(`banco sem resposta em ${ms} ms`)), ms)),
  ]);
}

export function aplicarEdicoes(base: DadosSite, edicoes: Edicao[]): { dados: DadosSite; revisados: Revisados } {
  const d: DadosSite = structuredClone(base);
  const r = vazio();
  const ata = d.resumo.ultima_ata.numero;

  for (const e of edicoes) {
    if (e.campo === "mudanca.trecho" || e.campo === "mudanca.explicacao") {
      const [a, i] = e.chave.split(".").map(Number);
      const m = d.mudancas[i];
      if (a !== ata || !m) continue;
      if (e.campo === "mudanca.trecho") m.trecho = e.valor_novo;
      else m.explicacao = e.valor_novo;
      r.mudancas.add(i);
    } else if (e.campo === "impacto.texto") {
      if (Number(e.chave) !== ata) continue;
      d.impacto.texto = e.valor_novo;
      r.impacto = true;
    } else if (e.campo === "nota") {
      const [a, p] = e.chave.split(".").map(Number);
      const item = d.atas.find((x) => x.numero === a)?.paragrafos.find((x) => x.paragrafo === p);
      const nota = Number(e.valor_novo);
      if (!item || !Number.isInteger(nota) || nota < -2 || nota > 2) continue;
      item.nota = nota;
      r.notas.add(e.chave);
    }
  }
  const t = aplicarEdicoesTextos(d, edicoes);
  r.manchete = t.manchete;
  r.linhaFina = t.linhaFina;
  r.relatorioParagrafos = t.relatorioParagrafos;
  return { dados: d, revisados: r };
}

export async function obterDados(): Promise<DadosRevisados> {
  if (!bancoConfigurado()) return { dados: original, revisados: vazio(), fonteIndiceEscolhida: null };
  try {
    const [edicoes, config] = await comTempoLimite(Promise.all([estadoAtual(), lerConfig()]), 2000);
    const { dados, revisados } = aplicarEdicoes(original, edicoes);
    return { dados, revisados, fonteIndiceEscolhida: config.fonte_indice ?? null };
  } catch (e) {
    console.error("[edicoes] usando o JSON sem edições:", e);
    return { dados: original, revisados: vazio(), fonteIndiceEscolhida: null };
  }
}

const normalizarEspacos = (s: string) => s.replace(/\s+/g, " ").trim();

/** O trecho tem de ser cópia exata (ignorando espaços) do parágrafo original da ata. */
export function trechoValido(ata: number, paragrafo: number, trecho: string): { ok: true } | { ok: false; motivo: string } {
  const texto = textoDoParagrafo(ata, paragrafo);
  if (!texto) return { ok: false, motivo: `Parágrafo ${paragrafo} da ${ata}ª ata não encontrado no banco.` };
  const t = normalizarEspacos(trecho);
  if (!t) return { ok: false, motivo: "O trecho está vazio." };
  if (t.split(" ").length > 40) return { ok: false, motivo: "O trecho tem mais de 40 palavras. Cite só o necessário." };
  if (!normalizarEspacos(texto).includes(t)) {
    return {
      ok: false,
      motivo: `Este trecho não é cópia exata do parágrafo ${paragrafo} da ${ata}ª ata. Copie o texto como está na ata.`,
    };
  }
  return { ok: true };
}
