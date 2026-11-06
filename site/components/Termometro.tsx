import type { CSSProperties } from "react";
import { indice as fmtIndice, tomRotulo } from "@/lib/formato";

const MARCAS = [-2, -1, 0, 1, 2];

/** posição em % na régua de −2 a +2 (valores fora da régua ficam na ponta) */
function posicao(v: number): number {
  return ((Math.max(-2, Math.min(2, v)) + 2) / 4) * 100;
}

/** centraliza o rótulo no ponto, mas encosta na borda perto das pontas para não vazar */
function ancorado(p: number): CSSProperties {
  let t = -50;
  if (p < 12) t = -(p / 12) * 50;
  else if (p > 88) t = -50 - ((p - 88) / 12) * 50;
  return { left: `${p}%`, transform: `translateX(${t}%)` };
}

function rotuloMarca(v: number): string {
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return "0";
}

export function Termometro({
  valor,
  anterior,
  rotuloAnterior,
}: {
  valor: number | null;
  anterior?: number | null;
  rotuloAnterior?: string;
}) {
  if (valor === null) return <span className="aguardando">aguardando</span>;

  const x = posicao(valor);
  const temAnterior = anterior !== null && anterior !== undefined;
  const xa = temAnterior ? posicao(anterior) : null;
  const rotA = rotuloAnterior ?? "leitura anterior";
  // rótulos em cima colidem quando os pontos estão perto: o do anterior desce
  const perto = xa !== null && Math.abs(xa - x) < 16;
  const inicio = Math.min(50, x);
  const comprimento = Math.abs(x - 50);

  const descricao =
    `Índice de tom ${fmtIndice(valor)} (${tomRotulo(valor)}), numa régua de −2 (mais brando) a +2 (mais duro)` +
    (temAnterior ? `; ${rotA}: ${fmtIndice(anterior)}` : "") +
    ".";

  return (
    <div role="img" aria-label={descricao} className="w-full select-none">
      <div className="relative mx-2.5">
        {/* rótulos acima da régua */}
        <div className="relative h-7" aria-hidden="true">
          {xa !== null && !perto && (
            <span
              className="absolute bottom-2 whitespace-nowrap text-xs leading-none text-tinta-3"
              style={ancorado(xa)}
            >
              {rotA}
            </span>
          )}
          <span
            className="num absolute bottom-1.5 whitespace-nowrap text-[15px] font-semibold leading-none text-acento"
            style={ancorado(x)}
          >
            {fmtIndice(valor)}
          </span>
        </div>

        {/* trilho, marcas, preenchimento e marcadores */}
        <div className="relative h-3.5" aria-hidden="true">
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-papel-3" />
          {MARCAS.map((v) => (
            <span
              key={v}
              className={`absolute top-1/2 w-px -translate-x-1/2 -translate-y-1/2 ${
                v === 0 ? "h-3 bg-tinta-3" : "h-2 bg-linha-2"
              }`}
              style={{ left: `${posicao(v)}%` }}
            />
          ))}
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-acento"
            style={{ left: `${inicio}%`, width: `${comprimento}%` }}
          />
          {xa !== null && (
            <span
              className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-tinta-3 bg-papel"
              style={{ left: `${xa}%` }}
            />
          )}
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-acento"
            style={{
              left: `${x}%`,
              boxShadow:
                "0 0 0 3px var(--papel), 0 1px 4px 2px color-mix(in srgb, var(--tinta) 12%, transparent)",
            }}
          />
        </div>

        {/* rótulo do anterior embaixo quando os dois pontos estão perto */}
        {xa !== null && perto && (
          <div className="relative h-5" aria-hidden="true">
            <span
              className="absolute top-1.5 whitespace-nowrap text-xs leading-none text-tinta-3"
              style={ancorado(xa)}
            >
              {rotA}
            </span>
          </div>
        )}

        {/* números da escala */}
        <div className="relative mt-2 h-4" aria-hidden="true">
          {MARCAS.map((v) => (
            <span
              key={v}
              className="num absolute top-0 text-xs leading-none text-tinta-3"
              style={ancorado(posicao(v))}
            >
              {rotuloMarca(v)}
            </span>
          ))}
        </div>

        <div className="mt-1.5 flex justify-between text-xs text-tinta-3" aria-hidden="true">
          <span>mais brando</span>
          <span>mais duro</span>
        </div>
      </div>
    </div>
  );
}
