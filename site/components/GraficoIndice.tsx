"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
} from "recharts";
import type { PontoSerie, Decisao } from "@/lib/dados";
import { data, indice as fmtIndice, selic as fmtSelic, decisao as fmtDecisao } from "@/lib/formato";

const corDecisao: Record<Decisao, string> = {
  alta: "var(--duro)",
  corte: "var(--brando)",
  manutencao: "var(--texto-2)",
};

type PontoProps = {
  cx?: number;
  cy?: number;
  payload?: PontoSerie;
  index?: number;
};

function MarcadorDecisao({ cx, cy, payload, index }: PontoProps) {
  if (cx === undefined || cy === undefined || !payload) return <g key={index} />;
  const cor = corDecisao[payload.decisao];
  if (payload.decisao === "alta") {
    return (
      <polygon
        key={index}
        points={`${cx},${cy - 7} ${cx + 7},${cy + 5} ${cx - 7},${cy + 5}`}
        fill={cor}
        stroke="var(--fundo)"
        strokeWidth={1.5}
      />
    );
  }
  if (payload.decisao === "corte") {
    return (
      <polygon
        key={index}
        points={`${cx},${cy + 7} ${cx + 7},${cy - 5} ${cx - 7},${cy - 5}`}
        fill={cor}
        stroke="var(--fundo)"
        strokeWidth={1.5}
      />
    );
  }
  return (
    <rect
      key={index}
      x={cx - 5}
      y={cy - 5}
      width={10}
      height={10}
      fill={cor}
      stroke="var(--fundo)"
      strokeWidth={1.5}
    />
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload: PontoSerie }[];
};

function Dica({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="cartao px-3 py-2 text-sm shadow-lg">
      <div className="font-semibold">
        {p.ata}ª reunião · {data(p.data_reuniao)}
      </div>
      <div className="num">
        índice de tom: <span className="text-ciano">{fmtIndice(p.indice)}</span>
      </div>
      <div className="num">
        Selic depois: {fmtSelic(p.selic_apos)} ({fmtDecisao(p.decisao, p.decisao_pp)})
      </div>
    </div>
  );
}

export function GraficoIndice({ serie }: { serie: PontoSerie[] }) {
  const selics = serie.map((p) => p.selic_apos);
  const minS = Math.floor(Math.min(...selics) * 2) / 2 - 0.5;
  const maxS = Math.ceil(Math.max(...selics) * 2) / 2 + 0.5;

  return (
    <div>
      <div className="h-[300px] sm:h-[340px] w-full" role="img" aria-label="Gráfico do índice de tom por ata, com a Selic meta no eixo direito">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={serie} margin={{ top: 24, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="var(--borda)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ata"
              tickFormatter={(v) => `${v}ª`}
              tick={{ fill: "var(--texto-2)", fontSize: 12 }}
              axisLine={{ stroke: "var(--borda)" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="tom"
              domain={[-2, 2]}
              ticks={[-2, -1, 0, 1, 2]}
              tickFormatter={(v) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0")}
              tick={{ fill: "var(--ciano)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <YAxis
              yAxisId="selic"
              orientation="right"
              domain={[minS, maxS]}
              tickFormatter={(v) => `${Number(v).toFixed(2).replace(".", ",")}%`}
              tick={{ fill: "var(--texto-2)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <ReferenceLine yAxisId="tom" y={0} stroke="var(--texto-3)" />
            <Tooltip content={<Dica />} cursor={{ stroke: "var(--borda)" }} />
            <Line
              yAxisId="selic"
              type="stepAfter"
              dataKey="selic_apos"
              name="Selic meta"
              stroke="var(--texto-3)"
              strokeWidth={1.25}
              strokeDasharray="4 3"
              dot={(p: PontoProps) => <MarcadorDecisao {...p} />}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="tom"
              type="monotone"
              dataKey="indice"
              name="Índice de tom"
              stroke="var(--ciano)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "var(--ciano)", stroke: "var(--fundo)", strokeWidth: 1.5 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="indice"
                position="top"
                offset={10}
                formatter={(v: unknown) => fmtIndice(typeof v === "number" ? v : null)}
                style={{ fill: "var(--ciano)", fontSize: 12, fontVariantNumeric: "tabular-nums" }}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-texto-2" aria-label="Legenda">
        <li className="flex items-center gap-2">
          <span className="inline-block w-5 h-[3px] bg-ciano rounded" aria-hidden="true" />
          índice de tom (eixo esquerdo, −2 a +2)
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block w-5 border-t border-dashed border-texto-2" aria-hidden="true" />
          Selic meta após a reunião (eixo direito)
        </li>
        <li className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden="true"><polygon points="6,11 11,2 1,2" fill="var(--brando)" /></svg>
          cortou
        </li>
        <li className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" fill="var(--texto-2)" /></svg>
          manteve
        </li>
        <li className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden="true"><polygon points="6,1 11,10 1,10" fill="var(--duro)" /></svg>
          subiu
        </li>
      </ul>
    </div>
  );
}
