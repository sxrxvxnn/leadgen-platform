"""
Sonar email verification engine.

Pipeline per email:
  1. Syntax check
  2. Disposable domain check
  3. Role / generic address check
  4. MX record check  (via Google DNS over HTTPS)
  5. Catch-all detection (sends a fake RCPT to the MX)
  6. SMTP RCPT-TO check (verifies the exact mailbox)

Result status:
  valid      — SMTP confirmed deliverable (score 90-100)
  risky      — MX exists but SMTP inconclusive or catch-all (score 40-75)
  role       — Generic inbox (info@, support@…) — low reply rate (score 30)
  disposable — Throw-away domain (score 5)
  invalid    — No MX, bad syntax, or SMTP rejected (score 0-10)
  unknown    — Couldn't reach MX server (score 35)
"""

import re
import socket
import smtplib
import requests

# ─── Disposable domain list ───────────────────────────────────────────────────
# Top ~200 disposable / temp-mail providers. Extend as needed.
DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "guerrillamail.info", "guerrillamail.net",
    "guerrillamail.org", "guerrillamail.de", "guerrillamail.biz", "guerrillamail.de",
    "10minutemail.com", "10minutemail.net", "10minutemail.org", "10minutemail.de",
    "10minutemail.co.uk", "10minutemail.us", "10minutemail.info", "10minutemail.be",
    "tempmail.com", "tempmail.net", "tempmail.org", "tempmail.de", "tempmail.us",
    "temp-mail.org", "temp-mail.io", "temp-mail.ru", "temp-mail.net",
    "throwam.com", "throwaway.email", "trashmail.com", "trashmail.at",
    "trashmail.io", "trashmail.me", "trashmail.net", "trashmail.org",
    "yopmail.com", "yopmail.fr", "yopmail.info", "cool.fr.nf", "jetable.fr.nf",
    "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr",
    "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
    "sharklasers.com", "guerrillamailblock.com", "grr.la", "guerrillamail.info",
    "spam4.me", "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
    "spamgourmet.com", "spamspot.com", "spamthisplease.com",
    "maildrop.cc", "mailnull.com", "mailnull.net", "mailnesia.com",
    "mailnesia.com", "mailexpire.com", "mailbolt.com", "mailcat.biz",
    "mailchop.com", "mailcatch.com", "mailnew.com", "mailscrap.com",
    "mailshell.com", "mailsiphon.com", "mailtemp.info", "mailtome.de",
    "mailtothis.com", "mailzilla.com", "makemetheking.com", "manybrain.com",
    "fixmail.tk", "fakedemail.com", "fakeinbox.com", "fakeinbox.net",
    "fakeinformation.com", "fastacura.com", "fastkawasaki.com",
    "fastmazda.com", "fastmitsubishi.com", "fastnissan.com",
    "fastsubaru.com", "fastsuzuki.com", "fasttoyota.com",
    "garbagemail.org", "get1mail.com", "getonemail.com",
    "ghosttexter.de", "gishpuppy.com", "givmail.com", "gliggle.com",
    "glitch.sx", "rnailinator.com", "msft.ninja", "mt2009.com",
    "mt2014.com", "mt2015.com", "mxfuel.com", "myalias.pw",
    "mymail-in.net", "mymailoasis.com", "mynetstore.de",
    "nwldx.com", "objectmail.com", "odaymail.com",
    "omail.pro", "onewaymail.com", "online.ms", "oopi.org",
    "ordinaryamerican.net", "owlpic.com",
    "put2.net", "quickinbox.com", "rcpt.at", "reallymymail.com",
    "receiveee.com", "recode.me", "recursor.net", "regbypass.com",
    "regbypass.comsafe-mail.net", "rhyta.com", "rklips.com",
    "rmqkr.net", "rppkn.com", "rtrtr.com", "s0ny.net",
    "safe-mail.net", "safetymail.info", "safetypost.de",
    "saynotospams.com", "schafmail.de", "schrott-mail.de",
    "secretemail.de", "secure-mail.biz", "seersmail.com",
    "selfdestructingmail.com", "send22u.info", "sendspamhere.com",
    "senseless-entertainment.com", "services391.com", "sharklasers.com",
    "shieldemail.com", "shiftmail.com", "shitmail.me",
    "skeefmail.com", "skrx.tk", "slaskpost.se", "slopsbox.com",
    "smashmail.de", "smellfear.com", "snakemail.com", "sneakemail.com",
    "sofimail.com", "sofort-mail.de", "sogetthis.com",
    "soo.gd", "spam.la", "spam.su", "spamcannon.com",
    "spamcannon.net", "spamcon.org", "spamevader.com",
    "spamfree24.de", "spamfree24.eu", "spamfree24.info",
    "spamfree24.net", "spamfree24.org", "spamgoes.in",
    "spamherelots.com", "spamhereplease.com", "spamhole.com",
    "spamify.com", "spaminator.de", "spamkill.info",
    "spaml.com", "spaml.de", "spammotel.com",
    "dispostable.com", "discard.email", "discardmail.com", "discardmail.de",
    "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org",
    "emailondeck.com", "filzmail.com", "burnermail.io",
    "inboxbear.com", "moakt.co", "moakt.com", "mohmal.com",
    "nowmymail.com", "oneoffmail.com", "owlymail.com",
    "tempinbox.com", "tempsky.com", "tempr.email", "tempsky.com",
    "tempr.email", "throwam.com", "trbvm.com", "trickmail.net",
    "uggsrock.com", "unrealblack.com", "uroid.com",
    "veryrealemail.com", "viditag.com", "viewcastmedia.com",
    "viralplays.com", "vkcode.ru", "vmailing.info",
    "w3internet.co.uk", "webm4il.info", "wegwerfadresse.de",
    "wetrainbayarea.com", "zetmail.com", "zoemail.net", "zoemail.org",
}

# ─── Role / generic local parts ───────────────────────────────────────────────
ROLE_LOCALS = {
    "info", "support", "hello", "contact", "admin", "sales", "help",
    "noreply", "no-reply", "marketing", "press", "hr", "jobs", "careers",
    "team", "office", "mail", "email", "enquiries", "enquiry", "billing",
    "legal", "privacy", "security", "abuse", "postmaster", "webmaster",
    "hostmaster", "newsletter", "feedback", "service", "services",
    "customerservice", "customer-service", "customercare", "customer-care",
    "business", "general", "inquiries", "helpdesk", "help-desk",
    "tech", "technical", "it", "finance", "accounts", "accounting",
    "notifications", "alerts", "mailer", "automailer", "auto",
    "donotreply", "do-not-reply", "bounce", "bounces",
}

_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')

CATCH_ALL_PROBE = "sonar_catchall_zzz_probe_123456@"


def _syntax_ok(email: str) -> bool:
    return bool(_EMAIL_RE.match(email))


def _get_mx(domain: str):
    """Returns (mx_host, all_answers) via Google DoH. None on failure."""
    try:
        resp = requests.get(
            "https://dns.google/resolve",
            params={"name": domain, "type": "MX"},
            timeout=5,
        )
        if resp.status_code == 200:
            answers = resp.json().get("Answer") or []
            if answers:
                sorted_ans = sorted(answers, key=lambda a: int(a["data"].split()[0]))
                return sorted_ans[0]["data"].split()[-1].rstrip("."), answers
    except Exception:
        pass
    return None, None


def _smtp_check(mx_host: str, email: str, timeout: int = 8) -> bool | None:
    """
    Returns True  — RCPT accepted (mailbox exists)
            False — RCPT rejected (mailbox doesn't exist)
            None  — inconclusive (timeout, connection refused, SMTP error)
    """
    try:
        with smtplib.SMTP(timeout=timeout) as smtp:
            smtp.connect(mx_host, 25)
            smtp.ehlo("sonar-verify.app")
            code, _ = smtp.mail("verify@sonar-verify.app")
            if code != 250:
                return None
            code, _ = smtp.rcpt(email)
            return code == 250
    except (socket.timeout, ConnectionRefusedError, OSError):
        return None
    except smtplib.SMTPException:
        return None
    except Exception:
        return None


def _is_catch_all(mx_host: str, domain: str) -> bool | None:
    """
    Send RCPT-TO for a definitely-fake address.
    If accepted → domain is catch-all (accepts everything).
    Returns True/False/None (inconclusive).
    """
    fake = CATCH_ALL_PROBE + domain
    result = _smtp_check(mx_host, fake, timeout=6)
    if result is True:
        return True
    if result is False:
        return False
    return None  # can't tell


def verify_email(email: str) -> dict:
    """
    Full verification pipeline. Returns a dict:
    {
        email:      str,
        status:     "valid" | "risky" | "role" | "disposable" | "invalid" | "unknown",
        score:      int  (0-100),
        reason:     str,
        checks: {
            syntax:     bool,
            mx:         bool,
            disposable: bool,
            role:       bool,
            catch_all:  bool | None,
            smtp:       bool | None,
        }
    }
    """
    email = (email or "").strip().lower()

    checks = {
        "syntax": False, "mx": False, "disposable": False,
        "role": False, "catch_all": None, "smtp": None,
    }

    # 1 — Syntax
    if not _syntax_ok(email):
        return _result("invalid", 0, "Invalid email format", checks, email)
    checks["syntax"] = True

    local, domain = email.split("@", 1)

    # 2 — Disposable domain
    if domain in DISPOSABLE_DOMAINS:
        checks["disposable"] = True
        return _result("disposable", 5, "Disposable / temp-mail domain", checks, email)

    # 3 — Role / generic address
    if local in ROLE_LOCALS:
        checks["role"] = True
        # Still check MX so we know domain is real, but mark risky
        mx_host, _ = _get_mx(domain)
        checks["mx"] = bool(mx_host)
        return _result("role", 30, f"Role address ({local}@) — low reply rate", checks, email)

    # 4 — MX record
    mx_host, _ = _get_mx(domain)
    if not mx_host:
        return _result("invalid", 0, "No MX records — domain doesn't accept email", checks, email)
    checks["mx"] = True

    # 5 — Catch-all detection
    catch_all = _is_catch_all(mx_host, domain)
    checks["catch_all"] = catch_all
    if catch_all is True:
        # Domain accepts everything — we can't confirm the specific mailbox
        return _result("risky", 55, "Catch-all domain — mailbox existence unverifiable", checks, email)

    # 6 — SMTP RCPT-TO
    smtp_result = _smtp_check(mx_host, email)
    checks["smtp"] = smtp_result

    if smtp_result is True:
        return _result("valid", 95, "SMTP confirmed — mailbox exists", checks, email)
    if smtp_result is False:
        return _result("invalid", 5, "SMTP rejected — mailbox does not exist", checks, email)

    # Inconclusive: MX confirmed but can't reach port 25 (common for big providers)
    # Google, Microsoft etc. block port-25 probing — treat as risky not invalid
    if domain.endswith(("gmail.com", "googlemail.com")):
        return _result("risky", 70, "Gmail — SMTP probe blocked, address format valid", checks, email)
    if domain.endswith(("outlook.com", "hotmail.com", "live.com", "msn.com")):
        return _result("risky", 68, "Microsoft — SMTP probe blocked, address format valid", checks, email)
    if domain.endswith(("yahoo.com", "yahoo.co.uk", "ymail.com")):
        return _result("risky", 65, "Yahoo — SMTP probe blocked, address format valid", checks, email)
    if domain.endswith(("icloud.com", "me.com", "mac.com")):
        return _result("risky", 65, "Apple iCloud — SMTP probe blocked", checks, email)

    # Corporate domain with MX but port 25 blocked
    return _result("unknown", 40, "MX confirmed — SMTP unreachable (port 25 blocked)", checks, email)


def _result(status: str, score: int, reason: str, checks: dict, email: str) -> dict:
    return {
        "email":   email,
        "status":  status,
        "score":   score,
        "reason":  reason,
        "checks":  checks,
    }


def status_to_db(result: dict) -> dict:
    """Map verifier output to the DB columns (email_status, email_score)."""
    return {
        "email_status":      result["status"],
        "email_score":       result["score"],
        "email_verified_at": "now()",
    }
