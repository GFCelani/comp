import { pct } from "@/lib/formato";
import { Aguardando } from "./Partes";
import { CLASSE_ROTULO, type Modelo, type Probs } from "./modelo";

const COR: Record<string, string> = {
  alta: "var(--duro-forte)",
  manutencao: "var(--tinta-3)",
  corte: "var(--brando-forte)",
};

/** Barra horizontal empilhada alta / manutenção / corte, com os percentuais embaixo. */
export function BarraProbs({ probs }: { probs: Probs | null }) {
  if (!probs) return <Aguardando>probabilidades aguardando</Aguardando>;
  const itens = (["alta", "manutencao", "corte"] as const).map((c) => ({
    c,
    v: typeof probs[c] === "number" ? (probs[c] as number) : null,
  }));
  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-papel-2"
        role="img"
        aria-label={itens.map((i) => `${CLASSE_ROTULO[i.c]} ${i.v === null ? "aguardando" : pct(i.v)}`).join(", ")}
      >
        {itens.map((i) =>
          i.v ? <span key={i.c} style={{ width: `${i.v * 100}%`, backgroundColor: COR[i.c] }} /> : null,
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-tinta-2">
        {itens.map((i) => (
          <li key={i.c} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COR[i.c] }} />
            {CLASSE_ROTULO[i.c]}{" "}
            <span className="num font-semibold text-tinta">{i.v === null ? <Aguardando /> : pct(i.v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Previsão ata a ata do modelo publicado na janela no tempo: uma coluna por ata.
 * Ponto cheio (acento) = acertou; vazado = errou. A barrinha acima é a probabilidade da classe prevista.
 */
export function LinhaPrevisoes({ previsoes }: { previsoes: Modelo["previsoes"] }) {
  if (previsoes.length === 0) return <Aguardando>previsões ata a ata aguardando</Aguardando>;
  const certos = previsoes.filter((p) => p.previsto === p.realizado).length;
  return (
    <figure className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-tinta-3">
        <span className="num">
          {certos} de {previsoes.length} acertos
        </span>
        <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-acento" /> acertou
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full border border-tinta-3 bg-papel" /> errou
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-1 rounded-sm bg-linha-2" /> probabilidade da classe prevista
          </span>
        </span>
      </div>
      <ol className="flex items-end gap-px" aria-label="Previsão do modelo ata a ata">
        {previsoes.map((p) => {
          const ok = p.previsto === p.realizado;
          const prob = p.probabilidades?.[p.previsto as keyof Probs];
          const titulo = `${p.ata}ª · previu ${CLASSE_ROTULO[p.previsto] ?? p.previsto}${
            typeof prob === "number" ? ` (${pct(prob)})` : ""
          }, foi ${CLASSE_ROTULO[p.realizado] ?? p.realizado}`;
          return (
            <li key={p.ata} title={titulo} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className="sr-only">{titulo}. {ok ? "Acertou" : "Errou"}.</span>
              <span className="flex h-8 w-full items-end justify-center" aria-hidden="true">
                {typeof prob === "number" && (
                  <span className="w-1 rounded-sm bg-linha-2" style={{ height: `${Math.max(2, prob * 100)}%` }} />
                )}
              </span>
              <span
                aria-hidden="true"
                className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-acento" : "border border-tinta-3 bg-papel"}`}
              />
            </li>
          );
        })}
      </ol>
      <div className="num mt-2 flex justify-between text-xs text-tinta-3" aria-hidden="true">
        <span>{previsoes[0].ata}ª</span>
        <span>{previsoes[previsoes.length - 1].ata}ª</span>
      </div>
    </figure>
  );
}
