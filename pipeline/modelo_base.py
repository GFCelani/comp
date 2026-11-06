"""
Modelo de base TF-IDF + regressão logística (plano B da nota de tom, sem LLM).

    .venv/Scripts/python.exe pipeline/modelo_base.py          # treina se houver rótulos novos do Claude
    .venv/Scripts/python.exe pipeline/modelo_base.py --forcar

Treina só nos rótulos do Claude (modelo "sonnet"/"claude-sonnet") de banco/rotulos.jsonl, nunca nos
próprios rótulos tfidf_base. Salva banco/modelo_base.pkl e banco/metricas_modelo_base.json
(validação cruzada estratificada de 5 folds). Retreina quando o número de rótulos do Claude muda.
"""
import argparse
import json
import pickle
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ARQ_PARAGRAFOS = RAIZ / "banco" / "paragrafos.jsonl"
ARQ_ROTULOS = RAIZ / "banco" / "rotulos.jsonl"
ARQ_PKL = RAIZ / "banco" / "modelo_base.pkl"
ARQ_METRICAS = RAIZ / "banco" / "metricas_modelo_base.json"
NOME = "tfidf_base"
MODELOS_CLAUDE = {"sonnet", "claude-sonnet"}


def _jsonl(p: Path) -> list[dict]:
    with p.open(encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def primeira_oracao(texto: str, max_palavras: int = 25) -> str:
    """Primeira oração do parágrafo (até o primeiro ponto final), com no máximo 25 palavras, literal."""
    m = re.search(r"^(.+?[.;:])(\s|$)", texto.strip(), re.S)
    frase = m.group(1) if m else texto
    return " ".join(frase.split()[:max_palavras])


def dados_treino() -> tuple[list[str], list[int]]:
    textos = {(p["ata"], p["paragrafo"]): p["texto"] for p in _jsonl(ARQ_PARAGRAFOS)}
    rot = {}
    for r in _jsonl(ARQ_ROTULOS) if ARQ_ROTULOS.exists() else []:
        if r.get("modelo") in MODELOS_CLAUDE and (r["ata"], r["paragrafo"]) in textos:
            rot[(r["ata"], r["paragrafo"])] = r["nota"]
    chaves = sorted(rot)
    return [textos[k] for k in chaves], [rot[k] for k in chaves]


def novo_pipeline():
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    return make_pipeline(TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True),
                         LogisticRegression(max_iter=2000, class_weight="balanced"))


def treinar(forcar: bool = False) -> dict:
    X, y = dados_treino()
    if len(X) < 50:
        raise RuntimeError(f"poucos rótulos do Claude para treinar ({len(X)})")
    salvo = None
    if ARQ_PKL.exists() and not forcar:
        try:                                     # outra versão do scikit-learn pode não abrir o pickle
            with ARQ_PKL.open("rb") as f:
                salvo = pickle.load(f)
        except Exception as e:
            print(f"  modelo_base.pkl ilegível ({e}); retreinando.")
        if salvo and salvo.get("n_treino") == len(X):
            print(f"Modelo de base já treinado com {len(X)} rótulos do Claude; sem retreino.")
            return salvo
    import numpy as np
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    pred = cross_val_predict(novo_pipeline(), X, y, cv=StratifiedKFold(5, shuffle=True, random_state=42))
    y_arr = np.array(y)
    metricas = {"metodo": "tfidf_logistica", "validacao": "5 folds estratificados (parágrafos), semente 42",
                "gerado_em": datetime.now(timezone(timedelta(hours=-3))).isoformat(timespec="seconds"),
                "n_paragrafos": len(X),
                "acuracia": round(float((pred == y_arr).mean()), 3),
                "acuracia_1ponto": round(float((abs(pred - y_arr) <= 1).mean()), 3),
                "erro_medio_abs": round(float(abs(pred - y_arr).mean()), 3),
                "matriz_confusao": {"rotulos": [-2, -1, 0, 1, 2],
                                    "valores": [[int(((y_arr == i) & (pred == j)).sum()) for j in (-2, -1, 0, 1, 2)]
                                                for i in (-2, -1, 0, 1, 2)]}}
    modelo = novo_pipeline().fit(X, y)
    salvo = {"modelo": modelo, "n_treino": len(X), "metricas": metricas}
    with ARQ_PKL.open("wb") as f:
        pickle.dump(salvo, f)
    ARQ_METRICAS.write_text(json.dumps(metricas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Modelo de base treinado com {len(X)} parágrafos: acurácia 5 folds {metricas['acuracia']}, "
          f"até 1 ponto {metricas['acuracia_1ponto']}, erro médio {metricas['erro_medio_abs']}")
    return salvo


def prever(textos: list[str]) -> list[int]:
    return [int(x) for x in treinar()["modelo"].predict(textos)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--forcar", action="store_true")
    treinar(ap.parse_args().forcar)
    return 0


if __name__ == "__main__":
    sys.exit(main())
