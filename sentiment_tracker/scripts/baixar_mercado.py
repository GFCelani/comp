"""
Baixa as séries de mercado usadas para medir a reação às atas do Copom (2021 → hoje).

    .venv/bin/python scripts/baixar_mercado.py

Saída: dados/mercado.csv (uma linha por dia útil), colunas:
    data            dia (YYYY-MM-DD)
    pre_1a, pre_2a  taxa prefixada de 1 e 2 anos (% a.a.), interpolada das LTN (Tesouro Prefixado)
                    — proxy aberto do DI futuro; taxa "manhã" do Tesouro Direto (fixada ~9h30,
                    depois da ata, que sai às 8h)
    selic_meta      Selic meta (SGS 432)
    dolar           PTAX venda (SGS 1)
    ibov            Ibovespa, fechamento (Yahoo ^BVSP)
    ust_2a          Treasury 2 anos EUA (FRED DGS2) — controle de choque externo
Também salva dados/focus_selic.csv (mediana Focus para a Selic por reunião futura, por data).

Fontes: Tesouro Transparente, Banco Central (SGS, Olinda/Focus), Yahoo Finance, FRED.
"""
from io import StringIO
from pathlib import Path

import numpy as np
import pandas as pd
import requests

RAIZ = Path(__file__).resolve().parents[1]
DADOS = RAIZ / "dados"
INICIO = "2020-10-01"
UA = {"User-Agent": "Mozilla/5.0 (copom-sentiment-tracker)"}


def get(url: str, timeout: int = 120, tentativas: int = 4) -> requests.Response:
    """GET com retry (o proxy de rede às vezes derruba a conexão)."""
    import time
    for i in range(tentativas):
        try:
            r = requests.get(url, headers=UA, timeout=timeout)
            r.raise_for_status()
            return r
        except requests.RequestException:
            time.sleep(2 * 2 ** i)
    # alternativa: curl (o proxy às vezes recusa o requests mas aceita o curl)
    import subprocess
    out = subprocess.run(["curl", "-sSL", "--http1.1", "--max-time", str(timeout), "-A", UA["User-Agent"], url],
                         capture_output=True, check=True)
    r = requests.models.Response()
    r._content, r.status_code, r.encoding = out.stdout, 200, "utf-8"
    return r


TD_URL = ("https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/"
          "resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv")


def prefixado_constante() -> pd.DataFrame:
    """Taxa prefixada de prazo constante (1 e 2 anos) por interpolação linear entre as LTN do dia."""
    txt = get(TD_URL, timeout=180).text
    td = pd.read_csv(StringIO(txt), sep=";", decimal=",")
    td = td[td["Tipo Titulo"] == "Tesouro Prefixado"].copy()
    td["base"] = pd.to_datetime(td["Data Base"], dayfirst=True)
    td["venc"] = pd.to_datetime(td["Data Vencimento"], dayfirst=True)
    td = td[td["base"] >= INICIO]
    td["anos"] = (td["venc"] - td["base"]).dt.days / 365.25
    td["taxa"] = td["Taxa Compra Manha"]
    linhas = []
    for dia, g in td.groupby("base"):
        g = g.sort_values("anos")
        x, y = g["anos"].to_numpy(), g["taxa"].to_numpy()
        lin = {"data": dia}
        for alvo, nome in ((1.0, "pre_1a"), (2.0, "pre_2a")):
            lin[nome] = float(np.interp(alvo, x, y)) if x.min() <= alvo <= x.max() else np.nan
        linhas.append(lin)
    return pd.DataFrame(linhas)


def sgs(codigo: int, nome: str) -> pd.DataFrame:
    partes = []
    for ini, fim in (("01/10/2020", "31/12/2023"), ("01/01/2024", "31/12/2027")):   # API limita a 10 anos
        url = (f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json"
               f"&dataInicial={ini}&dataFinal={fim}")
        partes.append(pd.DataFrame(get(url, timeout=60).json()))
    df = pd.concat(partes)
    df["data"] = pd.to_datetime(df["data"], dayfirst=True)
    df[nome] = pd.to_numeric(df["valor"])
    return df[["data", nome]].drop_duplicates("data")


def ibov() -> pd.DataFrame:
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?interval=1d"
           "&period1=1601510400&period2=4102444800")
    r = get(url, timeout=60).json()["chart"]["result"][0]
    df = pd.DataFrame({"ts": r["timestamp"], "ibov": r["indicators"]["quote"][0]["close"]})
    df["data"] = pd.to_datetime(df["ts"], unit="s", utc=True).dt.tz_convert("America/Sao_Paulo").dt.normalize().dt.tz_localize(None)
    return df[["data", "ibov"]].dropna()


def ust2() -> pd.DataFrame:
    txt = get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2&cosd={INICIO}", timeout=60).text
    df = pd.read_csv(StringIO(txt))
    df.columns = ["data", "ust_2a"]
    df["data"] = pd.to_datetime(df["data"])
    df["ust_2a"] = pd.to_numeric(df["ust_2a"], errors="coerce")
    return df


def focus_selic() -> pd.DataFrame:
    url = ("https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoSelic"
           f"?$filter=Data%20ge%20'{INICIO}'%20and%20baseCalculo%20eq%200"
           "&$select=Data,Reuniao,Mediana,Media,numeroRespondentes&$format=json&$top=200000")
    df = pd.DataFrame(get(url, timeout=180).json()["value"])
    df["Data"] = pd.to_datetime(df["Data"])
    return df.sort_values(["Data", "Reuniao"])


if __name__ == "__main__":
    DADOS.mkdir(exist_ok=True)
    pre = prefixado_constante()
    print("prefixado:", len(pre), "dias")
    m = pre
    for nome, fn in (("selic", lambda: sgs(432, "selic_meta")), ("dolar", lambda: sgs(1, "dolar")),
                     ("ibov", ibov), ("ust_2a", ust2)):
        try:
            m = m.merge(fn(), on="data", how="left")
        except Exception as e:                               # série complementar: segue sem ela
            print(f"AVISO: {nome} falhou ({e.__class__.__name__}); coluna fica vazia")
            m[nome if nome != "selic" else "selic_meta"] = float("nan")
    m = m.sort_values("data")
    m[["selic_meta", "dolar", "ust_2a"]] = m[["selic_meta", "dolar", "ust_2a"]].ffill()
    m["data"] = m["data"].dt.strftime("%Y-%m-%d")
    m.round(4).to_csv(DADOS / "mercado.csv", index=False)
    print("mercado.csv:", len(m), "linhas,", m["data"].min(), "→", m["data"].max())
    print(m.tail(3).to_string(index=False))
    try:
        f = focus_selic()
        f.to_csv(DADOS / "focus_selic.csv", index=False)
        print("focus_selic.csv:", len(f), "linhas")
    except Exception as e:                                   # Focus é complementar
        print("Focus falhou:", e)
