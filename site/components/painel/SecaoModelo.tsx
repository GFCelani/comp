import type { DadosSite } from "@/lib/dados";
import { data, pct } from "@/lib/formato";
import { Matriz } from "@/components/Matriz";
import { Aguardando, BlocoAguardando, Cartao, Kpi, Pares } from "./Partes";
import { BarraProbs, LinhaPrevisoes } from "./PartesModelo";
import { CLASSE_ROTULO, lerModelo, NOME_VARIAVEL, type Modelo } from "./modelo";

export function viradasTexto(m: Modelo) {
  return m.viradas ? `${m.viradas.acertos} de ${m.viradas.total}` : <Aguardando />;
}

export function janelaTexto(m: Modelo) {
  return m.inicio !== null && m.fim !== null ? `atas ${m.inicio}ª a ${m.fim}ª` : <Aguardando>janela aguardando</Aguardando>;
}

/** Números em destaque do modelo único: acurácia, balanceada, viradas e reuniões testadas. */
export function NumerosModelo({ m }: { m: Modelo }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Kpi rotulo="acurácia" valor={m.acuracia === null ? <Aguardando /> : pct(m.acuracia)} contexto="validação no tempo" />
      <Kpi
        rotulo="acurácia balanceada"
        valor={m.balanceada === null ? <Aguardando /> : pct(m.balanceada)}
        contexto="média do acerto em alta, manutenção e corte"
      />
      <Kpi rotulo="viradas de ciclo" valor={viradasTexto(m)} contexto="reuniões em que a decisão mudou" />
      <Kpi rotulo="reuniões testadas" valor={m.n ?? <Aguardando />} contexto={janelaTexto(m)} />
    </div>
  );
}

export function PrevisaoAtualCartao({ m }: { m: Modelo }) {
  return (
    <Cartao
      titulo={
        <>
          Próxima reunião:{" "}
          {m.atual.prevista ? CLASSE_ROTULO[m.atual.prevista] : <Aguardando />}
        </>
      }
      descricao={
        <>
          {m.atual.reuniao ? `${m.atual.reuniao}ª reunião` : <Aguardando>reunião aguardando</Aguardando>}
          {" · "}
          {m.atual.data ? data(m.atual.data) : <Aguardando>data aguardando</Aguardando>}
          {" · probabilidades do modelo"}
        </>
      }
    >
      <BarraProbs probs={m.atual.probs} />
    </Cartao>
  );
}

export function SecaoModelo({ dados }: { dados: DadosSite }) {
  const m = lerModelo(dados);
  if (!m.existe) {
    return (
      <Cartao titulo="Modelo de previsão">
        <BlocoAguardando texto="As métricas do modelo ainda não foram geradas pelo pipeline (banco/metricas_modelo.json)." />
      </Cartao>
    );
  }
  const maxImp = Math.max(0, ...(m.importancias ?? []).map((i) => i.valor));

  return (
    <div className="grid gap-6">
      <NumerosModelo m={m} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <PrevisaoAtualCartao m={m} />
        <Cartao titulo="Como o modelo foi feito">
          <Pares
            itens={[
              { rotulo: "tipo", valor: m.tipo ?? <Aguardando /> },
              {
                rotulo: "hiperparâmetros",
                valor: m.hiperparametros ? <code className="break-all text-xs">{m.hiperparametros}</code> : <Aguardando />,
              },
              {
                rotulo: "validação",
                valor: (
                  <>
                    janela crescente no tempo, {janelaTexto(m)}, {m.n ?? <Aguardando />} reuniões
                  </>
                ),
              },
              {
                rotulo: "leave-one-out (mesmo modelo)",
                valor:
                  m.loo && m.loo.acuracia !== null ? (
                    <>
                      {pct(m.loo.acuracia)} em {m.loo.n ?? <Aguardando />} reuniões
                    </>
                  ) : (
                    <Aguardando />
                  ),
              },
            ]}
          />
        </Cartao>
      </div>

      <Cartao
        titulo="Previsão ata a ata"
        descricao="Cada ponto é uma ata: o modelo, treinado só com as atas anteriores, previu a decisão da reunião seguinte."
      >
        <LinhaPrevisoes previsoes={m.previsoes} />
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Cartao titulo="Matriz de confusão" descricao="Linhas: o que o Copom decidiu. Colunas: o que o modelo previu.">
          {m.matriz ? (
            <Matriz
              rotulos={(m.matriz.rotulos ?? []).map((r) => CLASSE_ROTULO[r] ?? r)}
              valores={m.matriz.valores ?? []}
              legenda="Matriz de confusão do modelo"
              eixoLinha="realizado"
              eixoColuna="previsto"
            />
          ) : (
            <Aguardando>matriz aguardando</Aguardando>
          )}
        </Cartao>

        <Cartao titulo="Regra principal">
          {m.regra ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-tinta-2">{m.regra}</p>
          ) : (
            <Aguardando />
          )}
        </Cartao>
      </div>

      <Cartao
        titulo="Variáveis do modelo"
        descricao={m.importancias ? `Ordenadas por ${m.rotuloImportancia}.` : undefined}
      >
        {m.importancias && m.importancias.length > 0 ? (
          <ul className="grid gap-4">
            {m.importancias.map((i) => (
              <li key={i.variavel} className="grid gap-1.5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{NOME_VARIAVEL[i.variavel] ?? i.variavel}</p>
                  <p className="text-[13px] leading-snug text-tinta-3">
                    {m.descricoes[i.variavel] ?? <Aguardando>descrição aguardando</Aguardando>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-papel-2" aria-hidden="true">
                    <span
                      className="block h-full rounded-full bg-acento"
                      style={{ width: `${maxImp > 0 ? (i.valor / maxImp) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="num w-12 text-right text-[13px] text-tinta-2">
                    {i.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Aguardando />
        )}
      </Cartao>
    </div>
  );
}
