import type { DadosSite } from "@/lib/dados";
import type { PrevisaoProxima } from "@/lib/previsao";
import { data, indice as fmtIndice, pct, previsaoRotulo } from "@/lib/formato";
import { Matriz } from "@/components/Matriz";
import { BlocoAguardando, Cartao } from "./Partes";
import { DESCRICAO, fraseTom, lerMetodos, NOME_CURTO, type Metodo } from "./metodos";

const rotulosPrev = (r: string[]) => r.map((x) => previsaoRotulo[x as keyof typeof previsaoRotulo] ?? x);

function Numero({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-tinta-3">{rotulo}</dt>
      <dd className="num mt-1 text-[22px] font-semibold leading-none tracking-tight">{valor}</dd>
    </div>
  );
}

function Aguard({ children }: { children?: React.ReactNode }) {
  return <span className="aguardando">{children ?? "aguardando"}</span>;
}

function ColunaMetodo({ m }: { m: Metodo }) {
  return (
    <Cartao
      titulo={
        <>
          {NOME_CURTO[m.nome]}
          {m.escolhido && <span className="selo selo-ok ml-2 align-[1px]">método publicado</span>}
        </>
      }
      descricao={`${m.rotulo}. ${DESCRICAO[m.nome]}`}
    >
      {m.disponivel ? (
        <>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
            <Numero rotulo="acurácia LOO" valor={m.acuracia === null ? <Aguard /> : pct(m.acuracia)} />
            <Numero rotulo="acerto de sinal" valor={m.acertoSinal === null ? <Aguard /> : pct(m.acertoSinal)} />
            <Numero rotulo="direcionais" valor={m.direcionais ?? <Aguard />} />
            <Numero rotulo="próxima reunião" valor={m.proxima ? previsaoRotulo[m.proxima] : <Aguard />} />
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-tinta-3">
            {m.n ?? <Aguard />} reuniões avaliadas. Direcionais: quantas vezes o método previu alta ou corte; o acerto
            de sinal conta só essas.
          </p>
          <div className="mt-5 border-t border-linha pt-5">
            {m.matriz ? (
              <Matriz
                rotulos={rotulosPrev(m.matriz.rotulos)}
                valores={m.matriz.valores}
                legenda={`Matriz de confusão: ${NOME_CURTO[m.nome]}`}
              />
            ) : (
              <Aguard>matriz aguardando</Aguard>
            )}
          </div>
        </>
      ) : (
        <BlocoAguardando texto={m.motivo ? `Aguardando: ${m.motivo}.` : "Aguardando os dados deste método."} />
      )}
    </Cartao>
  );
}

export function SecaoModelos({ dados, previsao }: { dados: DadosSite; previsao: PrevisaoProxima | null }) {
  const { metricas_previsao: mp, metricas_modelo: mm } = dados;
  const { lista, escolhido } = lerMetodos(dados, previsao);
  const temNovos = lista.some((m) => m.temDados);
  const frase = fraseTom(lista);
  return (
    <div className="grid gap-6">
      {mp && temNovos ? (
        <>
          <p className="max-w-[72ch] text-sm leading-relaxed text-tinta-2">
            {mp.n_atas} reuniões de {data(mp.periodo.inicio)} a {data(mp.periodo.fim)}, avaliadas por validação
            leave-one-out. As regras foram fixadas antes de olhar os resultados, e o site publica a previsão do método
            com maior acurácia
            {escolhido ? <>: hoje, {escolhido.rotulo.charAt(0).toLowerCase() + escolhido.rotulo.slice(1)}.</> : "."}{" "}
            {frase && <span className="text-tinta">{frase}</span>}
          </p>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {lista.map((m) => (
              <ColunaMetodo key={m.nome} m={m} />
            ))}
          </div>
          {mm && <ModeloParceiro mm={mm} />}
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Cartao titulo="Comparação dos métodos de previsão">
            <BlocoAguardando texto="As métricas por método ainda não foram geradas pelo pipeline." />
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
      titulo="Modelo do parceiro: nota por parágrafo"
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
