"""Gera modelo/base_modelo.csv: uma linha por ata (236..281) com as variáveis do modelo de nota de tom.

Todas as variáveis vêm das atas (banco/paragrafos.jsonl) e dos rótulos (banco/rotulos.jsonl, banco/indice.json).
Alvo: proxima_decisao (alta, manutencao, corte). A 281 recebe como alvo a decisão da 282
(validacao/selic_oficial.csv). Listas de termos e mapeamento de seções fixados em DECISOES.md. Sem Claude.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
B = RAIZ / "banco"
SAIDA = RAIZ / "modelo" / "base_modelo.csv"

# Lista FIXA (DECISOES.md). Prefixos sem acento.
TERMOS_VIRADA = ["interrupcao", "pausa", "prolongad", "magnitude", "calibragem", "calibracao", "encerramento",
                 "continuidade", "ritmo", "ajuste", "ciclo", "interromper", "antecipar", "vigilante",
                 "perseveranca", "serenidade"]
TEMAS = {
    "inflacao": ["inflac", "ipca", "precos", "desinflac"],
    "expectativas": ["expectativ", "focus", "projec", "ancorag", "desancorag"],
    "atividade": ["atividade", "pib", "crescimento", "demanda", "hiato", "consumo"],
    "mercado_trabalho": ["mercado de trabalho", "emprego", "desemprego", "desocupac", "salari", "rendimento"],
    "cambio": ["cambi", "dolar", "moeda"],
    "fiscal": ["fiscal", "divida publica", "gasto", "despesa", "endividamento"],
    "cenario_externo": ["extern", "global", "internacion", "estados unidos", "economias avancadas", "emergentes",
                        "commodit"],
}
# Seção → chaves no título (sem acento). Externo e expectativas não têm título próprio → 0.
SECOES = {
    "cenario_externo": [],
    "cenario_domestico": ["conjuntura"],
    "expectativas_projecoes": [],
    "balanco_riscos": ["risco"],
    "decisao_orientacao": ["conducao", "decis"],
}
NORM = {"baixa": "corte", "corte": "corte", "alta": "alta", "manutencao": "manutencao"}


def sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if not unicodedata.combining(c))


def contar(texto_sa: str, termos) -> int:
    return sum(len(re.findall(r"\b" + t, texto_sa)) for t in termos)


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
    pars["secao_sa"] = pars["secao"].map(sem_acento)
    of = oficial()

    linhas, niveis, ant_n = [], [], None
    for a in atas:
        n = a["numero"]
        p = pars[pars["ata"] == n]
        notas = p["nota"].dropna().astype(float)
        tot = max(len(notas), 1)
        nivel = float(indice.get(n, 0.0) or 0.0)
        niveis.append(nivel)
        texto = sem_acento(" ".join(p["texto"]))
        palavras = max(len(texto.split()), 1)
        dec = p[p["secao_sa"].str.contains("decis")]
        alvo = a.get("proxima_decisao")
        fonte_alvo = "banco/atas.json"
        if not alvo and (n + 1) in of:
            alvo, fonte_alvo = of[n + 1]["decisao"], "validacao/selic_oficial.csv (historicotaxasjuros)"
        lin = {"ata": n, "data_reuniao": a["data_reuniao"], "decisao_registrada_na_ata": NORM.get(a["decisao"], a["decisao"]),
               "tom_nivel": round(nivel, 4),
               "tom_variacao": round(nivel - niveis[-2], 4) if len(niveis) > 1 else 0.0,
               "tom_media_3_atas": round(float(np.mean(niveis[-3:])), 4)}
        for nome, chaves in SECOES.items():
            sub = p[p["secao_sa"].map(lambda s: any(k in s for k in chaves))] if chaves else p.iloc[0:0]
            v = sub["nota"].dropna()
            lin[f"tom_{nome}"] = round(float(v.mean()), 4) if len(v) else 0.0
        lin.update({
            "saldo_duro_brando": round(((notas > 0).sum() - (notas < 0).sum()) / tot, 4),
            "proporcao_muito_duro": round((notas == 2).sum() / tot, 4),
            "proporcao_muito_brando": round((notas == -2).sum() / tot, 4),
            "dispersao_notas": round(float(notas.std(ddof=0)) if len(notas) else 0.0, 4),
            "sinais_virada": int(sum(contar(sem_acento(t), TERMOS_VIRADA) for t in dec["texto"])),
        })
        for tema, termos in TEMAS.items():
            lin[f"termos_{tema}"] = round(1000 * contar(texto, termos) / palavras, 3)
        lin["n_paragrafos"] = int(len(p))
        lin["var_n_paragrafos"] = int(len(p) - ant_n) if ant_n is not None else 0
        lin.update({"proxima_decisao": alvo, "fonte_alvo": fonte_alvo})
        linhas.append(lin)
        ant_n = len(p)
    return pd.DataFrame(linhas)


def main() -> int:
    df = montar()
    SAIDA.parent.mkdir(exist_ok=True)
    df.to_csv(SAIDA, index=False, encoding="utf-8")
    print(f"modelo/base_modelo.csv: {len(df)} linhas, {int(df['proxima_decisao'].notna().sum())} com alvo")
    return 0


if __name__ == "__main__":
    sys.exit(main())
