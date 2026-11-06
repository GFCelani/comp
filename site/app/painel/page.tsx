import type { Metadata } from "next";
import Link from "next/link";
import { dados, type MetricasLado } from "@/lib/dados";
import { data, dataCurta, indice as fmtIndice, pct, pontos, previsaoRotulo } from "@/lib/formato";
import { Matriz } from "@/components/Matriz";
import { Rodape } from "@/components/Rodape";

export const metadata: Metadata = {
  title: "Painel de verificação · Tradutor do Copom",
  description: "Acurácia da previsão a partir do tom, matriz de confusão, comparação com uma previsão ingênua, modelo do parceiro e validação humana.",
};

function Destaque({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="cartao p-4">
      <p className="rotulo">{rotulo}</p>
      <p className="mt-1 text-2xl sm:text-3xl font-semibold num">{valor}</p>
      {nota && <p className="text-xs text-texto-2 mt-1">{nota}</p>}
    </div>
  );
}

function Bloco({ id, titulo, children }: { id: string; titulo: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="text-xl sm:text-2xl font-semibold leading-tight">
        {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Aguardando({ texto }: { texto: string }) {
  return (
    <div className="cartao p-5 border-dashed text-texto-2">
      <p className="font-semibold text-texto">aguardando</p>
      <p className="text-sm mt-1">{texto}</p>
    </div>
  );
}

const rotulosPrevisao = ["afrouxamento", "manutencao", "aperto"] as const;

function rotulosLegiveis(rotulos: string[]) {
  return rotulos.map((r) => previsaoRotulo[r as (typeof rotulosPrevisao)[number]] ?? r);
}

function LadoComparativo({ titulo, m, descricao }: { titulo: string; m: MetricasLado; descricao: string }) {
  return (
    <div className="cartao p-5 min-w-0">
      <h3 className="font-semibold">{titulo}</h3>
      <p className="text-xs text-texto-2 mt-1">{descricao}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 num">
        <div>
          <dt className="rotulo">acurácia</dt>
          <dd className="text-xl font-semibold">{pct(m.acuracia)}</dd>
        </div>
        <div>
          <dt className="rotulo">acerto do sinal</dt>
          <dd className="text-xl font-semibold">{pct(m.acerto_sinal)}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <Matriz
          rotulos={rotulosLegiveis(m.matriz_confusao.rotulos)}
          valores={m.matriz_confusao.valores}
          legenda={`Matriz de confusão: ${titulo}`}
        />
      </div>
    </div>
  );
}

export default function Painel() {
  const { resumo, metricas_previsao: mp, metricas_modelo: mm, validacao_humana: vh } = dados;

  const fraseMelhor = mp
    ? mp.melhor === "indice"
      ? `O índice de tom acertou mais vezes (${pct(mp.indice.acuracia)}) do que repetir a última decisão (${pct(mp.ingenua.acuracia)}).`
      : mp.melhor === "ingenua"
        ? `Repetir a última decisão acertou mais vezes (${pct(mp.ingenua.acuracia)}) do que o índice de tom (${pct(mp.indice.acuracia)}). Nesta amostra, o tom ainda não bate a regra ingênua.`
        : `Empate: o índice de tom e a regra ingênua tiveram a mesma acurácia (${pct(mp.indice.acuracia)}).`
    : null;

  return (
    <>
      <main id="conteudo" className="mx-auto w-full max-w-[1100px] px-4 pb-8">
        <header className="pt-8 sm:pt-12">
          <p className="text-sm text-texto-2">
            <Link href="/" className="underline underline-offset-4">
              Tradutor do Copom
            </Link>{" "}
            · painel de verificação
          </p>
          <h1 className="mt-1 text-3xl sm:text-5xl font-semibold leading-tight">
            O tom antecipou
            <br />o que o Copom fez?
          </h1>
          <p className="mt-3 text-texto-2 max-w-[62ch]">
            Aqui conferimos o índice contra o que aconteceu de fato. Nada é calculado nesta página: todos os números vêm
            do pipeline, e o que ainda não existe aparece como “aguardando”.
          </p>
        </header>

        <Bloco id="regra" titulo="A regra de previsão">
          <div className="cartao p-5 grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="rotulo">índice acima de +0,25</p>
              <p className="mt-1 font-semibold text-duro">prevê alta da Selic na reunião seguinte</p>
            </div>
            <div>
              <p className="rotulo">entre −0,25 e +0,25</p>
              <p className="mt-1 font-semibold text-texto-2">prevê manutenção</p>
            </div>
            <div>
              <p className="rotulo">índice abaixo de −0,25</p>
              <p className="mt-1 font-semibold text-brando">prevê corte da Selic na reunião seguinte</p>
            </div>
            <p className="sm:col-span-3 text-xs text-texto-2">
              A última ata não entra na conta porque a reunião seguinte ainda não aconteceu. O limiar de ±0,25 foi fixado
              antes de olhar os resultados e não é ajustado para melhorar a nota.
            </p>
          </div>
        </Bloco>

        <Bloco id="resultado" titulo="Resultado do índice de tom">
          {!mp ? (
            <Aguardando texto="As métricas de previsão ainda não foram geradas pelo pipeline." />
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <Destaque rotulo="acurácia" valor={pct(mp.indice.acuracia)} nota="previsões certas sobre o total" />
                <Destaque
                  rotulo="acerto do sinal"
                  valor={pct(mp.indice.acerto_sinal)}
                  nota="quando previu alta ou corte, acertou a direção"
                />
                <Destaque rotulo="atas avaliadas" valor={String(mp.n_atas)} />
                <Destaque
                  rotulo="período"
                  valor={`${dataCurta(mp.periodo.inicio)} a ${dataCurta(mp.periodo.fim)}`}
                />
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[auto_1fr]">
                <div className="cartao p-5">
                  <h3 className="font-semibold mb-3">Matriz de confusão</h3>
                  <Matriz
                    rotulos={rotulosLegiveis(mp.indice.matriz_confusao.rotulos)}
                    valores={mp.indice.matriz_confusao.valores}
                    legenda="Matriz de confusão do índice de tom: linhas são o previsto, colunas o realizado"
                  />
                  <p className="text-xs text-texto-2 mt-3 max-w-[36ch]">
                    Linhas: o que o índice previu. Colunas: o que o Copom fez. A diagonal (verde) são os acertos.
                  </p>
                </div>

                <div className="cartao p-5 min-w-0">
                  <h3 className="font-semibold mb-3">Linha do tempo</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm num">
                      <thead>
                        <tr className="text-left text-xs text-texto-2">
                          <th scope="col" className="py-1 pr-3 font-normal">ata</th>
                          <th scope="col" className="py-1 pr-3 font-normal">índice</th>
                          <th scope="col" className="py-1 pr-3 font-normal">previsto</th>
                          <th scope="col" className="py-1 pr-3 font-normal">Selic na seguinte</th>
                          <th scope="col" className="py-1 font-normal">acertou</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borda">
                        {mp.indice.atas.map((a) => (
                          <tr key={a.ata}>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {a.ata}ª <span className="text-texto-2 text-xs">{data(a.data_reuniao)}</span>
                            </td>
                            <td className="py-2 pr-3 text-ciano">{fmtIndice(a.indice)}</td>
                            <td className="py-2 pr-3">{previsaoRotulo[a.previsto]}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {pontos(a.variacao_pp)}{" "}
                              <span className="text-texto-2 text-xs">({previsaoRotulo[a.realizado]})</span>
                            </td>
                            <td className={`py-2 font-semibold ${a.acertou ? "text-brando" : "text-erro"}`}>
                              {a.acertou ? "sim" : "não"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </Bloco>

        <Bloco
          id="comparativo"
          titulo={
            <>
              Nosso índice × previsão ingênua
            </>
          }
        >
          {!mp ? (
            <Aguardando texto="A comparação com a previsão ingênua depende das métricas de previsão." />
          ) : (
            <>
              <p className="text-texto-2 max-w-[70ch] text-sm">
                A previsão ingênua repete a decisão da reunião atual como aposta para a próxima. É a régua mínima: um índice
                que não ganha dela não está acrescentando informação.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <LadoComparativo titulo="Índice de tom" m={mp.indice} descricao="Regra de ±0,25 sobre o índice da ata." />
                <LadoComparativo
                  titulo="Previsão ingênua"
                  m={mp.ingenua}
                  descricao="Repete a decisão da reunião atual."
                />
              </div>
              <p className="mt-4 cartao p-4 border-l-4 border-l-ciano text-sm">{fraseMelhor}</p>
            </>
          )}
        </Bloco>

        <Bloco id="modelo" titulo="Modelo do parceiro">
          {!mm ? (
            <Aguardando texto="O modelo do parceiro ainda não enviou banco/metricas_modelo.json. Quando chegar, aparecem aqui a acurácia parágrafo a parágrafo contra os rótulos do Claude e a matriz 5×5." />
          ) : (
            <>
              <p className="text-sm text-texto-2">
                Método: <span className="text-texto">{mm.metodo}</span> · {mm.n_paragrafos} parágrafos · gerado em{" "}
                {dataCurta(mm.gerado_em.slice(0, 10))}
              </p>
              <div className="mt-3 grid gap-3 grid-cols-2 lg:grid-cols-3">
                <Destaque rotulo="acurácia" valor={pct(mm.acuracia)} nota="nota igual à do Claude" />
                <Destaque rotulo="acurácia dentro de 1 ponto" valor={pct(mm.acuracia_1ponto)} />
                <Destaque rotulo="erro médio absoluto" valor={fmtIndice(mm.erro_medio_abs).replace("+", "")} />
              </div>
              <div className="cartao p-5 mt-4">
                <h3 className="font-semibold mb-3">Matriz 5×5: rótulo do Claude × previsão do modelo</h3>
                <Matriz
                  rotulos={mm.matriz_confusao.rotulos.map((r) => (r > 0 ? `+${r}` : String(r)))}
                  valores={mm.matriz_confusao.valores}
                  legenda="Matriz de confusão do modelo do parceiro"
                  eixoLinha="Claude"
                  eixoColuna="modelo"
                />
              </div>
            </>
          )}
        </Bloco>

        <Bloco id="validacao" titulo="Validação humana">
          {!vh ? (
            <Aguardando texto="O time ainda está classificando os 20 parágrafos à mão. Quando terminar, a concordância com o Claude aparece aqui." />
          ) : (
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              <Destaque rotulo="parágrafos conferidos" valor={String(vh.n)} />
              <Destaque rotulo="concordância exata" valor={pct(vh.concordancia_exata)} nota="humano e Claude deram a mesma nota" />
              <Destaque rotulo="concordância dentro de 1 ponto" valor={pct(vh.concordancia_1ponto)} />
            </div>
          )}
        </Bloco>

        <Bloco id="qualidade" titulo="Qualidade dos dados">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Destaque rotulo="atas no banco" valor={String(resumo.n_atas)} nota={`${data(resumo.periodo.inicio)} a ${data(resumo.periodo.fim)}`} />
            <Destaque rotulo="parágrafos" valor={String(resumo.n_paragrafos)} />
            <Destaque
              rotulo="trechos inválidos"
              valor={String(resumo.n_trechos_invalidos)}
              nota="citações que não são cópia exata da ata"
            />
            <Destaque rotulo="última atualização" valor={dataCurta(dados.gerado_em.slice(0, 10))} nota={`fonte do índice: ${dados.fonte_indice}`} />
          </div>
        </Bloco>
      </main>
      <Rodape />
    </>
  );
}
