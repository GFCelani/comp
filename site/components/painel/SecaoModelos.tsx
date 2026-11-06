import type { DadosSite, MetricasLado } from "@/lib/dados";
import { data, indice as fmtIndice, pct, previsaoRotulo } from "@/lib/formato";
import { Matriz } from "@/components/Matriz";
import { BlocoAguardando, Cartao } from "./Partes";
import { fraseMelhor } from "./SecaoVisaoGeral";

type Lado = MetricasLado & { n_previsoes_direcionais?: number | null };

const rotulosPrev = (r: string[]) => r.map((x) => previsaoRotulo[x as keyof typeof previsaoRotulo] ?? x);

function Numero({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-tinta-3">{rotulo}</dt>
      <dd className="num mt-1 text-[22px] font-semibold leading-none tracking-tight">{valor}</dd>
    </div>
  );
}

function ColunaMetodo({ titulo, descricao, m, destaque }: { titulo: string; descricao: string; m: Lado; destaque?: boolean }) {
  return (
    <Cartao
      titulo={
        <>
          {titulo}
          {destaque && <span className="selo selo-ok ml-2 align-[1px]">acertou mais</span>}
        </>
      }
      descricao={descricao}
    >
      <dl className="grid grid-cols-3 gap-3">
        <Numero rotulo="acurácia" valor={pct(m.acuracia)} />
        <Numero rotulo="acerto de sinal" valor={m.acerto_sinal === null ? <span className="aguardando">aguardando</span> : pct(m.acerto_sinal)} />
        <Numero
          rotulo="direcionais"
          valor={typeof m.n_previsoes_direcionais === "number" ? m.n_previsoes_direcionais : <span className="aguardando">aguardando</span>}
        />
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-tinta-3">
        {m.atas.length} reuniões avaliadas. Direcionais: quantas vezes o método previu alta ou corte; o acerto de sinal
        conta só essas.
      </p>
      <div className="mt-5 border-t border-linha pt-5">
        <Matriz
          rotulos={rotulosPrev(m.matriz_confusao.rotulos)}
          valores={m.matriz_confusao.valores}
          legenda={`Matriz de confusão: ${titulo}`}
        />
      </div>
    </Cartao>
  );
}

export function SecaoModelos({ dados }: { dados: DadosSite }) {
  const { metricas_previsao: mp, metricas_modelo: mm } = dados;
  return (
    <div className="grid gap-6">
      {mp ? (
        <>
          <p className="max-w-[72ch] text-sm leading-relaxed text-tinta-2">
            {mp.n_atas} reuniões de {data(mp.periodo.inicio)} a {data(mp.periodo.fim)}. A regra foi fixada antes de olhar
            os resultados: índice acima de +0,25 prevê alta, abaixo de −0,25 prevê corte, entre os dois prevê manutenção.{" "}
            <span className="text-tinta">{fraseMelhor(mp)}</span>
          </p>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <ColunaMetodo
              titulo="Índice de tom (regra ±0,25)"
              descricao="Prevê a reunião seguinte a partir do índice da ata."
              m={mp.indice as Lado}
              destaque={mp.melhor === "indice"}
            />
            <ColunaMetodo
              titulo="Repetir a última decisão"
              descricao="Previsão ingênua: aposta que o Copom repete o que acabou de fazer."
              m={mp.ingenua as Lado}
              destaque={mp.melhor === "ingenua"}
            />
            <div className="lg:col-span-2 xl:col-span-1">
              <ModeloParceiro mm={mm} />
            </div>
          </div>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Cartao titulo="Índice de tom × repetir a última decisão">
            <BlocoAguardando texto="As métricas de previsão ainda não foram geradas pelo pipeline." />
          </Cartao>
          <ModeloParceiro mm={mm} />
        </div>
      )}
    </div>
  );
}

function ModeloParceiro({ mm }: { mm: DadosSite["metricas_modelo"] }) {
  if (!mm) {
    return (
      <Cartao titulo="Modelo do parceiro" descricao="Nota de tom parágrafo a parágrafo, comparada com a nota do Claude.">
        <BlocoAguardando texto="O parceiro ainda não enviou as métricas do modelo. Quando chegarem, aparecem aqui a acurácia, a acurácia dentro de 1 ponto, o erro médio e a matriz 5×5 contra os rótulos do Claude." />
      </Cartao>
    );
  }
  return (
    <Cartao
      titulo="Modelo do parceiro"
      descricao={`${mm.metodo} · ${mm.n_paragrafos.toLocaleString("pt-BR")} parágrafos · gerado em ${data(mm.gerado_em.slice(0, 10))}`}
    >
      <dl className="grid grid-cols-3 gap-3">
        <Numero rotulo="acurácia" valor={pct(mm.acuracia)} />
        <Numero rotulo="±1 ponto" valor={pct(mm.acuracia_1ponto)} />
        <Numero rotulo="erro médio" valor={fmtIndice(mm.erro_medio_abs).replace("+", "")} />
      </dl>
      <div className="mt-5 border-t border-linha pt-5">
        <Matriz
          rotulos={mm.matriz_confusao.rotulos.map((r) => (r > 0 ? `+${r}` : r < 0 ? `−${Math.abs(r)}` : "0"))}
          valores={mm.matriz_confusao.valores}
          legenda="Matriz de confusão do modelo do parceiro"
          eixoLinha="Claude"
          eixoColuna="modelo"
        />
      </div>
    </Cartao>
  );
}
