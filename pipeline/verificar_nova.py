"""
Verifica se o BC publicou ata do Copom que ainda não está em banco/atas.json.

    .venv/Scripts/python.exe pipeline/verificar_nova.py

Usa o mesmo endpoint de atualizar_banco.py (3 tentativas). Imprime as atas novas e, se a
variável GITHUB_OUTPUT existir (GitHub Actions), grava nela `nova=true|false`, `atas=<lista>` e
`pendente=true|false` (ata sem nota ou textos pendentes de uma execução anterior sem Claude).
Também grava `ultima_verificacao` (ISO, fuso -03:00) em saida/dados_site.json e
site/data/dados_site.json, sem mexer em nenhum outro campo.
Sai com 0, exceto se o BC não responder após 3 tentativas (sai com 1).
"""
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from atualizar_banco import ARQ_ATAS, listar_atas  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
BRASILIA = timezone(timedelta(hours=-3))
ARQS_DADOS = [RAIZ / "saida" / "dados_site.json", RAIZ / "site" / "data" / "dados_site.json"]


def agora_brasilia() -> str:
    return datetime.now(BRASILIA).isoformat(timespec="seconds")


def gravar_verificacao(quando: str) -> None:
    for arq in ARQS_DADOS:
        if not arq.exists():
            print(f"  aviso: {arq.relative_to(RAIZ)} não existe; ultima_verificacao não gravada nele")
            continue
        dados = json.loads(arq.read_text(encoding="utf-8"))
        dados["ultima_verificacao"] = quando
        arq.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def pendencias() -> list[str]:
    """Atas do banco sem nota e textos pendentes (de uma execução anterior sem modelo nem Claude)."""
    out = []
    dados = ARQS_DADOS[0]
    if dados.exists() and json.loads(dados.read_text(encoding="utf-8")).get("textos_pendentes"):
        out.append("textos")
    rot = RAIZ / "banco" / "rotulos.jsonl"
    if ARQ_ATAS.exists() and rot.exists():
        with rot.open(encoding="utf-8") as f:
            rotuladas = {json.loads(l)["ata"] for l in f if l.strip()}
        out += [f"ata {a['numero']} sem nota" for a in json.loads(ARQ_ATAS.read_text(encoding="utf-8"))
                if a["numero"] not in rotuladas]
    return out


def main() -> int:
    listagem, erro = None, None
    for t in range(3):
        try:
            listagem = listar_atas()
            break
        except Exception as e:
            erro = e
            print(f"  tentativa {t + 1} falhou: {e}", flush=True)
            if t < 2:
                time.sleep(10)
    if listagem is None:
        print(f"ERRO: BC não respondeu após 3 tentativas: {erro}")
        return 1

    conhecidas = {a["numero"] for a in json.loads(ARQ_ATAS.read_text(encoding="utf-8"))} if ARQ_ATAS.exists() else set()
    novas = sorted(a["numero"] for a in listagem if a["numero"] not in conhecidas)
    print(f"{len(listagem)} atas no BC; {len(conhecidas)} no banco; novas: {novas or 'nenhuma'}")

    pend = pendencias()
    print(f"Pendências de execução anterior: {pend or 'nenhuma'}")
    gravar_verificacao(agora_brasilia())

    saida = os.environ.get("GITHUB_OUTPUT")
    if saida:
        with open(saida, "a", encoding="utf-8") as f:
            f.write(f"nova={'true' if novas else 'false'}\n")
            f.write(f"atas={' '.join(map(str, novas))}\n")
            f.write(f"pendente={'true' if pend else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
