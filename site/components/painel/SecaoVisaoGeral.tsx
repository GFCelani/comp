import type { DadosSite } from "@/lib/dados";
import type { PrevisaoProxima } from "@/lib/previsao";
import { data, indice as fmtIndice, pct, previsaoRotulo, tomRotulo } from "@/lib/formato";
import { Aguardando, Cartao, Kpi } from "./Partes";
import { LinhaAcertos } from "./LinhaAcertos";
import { GraficoTomSelic } from "@/components/GraficoTomSelic";

export function fraseMelhor(mp: NonNullable<DadosSite["metricas_previsao"]>): string {
  if (mp.melhor === "indice") return "O índice de tom acertou mais vezes do que repetir a última decisão.";
  if (mp.melhor === "ingenua")
    return "Repetir a última decisão acertou mais vezes do que o índice de tom: nesta amostra, o tom ainda não bate a regra ingênua.";
  return "Empate: o índice de tom e repetir a última decisão tiveram a mesma acurácia.";
}

function fraseCurta(melhor: string): string {
  if (melhor === "indice") return "o índice acertou mais vezes";
  if (melhor === "ingenua") return "repetir a última decisão acertou mais vezes";
  return "empate entre os dois";
}

export function SecaoVisaoGeral({
  dados,
  previsao,
}: {
  dados: DadosSite;
  previsao: PrevisaoProxima | null;
}) {
  const { resumo, metricas_previsao: mp } = dados;
  const u = resumo.ultima_ata;
  const comNota = dados.atas.reduce((s, a) => s + a.n_nao_zero, 0);
  const prox = previsao?.proxima_reuniao;

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Kpi
          rotulo="atas no banco"
          valor={resumo.n_atas}
          contexto={`${data(resumo.periodo.inicio)} a ${data(resumo.periodo.fim)}`}
        />
        <Kpi
          rotulo="parágrafos lidos"
          valor={resumo.n_paragrafos.toLocaleString("pt-BR")}
          contexto={`${comNota.toLocaleString("pt-BR")} com nota diferente de zero`}
        />
        <Kpi
          rotulo={`índice da ${u.numero}ª ata`}
          valor={u.indice === null ? <Aguardando /> : fmtIndice(u.indice)}
          contexto={`tom ${tomRotulo(u.indice)} · reunião de ${data(u.data_reuniao)}`}
        />
        <Kpi rotulo="próxima reunião: previsão" valor={previsao ? previsaoRotulo[previsao.previsto] : <Aguardando />}
          contexto={
            prox?.data ? (
              <>
                {prox.numero ? `${prox.numero}ª reunião, ` : ""}
                {data(prox.data)} · regra ±0,25 sobre o índice
              </>
            ) : (
              <Aguardando>data aguardando</Aguardando>
            )
          }
        />
        <div className="col-span-2 xl:col-span-1">
          <Kpi rotulo="acurácia: índice × ingênua" contexto={mp ? `${fraseCurta(mp.melhor)} (${mp.n_atas} reuniões)` : undefined}>
            {mp ? (
              <div className="mt-2 flex items-end gap-5">
                <p>
                  <span className="num block text-[28px] font-semibold leading-none tracking-tight sm:text-[30px]">
                    {pct(mp.indice.acuracia)}
                  </span>
                  <span className="mt-1 block text-xs text-tinta-3">índice</span>
                </p>
                <p>
                  <span className="num block text-[28px] font-semibold leading-none tracking-tight text-tinta-2 sm:text-[30px]">
                    {pct(mp.ingenua.acuracia)}
                  </span>
                  <span className="mt-1 block text-xs text-tinta-3">ingênua</span>
                </p>
              </div>
            ) : (
              <p className="mt-2">
                <Aguardando />
              </p>
            )}
          </Kpi>
        </div>
      </div>

      <Cartao
        titulo="Acertos por reunião"
        descricao={
          mp ? (
            <>
              Cada ponto é uma reunião de {data(mp.periodo.inicio)} a {data(mp.periodo.fim)}: a previsão feita com a ata
              contra o que o Copom decidiu na reunião seguinte.
            </>
          ) : undefined
        }
      >
        {mp ? (
          <LinhaAcertos
            fileiras={[
              { nome: "Índice de tom (±0,25)", atas: mp.indice.atas },
              { nome: "Repetir a última decisão", atas: mp.ingenua.atas },
            ]}
          />
        ) : (
          <Aguardando>métricas de previsão aguardando o pipeline</Aguardando>
        )}
      </Cartao>

      <Cartao
        titulo="Tom das atas e Selic meta"
        descricao="Índice de cada ata e a Selic meta decidida em cada reunião. O mesmo gráfico da página pública."
      >
        <GraficoTomSelic serie={dados.serie} altura={320} />
      </Cartao>
    </div>
  );
}
