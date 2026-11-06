"""
Verifica se o BC publicou ata do Copom que ainda não está em banco/atas.json e atualiza saida/status.json.

    .venv/Scripts/python.exe pipeline/verificar_nova.py

Usa o mesmo endpoint de atualizar_banco.py (3 tentativas). Imprime as atas novas e, se a variável
GITHUB_OUTPUT existir (GitHub Actions), grava nela:
  nova=true|false, atas=<lista>,
  pendente=true|false   (ata sem nota, nota só do TF-IDF ou textos automáticos, refeitos quando há Claude),
  keepalive=true|false  (último commit de manutenção há mais de 6 dias: commit semanal de status.json),
  token_expirando=true|false, token_dias=<n>  (faltam ≤ 30 dias para 1 ano de token_cadastrado_em).
saida/status.json: {ultima_verificacao, ultimo_commit_keepalive, token_cadastrado_em, token_expira_em, fluxo}.
`token_cadastrado_em` (AAAA-MM-DD) é informado pelo usuário; o script só o lê.
Sai com 0, exceto se o BC não responder após 3 tentativas (sai com 1).
"""
import json
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from atualizar_banco import ARQ_ATAS, listar_atas  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
BRASILIA = timezone(timedelta(hours=-3))
ARQ_STATUS = RAIZ / "saida" / "status.json"
ARQ_ROTULOS = RAIZ / "banco" / "rotulos.jsonl"
ARQ_TEXTOS = RAIZ / "saida" / "textos.json"
DIAS_KEEPALIVE = 6


def pendencias() -> list[str]:
    """O que uma execução anterior deixou no plano B (refeito pelo workflow quando há Claude)."""
    out = []
    if ARQ_TEXTOS.exists():
        t = json.loads(ARQ_TEXTOS.read_text(encoding="utf-8"))
        if t.get("origem") == "automatico" or (t.get("impacto") or {}).get("origem") == "automatico":
            out.append(f"textos automáticos da ata {t.get('ata_atual')}")
    ultimo = {}
    if ARQ_ROTULOS.exists():
        with ARQ_ROTULOS.open(encoding="utf-8") as f:
            for l in f:
                if l.strip():
                    r = json.loads(l)
                    ultimo[r["ata"]] = r.get("modelo")
    if ARQ_ATAS.exists():
        for a in json.loads(ARQ_ATAS.read_text(encoding="utf-8")):
            m = ultimo.get(a["numero"])
            if m is None:
                out.append(f"ata {a['numero']} sem nota")
            elif m == "tfidf_base":
                out.append(f"ata {a['numero']} com nota do TF-IDF de base")
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

    banco = json.loads(ARQ_ATAS.read_text(encoding="utf-8")) if ARQ_ATAS.exists() else []
    conhecidas = {a["numero"] for a in banco}
    novas = sorted(a["numero"] for a in listagem if a["numero"] not in conhecidas)
    print(f"{len(listagem)} atas no BC; {len(conhecidas)} no banco; novas: {novas or 'nenhuma'}")
    pend = pendencias()
    print(f"Pendências de execução anterior: {pend or 'nenhuma'}")

    agora = datetime.now(BRASILIA)
    status = json.loads(ARQ_STATUS.read_text(encoding="utf-8")) if ARQ_STATUS.exists() else {}
    ult_k = status.get("ultimo_commit_keepalive")
    keepalive = not ult_k or agora - datetime.fromisoformat(ult_k) > timedelta(days=DIAS_KEEPALIVE)
    cadastro = status.get("token_cadastrado_em")
    expira, dias = None, None
    if cadastro:
        expira = date.fromisoformat(cadastro[:10]) + timedelta(days=365)
        dias = (expira - agora.date()).days
    status = {
        "ultima_verificacao": agora.isoformat(timespec="seconds"),
        "ultimo_commit_keepalive": agora.isoformat(timespec="seconds") if keepalive else ult_k,
        "token_cadastrado_em": cadastro,
        "token_expira_em": expira.isoformat() if expira else None,
        "fluxo": {
            "agenda": "dias úteis às 10h, 14h e 18h de Brasília (GitHub Actions)",
            "ultima_ata_no_banco": max(conhecidas) if conhecidas else None,
            "atas_novas": novas,
            "pendencias": pend,
            "token_no_ambiente": bool(os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")),
        },
    }
    ARQ_STATUS.parent.mkdir(exist_ok=True)
    ARQ_STATUS.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"saida/status.json: keepalive {keepalive}; token expira em {status['token_expira_em']} ({dias} dias)")

    saida = os.environ.get("GITHUB_OUTPUT")
    if saida:
        with open(saida, "a", encoding="utf-8") as f:
            f.write(f"nova={'true' if novas else 'false'}\n")
            f.write(f"atas={' '.join(map(str, novas))}\n")
            f.write(f"pendente={'true' if pend else 'false'}\n")
            f.write(f"keepalive={'true' if keepalive else 'false'}\n")
            f.write(f"token_expirando={'true' if dias is not None and dias <= 30 else 'false'}\n")
            f.write(f"token_dias={'' if dias is None else dias}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
