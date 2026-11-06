import { dataCurta, previsaoRotulo } from "@/lib/formato";
import type { MetricasLado } from "@/lib/dados";

type Fileira = { nome: string; atas: MetricasLado["atas"] };

/**
 * Linha do tempo de acertos por reunião: uma fileira por método, da reunião mais antiga à mais recente.
 * Ponto cheio (acento) = acertou; ponto vazado (cinza) = errou.
 */
export function LinhaAcertos({ fileiras }: { fileiras: Fileira[] }) {
  const ordenadas = fileiras.map((f) => ({
    ...f,
    atas: [...f.atas].sort((a, b) => a.data_reuniao.localeCompare(b.data_reuniao)),
  }));
  const base = ordenadas[0]?.atas ?? [];
  const n = base.length;
  if (n === 0) return null;

  const pos = (i: number) => `${((i + 0.5) / n) * 100}%`;
  const anos: { ano: string; i: number }[] = [];
  base.forEach((a, i) => {
    const ano = a.data_reuniao.slice(0, 4);
    if (!anos.some((x) => x.ano === ano)) anos.push({ ano, i });
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-tinta-3" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-acento" /> acertou
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full border border-tinta-3 bg-papel" /> errou
        </span>
      </div>
      <div className="grid gap-5">
        {ordenadas.map((f) => {
          const certos = f.atas.filter((a) => a.acertou).length;
          return (
            <div key={f.nome} className="grid gap-2 md:grid-cols-[200px_1fr] md:items-center md:gap-4">
              <p className="flex items-baseline justify-between gap-3 text-[13px] md:block">
                <span className="font-medium text-tinta">{f.nome}</span>
                <span className="num text-tinta-3 md:mt-0.5 md:block">
                  {certos} de {f.atas.length} acertos
                </span>
              </p>
              <div
                role="img"
                aria-label={`${f.nome}: acertou ${certos} de ${f.atas.length} reuniões, de ${dataCurta(f.atas[0]?.data_reuniao)} a ${dataCurta(f.atas.at(-1)?.data_reuniao)}.`}
                className="relative h-4"
              >
                <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-linha" />
                {f.atas.map((a, i) => (
                  <span
                    key={a.ata}
                    title={`${a.ata}ª · ${dataCurta(a.data_reuniao)} · previu ${previsaoRotulo[a.previsto]}, foi ${previsaoRotulo[a.realizado]}`}
                    className={`absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-2 sm:w-2 ${
                      a.acertou ? "bg-acento" : "border border-tinta-3 bg-papel"
                    }`}
                    style={{ left: pos(i) }}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <div className="grid md:grid-cols-[200px_1fr] md:gap-4" aria-hidden="true">
          <span className="hidden md:block" />
          <div className="relative h-4 text-xs text-tinta-3 num">
            {anos.map((a) => (
              <span
                key={a.ano}
                className={`absolute top-0 ${a.i === 0 ? "" : "-translate-x-1/2"}`}
                style={{ left: a.i === 0 ? 0 : pos(a.i) }}
              >
                {a.ano}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
