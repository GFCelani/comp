"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import type { Citacao } from "@/lib/previsao";
import { dataCurta } from "@/lib/formato";

const SEPARADOR = /(\[\[[A-Za-z0-9_-]+\]\])/g;
const ESPACO_FINO = String.fromCharCode(0x2009); // entre marcas consecutivas
const ESPACO_CAPILAR = String.fromCharCode(0x200a); // entre a palavra e a marca
const MARCADOR_EXATO = /^\[\[([A-Za-z0-9_-]+)\]\]$/;

/** Ata mais citada no parágrafo (empate: a mais recente). */
function ataMaisComum(citacoes: Citacao[]): number | undefined {
  const contagem = new Map<number, number>();
  for (const c of citacoes) contagem.set(c.ata, (contagem.get(c.ata) ?? 0) + 1);
  let melhor: number | undefined;
  let max = 0;
  for (const [ata, n] of contagem) {
    if (n > max || (n === max && melhor !== undefined && ata > melhor)) {
      melhor = ata;
      max = n;
    }
  }
  return melhor;
}

type Lado = "duro" | "brando" | "neutro";

/** quente = duro (nota > 0), frio = brando (nota < 0) */
function ladoDe(nota: number | undefined): Lado {
  if (nota === undefined || nota === 0) return "neutro";
  return nota > 0 ? "duro" : "brando";
}

const CLASSE_MARCA: Record<Lado, { ativa: string; repouso: string }> = {
  duro: { ativa: "bg-duro text-papel", repouso: "bg-duro-suave text-duro hover:bg-duro hover:text-papel" },
  brando: { ativa: "bg-brando text-papel", repouso: "bg-brando-suave text-brando hover:bg-brando hover:text-papel" },
  neutro: { ativa: "bg-acento text-papel", repouso: "bg-acento-suave text-acento hover:bg-acento hover:text-papel" },
};

const CLASSE_REGUA: Record<Lado, string> = {
  duro: "border-duro",
  brando: "border-brando",
  neutro: "border-acento",
};

function fmtNota(n: number): string {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/**
 * Parágrafo do relatório com marcadores [[cN]] → marcas discretas "§9" (ou "§9 · 280" quando
 * a citação é de outra ata). Clicar abre, logo abaixo, o trecho exato e o link para o PDF.
 * Com `notas` (chave `${ata}.${paragrafo}`), a marca fica quente (nota > 0) ou fria (nota < 0).
 */
export function ParagrafoCitado({
  texto,
  citacoes,
  ataPrincipal,
  className = "",
  notas,
}: {
  texto: string;
  citacoes: Citacao[];
  /** Ata que não precisa ser repetida na marca. Padrão: a mais citada no parágrafo. */
  ataPrincipal?: number;
  className?: string;
  /** Nota de cada parágrafo citado, chave `${ata}.${paragrafo}`. */
  notas?: Record<string, number>;
}) {
  const base = useId();
  const painelId = `${base}-citacao`;
  const [aberta, setAberta] = useState<string | null>(null);
  const porId = new Map(citacoes.map((c) => [c.id, c]));
  const principal = ataPrincipal ?? ataMaisComum(citacoes);
  const atual = aberta ? porId.get(aberta) : undefined;
  const notaDe = (c: Citacao) => notas?.[`${c.ata}.${c.paragrafo}`];
  const notaAtual = atual ? notaDe(atual) : undefined;
  const ladoAtual = ladoDe(notaAtual);

  // texto e marcadores alternados: ["texto ", "[[c1]]", "", "[[c2]]", ". mais texto"]
  const partes = texto.split(SEPARADOR);

  const nos: ReactNode[] = [];
  let ultimoFoiMarca = false;
  partes.forEach((parte, i) => {
    const m = MARCADOR_EXATO.exec(parte);
    if (!m) {
      const proximaEhMarcador = MARCADOR_EXATO.test(partes[i + 1] ?? "");
      // o espaço antes da marca some: ela fica colada à palavra, como uma nota sobrescrita.
      const trecho = proximaEhMarcador ? parte.replace(/\s+$/, "") : parte;
      if (trecho) {
        nos.push(<Fragment key={`t${i}`}>{trecho}</Fragment>);
        ultimoFoiMarca = false;
      }
      return;
    }
    const c = porId.get(m[1]);
    if (!c) return;
    const ativa = aberta === c.id;
    const outraAta = principal !== undefined && c.ata !== principal;
    const rotulo = `§${c.paragrafo}${outraAta ? ` · ${c.ata}` : ""}`;
    const nota = notaDe(c);
    const lado = ladoDe(nota);
    const descNota = lado === "neutro" || nota === undefined ? "" : `, nota ${fmtNota(nota)} (${lado})`;
    nos.push(
      <Fragment key={`m${i}`}>
        {ultimoFoiMarca ? ESPACO_FINO : ESPACO_CAPILAR}
        <button
          type="button"
          aria-expanded={ativa}
          aria-controls={painelId}
          aria-label={`${rotulo}: fonte na ata ${c.ata}, parágrafo ${c.paragrafo}${descNota}`}
          onClick={() => setAberta(ativa ? null : c.id)}
          className={[
            "relative -top-[0.42em] inline-block cursor-pointer whitespace-nowrap rounded-[4px] px-[0.32em] py-[0.12em]",
            "font-sans text-[length:max(0.68em,12px)] font-medium leading-none num align-baseline",
            "transition-colors duration-150",
            "after:absolute after:-inset-x-1 after:-inset-y-2 after:content-['']",
            ativa ? CLASSE_MARCA[lado].ativa : CLASSE_MARCA[lado].repouso,
          ].join(" ")}
        >
          {rotulo}
        </button>
      </Fragment>,
    );
    ultimoFoiMarca = true;
  });

  return (
    <div className={className}>
      <p className="texto-leitura">{nos}</p>
      <div id={painelId} aria-live="polite">
        {atual && (
          <div
            key={atual.id}
            className="mt-3 mb-1 rounded-lg bg-papel-2 px-4 py-3.5 sm:px-5 transition-[opacity,translate] duration-200 ease-out starting:opacity-0 starting:-translate-y-1 motion-reduce:transition-none"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="rotulo num">
                Ata {atual.ata}, parágrafo {atual.paragrafo}
                {atual.data_reuniao ? `, reunião de ${dataCurta(atual.data_reuniao)}` : ""}
              </p>
              {notaAtual !== undefined && ladoAtual !== "neutro" && (
                <p
                  className={`num shrink-0 text-[0.8125rem] leading-[1.35] font-medium ${ladoAtual === "duro" ? "text-duro" : "text-brando"}`}
                >
                  nota {fmtNota(notaAtual)} ({ladoAtual})
                </p>
              )}
              <button
                type="button"
                onClick={() => setAberta(null)}
                className="rotulo shrink-0 cursor-pointer underline decoration-linha-2 underline-offset-[3px] hover:text-tinta hover:decoration-current"
              >
                fechar
              </button>
            </div>
            <blockquote className={`mt-2 border-l-2 ${CLASSE_REGUA[ladoAtual]} pl-3.5`}>
              <p className="trecho text-[1.0625rem] leading-[1.6] break-words">“{atual.trecho}”</p>
            </blockquote>
            <a href={atual.url_pdf} target="_blank" rel="noopener noreferrer" className="link mt-2.5 inline-block text-sm">
              abrir a ata em PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
