"""
Comando único do pipeline. Rode da raiz do repositório:
    .venv/Scripts/python.exe pipeline/rodar.py [--modelo]

atualizar_banco → extrair → diff → selic → rotular (só atas novas) → indice → metricas →
previsao → textos (só se a última ata ou banco/previsao.json mudaram; hash em saida/textos.json) → gerar_dados_site.
Idempotente: sem ata nova, não chama o Claude e não baixa PDFs (só consulta a lista do BC;
Selic/Focus só são baixados uma vez por dia).
Planos B (o pipeline nunca para): nota = modelo do parceiro > Claude > TF-IDF de base;
textos = Claude > versão automática por código. conferir_selic compara com a tabela oficial do BC.
Se GITHUB_OUTPUT existir, grava `claude_falhou=true|false` (token presente, mas o Claude falhou).
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import claude_cli  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
PY = sys.executable


def ultima_ata() -> int | None:
    arq = RAIZ / "banco" / "paragrafos.jsonl"
    with arq.open(encoding="utf-8") as f:
        atas = {json.loads(l)["ata"] for l in f if l.strip()}
    return max(atas) if atas else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--modelo", action="store_true", help="exige o modelo do parceiro para rotular (sem isso, escolhe sozinho)")
    args = ap.parse_args()

    registro = Path(tempfile.gettempdir()) / f"copom_chamadas_{os.getpid()}.txt"
    reg_falhas = Path(tempfile.gettempdir()) / f"copom_falhas_{os.getpid()}.txt"
    registro.unlink(missing_ok=True)
    reg_falhas.unlink(missing_ok=True)
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "COPOM_REGISTRO_CHAMADAS": str(registro),
           "COPOM_REGISTRO_FALHAS": str(reg_falhas)}

    etapas = [("atualizar_banco", ["pipeline/atualizar_banco.py"]),
              ("extrair", ["pipeline/extrair.py"]),
              ("diff", ["pipeline/diff.py"]),
              ("selic", ["pipeline/selic.py"]),
              ("conferir_selic", ["pipeline/conferir_selic.py"]),
              ("rotular", ["pipeline/rotular.py"] + (["--modelo"] if args.modelo else [])),
              ("modelo_base", ["pipeline/modelo_base.py"]),
              ("indice", ["pipeline/indice.py"]),
              ("metricas", ["pipeline/metricas.py"]),
              ("previsao", ["pipeline/previsao.py"]),
              ("textos", ["pipeline/textos.py"]),      # textos.py decide pelo hash da entrada
              ("gerar_dados_site", ["pipeline/gerar_dados_site.py"])]
    tempos, falhas = {}, []
    for nome, cmd in etapas:
        print(f"== {nome}", flush=True)
        t0 = time.time()
        r = subprocess.run([PY, *cmd], cwd=RAIZ, env=env)
        tempos[nome] = round(time.time() - t0, 1)
        if r.returncode != 0:
            falhas.append(nome)
            print(f"!! {nome} terminou com código {r.returncode}", flush=True)
            if nome in ("extrair", "rotular", "indice", "gerar_dados_site"):
                break

    chamadas = len(registro.read_text(encoding="utf-8").splitlines()) if registro.exists() else 0
    erros_claude = reg_falhas.read_text(encoding="utf-8").splitlines() if reg_falhas.exists() else []
    registro.unlink(missing_ok=True)
    reg_falhas.unlink(missing_ok=True)
    print("\nTempo por etapa (s): " + ", ".join(f"{k} {v}" for k, v in tempos.items()))
    print(f"Chamadas ao Claude nesta execução: {chamadas}; falhas do Claude: {len(erros_claude)}")
    print(f"Falhas: {falhas or '-'}")
    claude_falhou = bool(erros_claude) and bool(os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"))
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"claude_falhou={str(claude_falhou).lower()}\n")
            f.write(f"erro_claude={(erros_claude[-1] if erros_claude else '')[:200]}\n")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
