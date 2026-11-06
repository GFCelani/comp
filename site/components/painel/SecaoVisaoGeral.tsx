import type { DadosSite } from "@/lib/dados";
import { data, indice as fmtIndice, tomRotulo } from "@/lib/formato";
import { Aguardando, Cartao, Kpi } from "./Partes";
import { LinhaPrevisoes } from "./PartesModelo";
import { GraficoTomSelic } from "@/components/GraficoTomSelic";
import { lerModelo } from "./modelo";
import { NumerosModelo, PrevisaoAtualCartao } from "./SecaoModelo";

export function SecaoVisaoGeral({ dados }: { dados: DadosSite }) {
  const { resumo } = dados;
  const u = resumo.ultima_ata;
  const comNota = dados.atas.reduce((s, a) => s + a.n_nao_zero, 0);
  const m = lerModelo(dados);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
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
        <div className="col-span-2 xl:col-span-1">
          <Kpi
            rotulo={`índice da ${u.numero}ª ata`}
            valor={u.indice === null ? <Aguardando /> : fmtIndice(u.indice)}
            contexto={`tom ${tomRotulo(u.indice)} · reunião de ${data(u.data_reuniao)}`}
          />
        </div>
      </div>

      <NumerosModelo m={m} />

      <PrevisaoAtualCartao m={m} />

      <Cartao
        titulo="Acertos do modelo por reunião"
        descricao="Cada ponto é uma ata: a previsão do modelo, treinado só com as atas anteriores, contra a decisão da reunião seguinte."
      >
        <LinhaPrevisoes previsoes={m.previsoes} />
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
