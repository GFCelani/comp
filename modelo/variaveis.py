"""Gera modelo/base_modelo.csv: uma linha por ata (236..281) com as variáveis do modelo de decisão.

Alvo: proxima_decisao (alta, manutencao, corte). A 281 recebe como alvo a decisão da 282
(validacao/selic_oficial.csv, fonte: endpoint oficial historicotaxasjuros do BC).
A linha de previsão da 283 (prever=1) usa o texto da 281 com decisao_atual = decisão da 282.
Sem chamadas ao Claude.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
B = RAIZ / "banco"
SAIDA = RAIZ / "modelo" / "base_modelo.csv"

# Lista FIXA (DECISOES.md), definida antes de qualquer teste. Prefixos sem acento.
TERMOS_VIRADA = ["interrupcao", "pausa", "prolongad", "magnitude", "calibragem", "calibracao", "encerramento",
                 "continuidade", "ritmo", "ajuste", "ciclo", "interromper", "antecipar", "vigilante",
                 "perseveranca", "serenidade"]
META = {2021: 3.75, 2022: 3.50, 2023: 3.25}  # 3,00 de 2024 em diante
NORM = {"baixa": "corte", "corte": "corte", "alta": "alta", "manutencao": "manutencao"}


def sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if not unicodedata.combining(c))


def contar_termos(texto: str) -> int:
    t = sem_acento(texto)
    return sum(len(re.findall(r"\b" + termo, t)) for termo in TERMOS_VIRADA)


def ler_jsonl(p: Path):
    with open(p, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def oficial() -> dict:
    p = RAIZ / "validacao" / "selic_oficial.csv"
    if not p.exists():
        return {}
    df = pd.read_csv(p)
    return {int(r.numero): {"data": r.data_reuniao, "decisao": NORM.get(r.decisao, r.decisao)} for r in df.itertuples()}


def montar() -> pd.DataFrame:
    atas = sorted(json.loads((B / "atas.json").read_text(encoding="utf-8")), key=lambda a: a["numero"])
    indice = {a["ata"]: (a.get("indice") or 0.0) for a in json.loads((B / "indice.json").read_text(encoding="utf-8"))["atas"]}
    pars = pd.DataFrame(ler_jsonl(B / "paragrafos.jsonl"))
    rot = pd.DataFrame(ler_jsonl(B / "rotulos.jsonl"))[["ata", "paragrafo", "nota"]]
    pars = pars.merge(rot, on=["ata", "paragrafo"], how="left")
    focus = pd.read_csv(RAIZ / "data" / "case1_focus" / "focus_anuais.csv")
    focus = focus[(focus["Indicador"] == "Selic") & (focus["baseCalculo"] == 0)].copy()
    focus["DataReferencia"] = focus["DataReferencia"].astype(str)
    sgs = pd.read_csv(RAIZ / "data" / "case1_focus" / "sgs_realizado.csv")
    ipca = sgs[sgs["serie"] == "ipca_12m"].sort_values("data")
    of = oficial()

    linhas, ant = [], None
    for a in atas:
        n = a["numero"]
        p = pars[pars["ata"] == n]
        dec = p[p["secao"].map(lambda s: "decis" in sem_acento(s))]
        fonte_sec = "secao_decisao"
        if dec.empty:
            ult = list(dict.fromkeys(p["secao"]))[-3:]
            dec, fonte_sec = p[p["secao"].isin(ult)], "ultimas_3_secoes"
        notas = p["nota"].dropna()
        nivel = float(indice.get(n, 0.0) or 0.0)
        d = a["data_reuniao"]
        ano = d[:4]
        fsub = focus[(focus["Data"] <= d) & (focus["DataReferencia"] == ano)].sort_values("Data")
        med = float(fsub["Mediana"].iloc[-1]) if len(fsub) else None
        isub = ipca[ipca["data"] <= d]
        ipca12 = float(isub["valor"].iloc[-1]) if len(isub) else None
        alvo = a.get("proxima_decisao")
        fonte_alvo = "banco/atas.json"
        if not alvo and (n + 1) in of:
            alvo, fonte_alvo = of[n + 1]["decisao"], "validacao/selic_oficial.csv (historicotaxasjuros)"
        linhas.append({
            "ata": n, "data_reuniao": d, "decisao_atual": a["decisao"],
            "tom_nivel": round(nivel, 4),
            "tom_variacao": round(nivel - ant, 4) if ant is not None else 0.0,
            "tom_orientacao": round(float(dec["nota"].dropna().mean()), 4) if dec["nota"].notna().any() else 0.0,
            "saldo_duro_brando": round(((notas > 0).sum() - (notas < 0).sum()) / max(len(p), 1), 4),
            "sinais_virada": int(sum(contar_termos(t) for t in dec["texto"])),
            "distancia_focus": round(a["selic_apos"] - med, 4) if med is not None else None,
            "hiato_inflacao": round(ipca12 - META.get(int(ano), 3.0), 4) if ipca12 is not None else None,
            "ipca_12m_usado": ipca12, "focus_mediana_usada": med, "secao_usada": fonte_sec,
            "proxima_decisao": alvo, "fonte_alvo": fonte_alvo, "prever": 0,
        })
        ant = nivel
    df = pd.DataFrame(linhas)
    # Linha de previsão da próxima reunião: texto da última ata + decisão mais recente conhecida
    ultima = df.iloc[-1].copy()
    prox_num = int(ultima["ata"]) + 1
    if prox_num in of:
        ultima["decisao_atual"] = of[prox_num]["decisao"]
        ultima["proxima_decisao"] = None
        ultima["fonte_alvo"] = f"linha de previsão da reunião {prox_num + 1} (decisao_atual = decisão da {prox_num})"
        ultima["prever"] = 1
        df = pd.concat([df, ultima.to_frame().T], ignore_index=True)
    return df


def main() -> int:
    df = montar()
    SAIDA.parent.mkdir(exist_ok=True)
    df.to_csv(SAIDA, index=False, encoding="utf-8")
    print(f"modelo/base_modelo.csv: {len(df)} linhas ({int((df['prever'] == 1).sum())} de previsão)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
