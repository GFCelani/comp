"""
Case 1 — Termômetro do Focus · ponto de partida do caminho avançado.

Rode da raiz do repositório:
    python avancado/case1_focus/inicio_focus.py

O que já faz:
  1. carrega e limpa o Focus (filtra baseCalculo, converte datas);
  2. monta a série semanal de expectativas de um indicador para um ano;
  3. mede se o mercado acertou IPCA e Selic nos anos já fechados;
  4. gera alertas de mudança brusca nas expectativas;
  5. salva um gráfico e uma tabela em avancado/case1_focus/saida/.

Os pontos marcados com TODO são o desafio do time.
"""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

RAIZ = Path(__file__).resolve().parents[2]
DADOS = RAIZ / "data" / "case1_focus"
SAIDA = Path(__file__).resolve().parent / "saida"
META_INFLACAO = 3.0


# ---------------------------------------------------------------- carga
def carregar_focus() -> pd.DataFrame:
    df = pd.read_csv(DADOS / "focus_anuais.csv")
    df = df[df["baseCalculo"] == 0].copy()          # cuidado nº 2 do README do case
    df["Data"] = pd.to_datetime(df["Data"])
    df["DataReferencia"] = df["DataReferencia"].astype(int)
    return df


def carregar_sgs() -> pd.DataFrame:
    df = pd.read_csv(DADOS / "sgs_realizado.csv", parse_dates=["data"])
    return df


# ---------------------------------------------------------------- análise
def serie_semanal(focus: pd.DataFrame, indicador: str, ano_ref: int) -> pd.Series:
    """Mediana da expectativa para `ano_ref`, uma observação por semana (sexta)."""
    s = (focus[(focus["Indicador"] == indicador) & (focus["DataReferencia"] == ano_ref)]
         .set_index("Data")["Mediana"].sort_index())
    return s.resample("W-FRI").last().dropna()


def ipca_realizado_ano(sgs: pd.DataFrame, ano: int) -> float | None:
    """IPCA do ano = composição das 12 variações mensais (cuidado nº 3)."""
    m = sgs[(sgs["serie"] == "ipca_mensal") & (sgs["data"].dt.year == ano)]
    if len(m) < 12:
        return None                                   # ano ainda não fechou
    return ((1 + m["valor"] / 100).prod() - 1) * 100


def selic_fim_de_ano(sgs: pd.DataFrame, ano: int) -> float | None:
    s = sgs[(sgs["serie"] == "selic_meta") & (sgs["data"].dt.year == ano)].sort_values("data")
    if s.empty or s["data"].max().month < 12:
        return None
    return float(s["valor"].iloc[-1])


def expectativa_em(focus: pd.DataFrame, indicador: str, ano_ref: int, quando: str) -> float | None:
    """Última mediana disponível até a data `quando` (ex.: '2025-01-10')."""
    s = focus[(focus["Indicador"] == indicador) & (focus["DataReferencia"] == ano_ref)
              & (focus["Data"] <= pd.Timestamp(quando))].sort_values("Data")
    return None if s.empty else float(s["Mediana"].iloc[-1])


def tabela_acuracia(focus: pd.DataFrame, sgs: pd.DataFrame) -> pd.DataFrame:
    linhas = []
    for ano in sorted(focus["DataReferencia"].unique()):
        real_ipca, real_selic = ipca_realizado_ano(sgs, ano), selic_fim_de_ano(sgs, ano)
        for ind, real in (("IPCA", real_ipca), ("Selic", real_selic)):
            if real is None:
                continue
            for rotulo, quando in (("12 meses antes", f"{ano - 1}-01-15"),
                                   ("início do ano", f"{ano}-01-15"),
                                   ("meio do ano", f"{ano}-07-15")):
                esp = expectativa_em(focus, ind, ano, quando)
                if esp is not None:
                    linhas.append({"indicador": ind, "ano": ano, "quando": rotulo,
                                   "esperado": round(esp, 2), "realizado": round(real, 2),
                                   "erro_pp": round(real - esp, 2)})
    # TODO: incluir Câmbio (dolar_ptax_venda no fim do ano) e PIB Total.
    #       Atenção: o PIB oficial não está no SGS deste pacote. O que dá para fazer?
    return pd.DataFrame(linhas)


def alertas(focus: pd.DataFrame, semanas: int = 4, limiar: dict | None = None) -> pd.DataFrame:
    """Sinaliza quando a mediana mudou mais que `limiar` nas últimas `semanas`."""
    limiar = limiar or {"IPCA": 0.3, "Selic": 0.5, "Câmbio": 0.15, "PIB Total": 0.3}
    hoje = focus["Data"].max()
    out = []
    for ind, lim in limiar.items():
        for ano in (hoje.year, hoje.year + 1):
            s = serie_semanal(focus, ind, ano)
            if len(s) <= semanas:
                continue
            delta = s.iloc[-1] - s.iloc[-1 - semanas]
            if abs(delta) >= lim:
                out.append({"indicador": ind, "ano_ref": ano, "agora": s.iloc[-1],
                            f"há {semanas} semanas": s.iloc[-1 - semanas], "variacao": round(delta, 2)})
    # TODO: os limiares acima são chutes. Calibrem: qual variação é "anormal"
    #       olhando o histórico (ex.: desvio-padrão das variações de 4 semanas)?
    return pd.DataFrame(out)


# ---------------------------------------------------------------- saída
def grafico_ipca(focus: pd.DataFrame) -> Path:
    hoje = focus["Data"].max()
    fig, ax = plt.subplots(figsize=(9, 4.5))
    for ano in (hoje.year, hoje.year + 1):
        s = serie_semanal(focus, "IPCA", ano)
        ax.plot(s.index, s.values, label=f"IPCA {ano}")
    ax.axhline(META_INFLACAO, ls="--", lw=1, color="gray", label="Meta (3%)")
    ax.set_title("Expectativa de IPCA — mediana do Focus")
    ax.set_ylabel("% no ano")
    ax.legend()
    fig.text(0.01, 0.01, f"Fonte: BCB/Focus. Dados até {hoje:%d/%m/%Y}.", fontsize=8)
    caminho = SAIDA / "expectativa_ipca.png"
    fig.savefig(caminho, dpi=150, bbox_inches="tight")
    return caminho


if __name__ == "__main__":
    SAIDA.mkdir(exist_ok=True)
    focus, sgs = carregar_focus(), carregar_sgs()
    print(f"Focus: {len(focus):,} linhas · dados até {focus['Data'].max():%d/%m/%Y}")

    acc = tabela_acuracia(focus, sgs)
    acc.to_csv(SAIDA / "acuracia.csv", index=False)
    print("\nO mercado acertou?\n", acc.to_string(index=False) if not acc.empty else "(sem anos fechados)")

    al = alertas(focus)
    print("\nAlertas:\n", al.to_string(index=False) if not al.empty else "(nenhum)")

    print("\nGráfico salvo em", grafico_ipca(focus))
    # TODO (tarde): transformar isto num relatório semanal automático (ver README).
