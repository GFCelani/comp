/**
 * Matriz de confusão: grade com escala sequencial de UMA cor (acento em opacidades crescentes
 * sobre o papel). Linhas = previsto, colunas = realizado. A diagonal (acertos) leva contorno.
 * Cinco degraus fixos para que o número dentro da célula sempre passe no contraste AA.
 */

const DEGRAUS = [12, 28, 45, 65, 90] as const;

function degrau(v: number, max: number): number {
  if (v <= 0 || max <= 0) return 0;
  const i = Math.min(DEGRAUS.length - 1, Math.ceil((v / max) * DEGRAUS.length) - 1);
  return DEGRAUS[Math.max(0, i)];
}

function fundo(p: number): string {
  return p === 0 ? "var(--papel)" : `color-mix(in srgb, var(--acento) ${p}%, var(--papel))`;
}

export function Matriz({
  rotulos,
  rotulosColuna,
  valores,
  legenda,
  eixoLinha = "previsto",
  eixoColuna = "realizado",
}: {
  rotulos: string[];
  rotulosColuna?: string[];
  valores: number[][];
  legenda: string;
  eixoLinha?: string;
  eixoColuna?: string;
}) {
  const colunas = rotulosColuna ?? rotulos;
  const max = Math.max(0, ...valores.flat());
  const total = valores.flat().reduce((s, v) => s + v, 0);
  const acertos = valores.reduce((s, linha, i) => s + (linha[i] ?? 0), 0);
  // colunas de largura igual; mais largas só quando o rótulo pede (ex.: "manutenção")
  const largura = Math.max(...colunas.map((r) => r.length)) > 4 ? "4rem" : "3rem";

  return (
    <figure className="min-w-0">
      <div className="relative -mx-2 overflow-x-auto px-0.5">
        <table className="num border-separate border-spacing-1.5" aria-label={legenda}>
          <caption className="sr-only">
            {legenda}. Linhas: {eixoLinha}. Colunas: {eixoColuna}. Acertos na diagonal: {acertos} de {total}.
          </caption>
          <thead>
            <tr>
              <td />
              <th scope="colgroup" colSpan={colunas.length} className="rotulo text-center font-medium pb-0.5">
                {eixoColuna} →
              </th>
            </tr>
            <tr>
              <th scope="col" className="rotulo text-left font-medium pr-2 align-bottom whitespace-nowrap">
                {eixoLinha} ↓
              </th>
              {colunas.map((r) => (
                <th
                  key={r}
                  scope="col"
                  className="text-xs font-medium text-tinta-2 px-0.5 align-bottom whitespace-nowrap"
                  style={{ width: largura, minWidth: largura }}
                >
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {valores.map((linha, i) => (
              <tr key={rotulos[i] ?? i}>
                <th scope="row" className="text-xs font-medium text-tinta-2 text-left pr-2 whitespace-nowrap">
                  {rotulos[i]}
                </th>
                {linha.map((v, j) => {
                  const p = degrau(v, max);
                  const diagonal = i === j;
                  return (
                    <td
                      key={j}
                      className={`h-11 rounded-lg px-1 text-center text-sm font-semibold ${
                        p === 0 ? `text-tinta-3 ${diagonal ? "" : "border border-linha"}` : ""
                      }`}
                      style={{
                        width: largura,
                        minWidth: largura,
                        backgroundColor: fundo(p),
                        color: p >= 90 ? "var(--papel)" : p === 0 ? undefined : "var(--tinta)",
                        outline: diagonal ? "1.5px solid var(--tinta)" : undefined,
                        outlineOffset: diagonal ? "2px" : undefined,
                      }}
                    >
                      {v}
                      {diagonal && <span className="sr-only"> (acerto)</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-tinta-3">
        <span className="inline-flex items-center gap-1.5 num" aria-hidden="true">
          0
          {DEGRAUS.map((p) => (
            <span key={p} className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: fundo(p) }} />
          ))}
          {max}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ outline: "1.5px solid var(--tinta)", outlineOffset: "1px" }}
          />
          contorno: acerto ({acertos} de {total})
        </span>
      </figcaption>
    </figure>
  );
}
