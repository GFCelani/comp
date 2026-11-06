"""
Extrai os parágrafos numerados de todas as atas em banco/atas/ → banco/paragrafos.jsonl.

Rode da raiz do repositório:
    .venv/Scripts/python.exe pipeline/extrair.py            # todas as atas
    .venv/Scripts/python.exe pipeline/extrair.py --ata 281  # mostra os parágrafos de uma ata, sem gravar

Cada linha: {"ata", "paragrafo", "secao", "texto"}.
- paragrafo: a numeração impressa na própria ata ("1.", "2."...), não um contador.
- secao: título da seção ("A) Atualização da conjuntura..."), string vazia se não houver.
- texto: sem cabeçalho, rodapé, número de página, notas de rodapé nem hifenização de fim de linha.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

RAIZ = Path(__file__).resolve().parents[1]
PASTA_ATAS = RAIZ / "banco" / "atas"
ARQ_SAIDA = RAIZ / "banco" / "paragrafos.jsonl"

RE_CABECALHO = [
    re.compile(r"^\s*\d{1,3}[ªº°]?\s*Reuni[aã]o\s*$", re.I),
    re.compile(r"^\s*COPOM\s*$"),
    re.compile(r"^\s*\d{1,2}(\s*(e|a)\s*\d{1,2})?\s+de\s+[a-zç]+(\s+de\s+\d{4})?\s*$", re.I),
    re.compile(r"^\s*(\d{1,3}\s+)?bcb\.gov\.br\s*$", re.I),
]
RE_NUMERO_SOZINHO = re.compile(r"^\s*\d{1,3}\s*$")        # número de página ou marca de nota de rodapé
RE_PARAGRAFO = re.compile(r"^\s*(\d{1,3})\.\s+(\S.*)$")
RE_SECAO = re.compile(r"^\s*([A-H])\)\s+(\S.*)$")
RE_NOTA_RODAPE = re.compile(r"^\s*\d{1,2}\s+[A-ZÀ-ÚO]")  # "1 A menos de menção..."
RE_FIM = re.compile(r"^\s*Tabela\s+\d", re.I)              # tabelas depois do último parágrafo


def texto_do_pdf(caminho: Path) -> list[str]:
    return [p.extract_text() or "" for p in PdfReader(caminho).pages]


def limpar_pagina(texto: str) -> list[str]:
    """Remove cabeçalho, número de página e notas de rodapé de uma página."""
    linhas = texto.split("\n")
    # Notas de rodapé: linha em branco seguida de "N Texto" (sem ponto) ou de "N" sozinho
    # seguido do texto da nota, no terço final da página
    corte = len(linhas)
    for i in range(max(1, int(len(linhas) * 0.6)), len(linhas)):
        if linhas[i - 1].strip() != "" or RE_PARAGRAFO.match(linhas[i]):
            continue
        if RE_NOTA_RODAPE.match(linhas[i]) or (
            RE_NUMERO_SOZINHO.match(linhas[i]) and i + 1 < len(linhas) and linhas[i + 1].strip()
        ):
            corte = i
            break
    linhas = linhas[:corte]
    return [l for l in linhas if not any(r.match(l) for r in RE_CABECALHO) and not RE_NUMERO_SOZINHO.match(l)]


def limpar_texto(t: str) -> str:
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s+([,.;:%)])", r"\1", t)       # "meta ." → "meta."
    t = re.sub(r"\(\s+", "(", t)
    t = re.sub(r"\s+-(se|la|lo|las|los|lhe|lhes|nos)\b", r"-\1", t)   # "situando -se" → "situando-se"
    return t


def paragrafos_da_ata(caminho: Path) -> list[dict]:
    linhas = []
    for pag in texto_do_pdf(caminho):
        linhas += limpar_pagina(pag)
    texto = "\n".join(linhas)
    # Hífen em fim de linha: nestes PDFs (Word, sem hifenização automática) é hífen real
    # quebrado na linha ("norte -\namericana"); junta mantendo o hífen.
    texto = re.sub(r"\s*-\n\s*(?=[a-zà-ú])", "-", texto)
    resultado, atual, secao = [], None, ""
    for linha in texto.split("\n"):
        if RE_FIM.match(linha):
            break
        m_sec = RE_SECAO.match(linha)
        if m_sec:
            if atual:
                resultado.append(atual); atual = None
            secao = re.sub(r"(?<=[a-zà-ú])\s?\d$", "", limpar_texto(m_sec.group(0)))  # tira marca de nota ("Copom1")
            continue
        m_par = RE_PARAGRAFO.match(linha)
        if m_par and (atual is None or int(m_par.group(1)) == atual["paragrafo"] + 1):
            if atual:
                resultado.append(atual)
            atual = {"paragrafo": int(m_par.group(1)), "secao": secao, "texto": m_par.group(2)}
            continue
        if atual is not None and linha.strip():
            atual["texto"] += " " + linha
    if atual:
        resultado.append(atual)
    for p in resultado:
        p["texto"] = limpar_texto(p["texto"])
    return resultado


def numero_da_ata(caminho: Path) -> int | None:
    m = re.match(r"ata_(\d+)_", caminho.stem)
    return int(m.group(1)) if m else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ata", type=int, help="só mostra os parágrafos desta ata, sem gravar")
    args = ap.parse_args()

    pdfs = sorted(PASTA_ATAS.glob("ata_*.pdf"), key=lambda p: numero_da_ata(p) or 0)
    if args.ata:
        pdf = next(p for p in pdfs if numero_da_ata(p) == args.ata)
        for p in paragrafos_da_ata(pdf):
            print(f"[{p['paragrafo']}] ({p['secao'][:40]}) {p['texto'][:160]}")
        return 0

    total, avisos = 0, []
    with ARQ_SAIDA.open("w", encoding="utf-8") as f:
        for pdf in pdfs:
            ata = numero_da_ata(pdf)
            pars = paragrafos_da_ata(pdf)
            nums = [p["paragrafo"] for p in pars]
            if not pars or nums != list(range(1, len(pars) + 1)):
                avisos.append(f"ata {ata}: numeração não sequencial ({nums[:5]}...{nums[-3:]})")
            for p in pars:
                f.write(json.dumps({"ata": ata, **p}, ensure_ascii=False) + "\n")
            total += len(pars)
            print(f"ata {ata}: {len(pars)} parágrafos, seções: {sorted({p['secao'][:2] for p in pars})}")
    print(f"Total: {total} parágrafos de {len(pdfs)} atas -> {ARQ_SAIDA}")
    for a in avisos:
        print("AVISO", a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
