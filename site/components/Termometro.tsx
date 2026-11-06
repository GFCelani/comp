import { indice as fmtIndice, tomRotulo } from "@/lib/formato";

export function Termometro({ valor }: { valor: number | null }) {
  const largura = 320;
  const altura = 84;
  const margem = 14;
  const trilhaY = 34;
  const trilhaH = 14;
  const escala = (v: number) => margem + ((v + 2) / 4) * (largura - 2 * margem);
  const x = valor === null ? null : escala(Math.max(-2, Math.min(2, valor)));

  return (
    <figure className="w-full max-w-[360px]">
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Termômetro do tom: ${fmtIndice(valor)} em uma régua de −2 a +2, ${tomRotulo(valor)}`}
      >
        <defs>
          <linearGradient id="termo-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--brando)" />
            <stop offset="50%" stopColor="#3a4766" />
            <stop offset="100%" stopColor="var(--duro)" />
          </linearGradient>
        </defs>
        <rect
          x={margem}
          y={trilhaY}
          width={largura - 2 * margem}
          height={trilhaH}
          rx={trilhaH / 2}
          fill="url(#termo-grad)"
        />
        {[-2, -1, 0, 1, 2].map((v) => (
          <g key={v}>
            <line
              x1={escala(v)}
              x2={escala(v)}
              y1={trilhaY + trilhaH + 4}
              y2={trilhaY + trilhaH + 9}
              stroke="var(--texto-3)"
              strokeWidth={1}
            />
            <text
              x={escala(v)}
              y={trilhaY + trilhaH + 22}
              textAnchor="middle"
              fontSize="11"
              fill="var(--texto-2)"
              className="num"
            >
              {v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0"}
            </text>
          </g>
        ))}
        <text x={margem} y={14} fontSize="10" fill="var(--texto-2)">
          muito brando
        </text>
        <text x={largura - margem} y={14} fontSize="10" fill="var(--texto-2)" textAnchor="end">
          muito duro
        </text>
        {x !== null && (
          <g>
            <polygon
              points={`${x - 7},${trilhaY - 10} ${x + 7},${trilhaY - 10} ${x},${trilhaY - 1}`}
              fill="var(--texto)"
            />
            <line
              x1={x}
              x2={x}
              y1={trilhaY - 1}
              y2={trilhaY + trilhaH + 1}
              stroke="var(--texto)"
              strokeWidth={2.5}
            />
          </g>
        )}
      </svg>
      <figcaption className="sr-only">
        Régua de −2 (muito brando) a +2 (muito duro).
      </figcaption>
    </figure>
  );
}
