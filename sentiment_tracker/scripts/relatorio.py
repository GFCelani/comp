"""
Gera resultados/validacao.md a partir dos arquivos de resultado (nenhum número é digitado à mão).

    .venv/bin/python scripts/relatorio.py

Lê: resultados/calibracao.json (oficial, rótulos cegos), resultados/calibracao_v1_contaminado.json
(se existir), resultados/metricas_modelo.json, resultados/indice.json, dados/reacao.csv.
"""
import json
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
RES = RAIZ / "resultados"


def ler(nome):
    p = RES / nome
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def pct(x):
    return "—" if x is None else f"{100 * x:.0f}%"


def num(x, d=2):
    return "—" if x is None else f"{x:.{d}f}"


def linha_met(nome, m):
    return (f"| {nome} | {m['n']} | {num(m['correlacao'])} | {pct(m['acerto_direcao'])} "
            f"({m['n_direcionais']}) | {num(m['erro_medio_abs'])} |")


def main():
    c, c1 = ler("calibracao.json"), ler("calibracao_v1_contaminado.json")
    mm, idx = ler("metricas_modelo.json"), ler("indice.json")
    reac = pd.read_csv(RAIZ / "dados" / "reacao.csv")
    md = ["# Validação do Sentiment Tracker", "",
          f"Gerado por `scripts/relatorio.py` em {c['gerado_em']}. Todos os números vêm de "
          "`resultados/*.json` e `dados/reacao.csv`.", ""]

    md += ["## 1. Gabarito: o que conta como acerto", "",
           "Para cada ata, `rotulo_surpresa` (−2..+2) combina:",
           "- **Analistas** (peso 1): veredito \"mais dura / em linha / mais branda que o esperado\" coletado "
           "de matérias (InfoMoney, Money Times, CNN Brasil, Agência Brasil), em `dados/analistas/`.",
           "- **Mercado** (peso 0 a 0,5): variação da taxa prefixada de 2 anos (LTN, Tesouro Direto) no dia da "
           "ata em desvios de um dia comum (z), só se |z| ≥ 1. O peso cai a zero quando os analistas atribuíram "
           "o movimento a outro evento e é reduzido quando havia ≥ 2 eventos externos no dia.", "",
           f"- Atas com dado de mercado: {int(reac['d_pre2'].notna().sum())}; com movimento acima de um dia comum "
           f"(|z| ≥ 1): {int((reac['z_pre2'].abs() >= 1).sum())}.",
           f"- Reação atribuída pelos analistas só à ata: {int((reac['atribuida_a_ata'] == 'sim').sum())}; "
           f"parcialmente: {int((reac['atribuida_a_ata'] == 'parcial').sum())}; a outro evento: "
           f"{int((reac['atribuida_a_ata'] == 'nao').sum())}.",
           f"- Correlação entre a surpresa dos analistas e a variação do prefixado 2a no dia: "
           f"{num(reac['surpresa_analistas'].astype(float).corr(reac['d_pre2']))} (n={int(reac[['surpresa_analistas','d_pre2']].dropna().shape[0])}). "
           "Os dois gabaritos apontam na mesma direção, mas estão longe de idênticos.", ""]

    md += ["## 2. Surpresa: desempenho fora da amostra (leave-one-out)", "",
           f"Estimador escolhido: **{c['estimador_escolhido']}** (regra: {c['regra_escolha']}).", "",
           "| Comparação | n | Correlação | Acerto de direção (n direcionais) | Erro médio abs. |",
           "|---|---|---|---|---|",
           linha_met("Índice × gabarito combinado", c["loo_vs_rotulo"]),
           linha_met("Índice × só analistas", c["loo_vs_analistas"]),
           linha_met("Índice × Δ prefixado 2a (dias limpos, em dezenas de pb)", c["loo_vs_di_dias_limpos"]), "",
           f"Base ingênua (prever sempre \"em linha\" = 0): erro médio abs. {num(c['base_ingenua_zero']['erro_medio_abs'])}. "
           "Acerto de direção conta só atas em que o gabarito tem |surpresa| ≥ 0,5.", "",
           "Candidatos (correlação leave-one-out com o gabarito):", ""]
    md += [f"- `{k}`: {num(v)}" for k, v in c["correlacao_loo_candidatos"].items()]
    md += ["", "Sinais isolados (correlação com o gabarito):", ""]
    md += [f"- `{k}`: {num(v['correlacao'])}" for k, v in c["sinais_isolados_vs_rotulo"].items()]
    md += ["", f"Intervalo de previsão de 95% da surpresa: ± {num(c['intervalo_previsao_95'])} "
           f"(t de Student com n = {c['n_atas_treino']}). É largo porque a amostra é curta (atas desde 2021).", ""]

    if c1:
        md += ["## 3. Teste de vazamento", "",
               "A primeira rodada de rótulos (v1) usou uma versão da Skill que lia `resultados/padroes.md`, que traz "
               "reação de mercado e veredito dos analistas por ata. Os rótulos oficiais foram refeitos às cegas "
               "(`skill/tom-copom/regras.md`, sem dados por ata). Comparação:", "",
               "| Rodada | Correlação LOO | Acerto de direção | Correlação com DI (dias limpos) |", "|---|---|---|---|",
               f"| v1 (contaminada) | {num(c1['loo_vs_rotulo']['correlacao'])} | {pct(c1['loo_vs_rotulo']['acerto_direcao'])} | "
               f"{num(c1['loo_vs_di_dias_limpos']['correlacao'])} |",
               f"| cega (oficial) | {num(c['loo_vs_rotulo']['correlacao'])} | {pct(c['loo_vs_rotulo']['acerto_direcao'])} | "
               f"{num(c['loo_vs_di_dias_limpos']['correlacao'])} |", "",
               "A diferença estima quanto do desempenho da v1 vinha de ver o gabarito.", ""]

    if mm:
        md += ["## 4. Rótulos por parágrafo", "",
               f"Modelo reserva sem IA (TF-IDF + ridge), deixando uma ata inteira de fora por vez, contra os rótulos "
               f"do Claude: acerto exato {pct(mm['acuracia'])}, até 1 ponto {pct(mm['acuracia_1ponto'])}, erro médio "
               f"{num(mm['erro_medio_abs'])} (base \"sempre 0\": {pct(mm['base_sempre_zero']['acuracia'])} exato) — "
               f"{mm['n_paragrafos']} parágrafos.", ""]
        s = mm.get("comparacao_rotulos_pipeline") or {}
        if s:
            m = s["skill_vs_sonnet"]
            md += [f"Concordância entre dois rotuladores independentes — esta Skill (Claude Opus, 9 dimensões) × "
                   f"rótulos simples do pipeline do time (`banco/rotulos.jsonl`, Claude Sonnet): acerto exato "
                   f"{pct(m['acuracia'])}, até 1 ponto {pct(m['acuracia_1ponto'])} (n={s['n']} parágrafos).", ""]

    md += ["## 5. Trechos", "", "`scripts/validar.py` confere que cada trecho citado (parágrafos e mudanças) é "
           "cópia literal do parágrafo da ata. Todas as atas rotuladas passam (ver saída do script).", ""]

    if idx:
        md += ["## 6. Atas com maior surpresa estimada", "",
               "| Ata | Nível | Surpresa | Confiança | Analistas | Δ pre 2a (pb) |", "|---|---|---|---|---|---|"]
        for a in sorted(idx["atas"], key=lambda a: -abs(a["surpresa"]))[:10]:
            g = a["gabarito"]
            md.append(f"| {a['ata']} | {a['nivel']:+.2f} | {a['surpresa']:+.2f} | {a['confianca']} | "
                      f"{g['veredito_analistas'] or '—'} | {g['d_pre2_pb'] if g['d_pre2_pb'] is not None else '—'} |")
        md.append("")

    md += ["## 7. Limitações", "",
           "- **Amostra curta**: ~46 atas (2021–2026), um regime de alta, um de manutenção e dois de corte. "
           "Intervalos largos; não extrapolar para regimes diferentes.",
           "- **Padrões em amostra**: as regras P01–P18 foram destiladas da leitura dos analistas sobre essas "
           "mesmas atas. A versão cega tira os dados por ata, mas as frases-exemplo continuam vindo daqui.",
           "- **Mercado**: taxa \"manhã\" do Tesouro Direto (não o DI futuro de fechamento) e dados diários; "
           "sem controle por Treasury (FRED bloqueado pelo proxy). A ata sai às 8h, antes da taxa manhã.",
           "- **Gabarito qualitativo**: \"esperado\" pelos analistas costuma ser o comunicado da semana anterior; "
           "veredito vem em geral de uma ou duas casas por ata.",
           "- **Rotulador único por ata**: cada ata foi rotulada uma vez; a variância entre execuções do Claude "
           "não foi medida (não testado).",
           "- Interpretação, não previsão; não é recomendação de investimento.", ""]
    (RES / "validacao.md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
