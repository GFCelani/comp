"""
Preenche em banco/atas.json a Selic decidida em cada reunião e a expectativa do Focus.

Rode da raiz do repositório:
    .venv/Scripts/python.exe pipeline/selic.py

1. Roda scripts/baixar_dados_bcb.py se data/case1_focus/{focus_anuais,sgs_realizado}.csv
   não existirem ou não forem de hoje (dados desde 2020-01-01).
2. Para cada ata: selic_apos (série 432 no 1º dia útil após a reunião), decisao_pp
   (diferença para a Selic vigente no dia da reunião), decisao, proxima_decisao_pp/proxima_decisao
   (da ata seguinte; null na última) e focus_selic_fim_ano (mediana do Focus, Indicador=Selic,
   baseCalculo=0, DataReferencia=ano da reunião, na data de coleta mais próxima da reunião).
"""
import json
import subprocess
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
ARQ_ATAS = RAIZ / "banco" / "atas.json"
PASTA_DADOS = RAIZ / "data" / "case1_focus"
ARQ_FOCUS = PASTA_DADOS / "focus_anuais.csv"
ARQ_SGS = PASTA_DADOS / "sgs_realizado.csv"
SCRIPT_BC = RAIZ / "scripts" / "baixar_dados_bcb.py"


def garantir_dados() -> None:
    hoje = date.today()
    atual = all(a.exists() and date.fromtimestamp(a.stat().st_mtime) == hoje for a in (ARQ_FOCUS, ARQ_SGS))
    if atual:
        print("Selic e Focus já baixados hoje; não baixa de novo.")
        return
    print("Baixando Selic e Focus do BC (scripts/baixar_dados_bcb.py)...")
    r = subprocess.run([sys.executable, str(SCRIPT_BC)], cwd=RAIZ)
    if r.returncode == 0:
        return
    # O script do case codifica espaços como "+", que a API Olinda passou a recusar (HTTP 400).
    # Baixa os mesmos arquivos, com as mesmas colunas, codificando os espaços como %20.
    print("Script do case falhou; baixando diretamente com a codificação aceita pelo Olinda...")
    baixar_dados_bc()


def baixar_dados_bc() -> None:
    import importlib.util
    import urllib.parse as up

    import requests

    spec = importlib.util.spec_from_file_location("baixar_dados_bcb", SCRIPT_BC)
    bc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bc)                      # reutiliza constantes e baixar_sgs()
    PASTA_DADOS.mkdir(parents=True, exist_ok=True)
    partes = []
    for ind in bc.INDICADORES:
        q = ("$filter=" + up.quote(f"Indicador eq '{ind}' and Data ge '{bc.INICIO}'")
             + "&$select=Indicador,Data,DataReferencia,Media,Mediana,DesvioPadrao,Minimo,Maximo,numeroRespondentes,baseCalculo"
             + "&$orderby=Data%20asc&$format=json&$top=100000")
        r = requests.get(bc.OLINDA + "?" + q, headers={"User-Agent": "Mozilla/5.0"}, timeout=120)
        r.raise_for_status()
        df = pd.DataFrame(r.json()["value"])
        print(f"Focus {ind}: {len(df)} linhas")
        partes.append(df)
    pd.concat(partes, ignore_index=True).to_csv(ARQ_FOCUS, index=False)

    # SGS: mesma lógica do script, com User-Agent e até 3 tentativas (a API devolve 502 às vezes)
    ini, fim = pd.Timestamp(bc.INICIO).strftime("%d/%m/%Y"), date.today().strftime("%d/%m/%Y")
    partes = []
    for nome, cod in bc.SGS.items():
        url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{cod}/dados"
        for tentativa in range(3):
            try:
                r = requests.get(url, params={"formato": "json", "dataInicial": ini, "dataFinal": fim},
                                 headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"}, timeout=120)
                r.raise_for_status()
                dados = r.json()
                break
            except Exception as e:
                print(f"  SGS {nome}: tentativa {tentativa + 1} falhou ({e})")
                time.sleep(3)
        else:
            raise RuntimeError(f"SGS {nome} ({cod}) falhou 3 vezes")
        df = pd.DataFrame(dados)
        df["data"] = pd.to_datetime(df["data"], format="%d/%m/%Y").dt.date
        df["valor"] = pd.to_numeric(df["valor"], errors="coerce")
        df["serie"], df["codigo_sgs"] = nome, cod
        print(f"SGS {nome} ({cod}): {len(df)} linhas")
        partes.append(df[["data", "serie", "codigo_sgs", "valor"]])
    pd.concat(partes, ignore_index=True).to_csv(ARQ_SGS, index=False)


def carregar_selic() -> pd.Series:
    df = pd.read_csv(ARQ_SGS, parse_dates=["data"])
    df = df[df["serie"] == "selic_meta"].sort_values("data")
    return pd.Series(df["valor"].values, index=df["data"]).astype(float)


def selic_em(selic: pd.Series, dia: date) -> float | None:
    """Selic meta vigente num dia (último valor da série até esse dia, inclusive)."""
    ate = selic[selic.index <= pd.Timestamp(dia)]
    return float(ate.iloc[-1]) if len(ate) else None


def proximo_dia_util(dia: date) -> date:
    d = dia + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def carregar_focus() -> pd.DataFrame:
    df = pd.read_csv(ARQ_FOCUS, parse_dates=["Data"])
    df = df[(df["Indicador"] == "Selic") & (df["baseCalculo"] == 0)]
    return df[["Data", "DataReferencia", "Mediana"]].dropna()


def focus_mais_proximo(focus: pd.DataFrame, reuniao: date) -> dict | None:
    ano = reuniao.year
    sub = focus[focus["DataReferencia"].astype(str) == str(ano)].copy()
    if sub.empty:
        return None
    sub["dist"] = (sub["Data"] - pd.Timestamp(reuniao)).abs()
    linha = sub.sort_values(["dist", "Data"]).iloc[0]
    return {"data": linha["Data"].strftime("%Y-%m-%d"), "ano_referencia": ano,
            "mediana": round(float(linha["Mediana"]), 2)}


def classificar(pp: float | None) -> str | None:
    if pp is None:
        return None
    return "alta" if pp > 0 else "corte" if pp < 0 else "manutencao"


def main() -> int:
    garantir_dados()
    selic, focus = carregar_selic(), carregar_focus()
    atas = json.loads(ARQ_ATAS.read_text(encoding="utf-8"))
    atas.sort(key=lambda a: a["numero"])
    ultimo_dia_selic = selic.index.max().date()

    for a in atas:
        reuniao = datetime.strptime(a["data_reuniao"], "%Y-%m-%d").date()
        dia_apos = proximo_dia_util(reuniao)
        antes = selic_em(selic, reuniao)             # vigente no dia da reunião (decisão vale do dia seguinte)
        apos = selic_em(selic, dia_apos) if dia_apos <= ultimo_dia_selic else None
        a["selic_apos"] = apos
        a["decisao_pp"] = round(apos - antes, 2) if apos is not None and antes is not None else None
        a["decisao"] = classificar(a["decisao_pp"])
        a["focus_selic_fim_ano"] = focus_mais_proximo(focus, reuniao)

    for atual, seguinte in zip(atas, atas[1:] + [None]):
        atual["proxima_decisao_pp"] = seguinte["decisao_pp"] if seguinte else None
        atual["proxima_decisao"] = seguinte["decisao"] if seguinte else None

    ARQ_ATAS.write_text(json.dumps(atas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sem = [a["numero"] for a in atas if a["selic_apos"] is None]
    print(f"{len(atas)} atas atualizadas; Selic até {ultimo_dia_selic}; Focus até {focus['Data'].max().date()}; "
          f"sem Selic: {sem or '-'}")
    for a in atas[-3:]:
        print(f"  {a['numero']} {a['data_reuniao']}: selic_apos={a['selic_apos']} decisao_pp={a['decisao_pp']} "
              f"({a['decisao']}) proxima={a['proxima_decisao_pp']} focus={a['focus_selic_fim_ano']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
