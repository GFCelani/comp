"""
Case 1 — Envio do e-mail semanal pelo Gmail.

Lê as credenciais de avancado/case1_focus/.env (copie .env.exemplo para .env e preencha).
O .env NUNCA vai para o GitHub: o .gitignore já o ignora.

Teste sozinho:
    python avancado/case1_focus/enviar_email.py
"""
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

ENV = Path(__file__).resolve().parent / ".env"


def ler_env(caminho: Path = ENV) -> dict:
    if not caminho.exists():
        raise SystemExit(f"Arquivo {caminho} não encontrado. Copie .env.exemplo para .env e preencha.")
    cfg = {}
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            chave, valor = linha.split("=", 1)
            cfg[chave.strip()] = valor.strip().strip('"').strip("'")
    for chave in ("GMAIL_USUARIO", "GMAIL_SENHA_DE_APP", "DESTINATARIOS"):
        if not cfg.get(chave):
            raise SystemExit(f"Falta {chave} no .env")
    return cfg


def enviar(assunto: str, html: str) -> list[str]:
    cfg = ler_env()
    destinatarios = [d.strip() for d in cfg["DESTINATARIOS"].split(",") if d.strip()]
    msg = MIMEMultipart("alternative")
    msg["Subject"], msg["From"], msg["To"] = assunto, cfg["GMAIL_USUARIO"], ", ".join(destinatarios)
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context()) as s:
        s.login(cfg["GMAIL_USUARIO"], cfg["GMAIL_SENHA_DE_APP"].replace(" ", ""))
        s.sendmail(cfg["GMAIL_USUARIO"], destinatarios, msg.as_string())
    return destinatarios


if __name__ == "__main__":
    para = enviar("Teste do agente do Focus", "<p>Se você recebeu isto, o envio está funcionando.</p>")
    print("E-mail de teste enviado para", ", ".join(para))
