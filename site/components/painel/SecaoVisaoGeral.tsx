import type { DadosSite } from "@/lib/dados";
import type { PrevisaoProxima } from "@/lib/previsao";
import { data, indice as fmtIndice, pct, previsaoRotulo, tomRotulo } from "@/lib/formato";
import { Aguardando, Cartao, Kpi } from "./Partes";
import { LinhaAcertos } from "./LinhaAcertos";
import { GraficoTomSelic } from "@/components/GraficoTomSelic";
import { fraseTom, lerMetodos, NOME_CURTO } from "./metodos";

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
  const { lista, escolhido, acuraciaEscolhido, previsao: pv } = lerMetodos(dados, previsao);
  const disponiveis = lista.filter((m) => m.disponivel && m.acuracia !== null);
  const frase = fraseTom(lista);
  const fileirasNovas = lista.filter((m) => m.nome !== "modelo_parceiro" && m.disponivel && m.atas.length > 0);

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
        <Kpi
          rotulo="próxima reunião: previsão"
          valor={escolhido && previsao ? previsaoRotulo[previsao.previsto] : <Aguardando />}
          contexto={
            <>
              {prox?.data ? (
                <>
                  {prox.numero ? `${prox.numero}ª reunião, ` : ""}
                  {data(prox.data)}
                </>
              ) : (
                <Aguardando>data aguardando</Aguardando>
              )}
              <span className="mt-1 block">
                {escolhido ? (
                  <>
                    método: {escolhido.rotulo}, acerto de {pct(acuraciaEscolhido)} em{" "}
                    {escolhido.n ?? <Aguardando />} reuniões
                  </>
                ) : (
                  <>
                    método: <Aguardando />
                  </>
                )}
              </span>
              {pv?.previsto_nivel_tom && (
                <span className="mt-1 block">
                  contexto: o nível do tom apontaria {previsaoRotulo[pv.previsto_nivel_tom]}
                </span>
              )}
            </>
          }
        />
        <div className="col-span-2 xl:col-span-1">
          <Kpi
            rotulo="acurácia por método"
            contexto={
              disponiveis.length > 0
                ? `${frase ?? ""} Validação leave-one-out em ${escolhido?.n ?? disponiveis[0].n ?? "?"} reuniões.`.trim()
                : undefined
            }
          >
            {disponiveis.length > 0 ? (
              <ul className="mt-2 grid gap-1.5">
                {disponiveis.map((m) => (
                  <li key={m.nome} className="flex items-baseline justify-between gap-3">
                    <span className={`text-[13px] ${m.escolhido ? "font-medium text-tinta" : "text-tinta-3"}`}>
                      {NOME_CURTO[m.nome]}
                      {m.escolhido && <span className="selo selo-ok ml-1.5 align-[1px]">publicado</span>}
                    </span>
                    <span
                      className={`num font-semibold leading-none tracking-tight ${
                        m.escolhido ? "text-[24px] text-tinta" : "text-[17px] text-tinta-2"
                      }`}
                    >
                      {pct(m.acuracia)}
                    </span>
                  </li>
                ))}
              </ul>
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
            fileiras={
              fileirasNovas.length > 0
                ? fileirasNovas.map((m) => ({ nome: NOME_CURTO[m.nome], atas: m.atas }))
                : [
                    { nome: "Índice de tom (±0,25)", atas: mp.indice.atas },
                    { nome: "Repetir a última decisão", atas: mp.ingenua.atas },
                  ]
            }
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
