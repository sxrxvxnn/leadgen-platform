"""
34-framework compliance detector.

Scans website content (text, badge images, PDF links) for compliance
certifications. Each hit is classified into a tier (Certified / Attested /
Supports / Mentioned) and scored. Optional Gemma verification via Gemini
REST API applies source bonuses and penalty-phrase caps.

Entry point: detect_compliance(website_data, gemini_key="") → dict
"""
import re as _re
from urllib.parse import urlparse as _up

# ── 34-Framework Knowledge Base ────────────────────────────────────────────────
COMPLIANCE_KB = {
    # SOC — cover press-release phrasing ("achieved", "attained", "earned")
    "SOC 2 Type II":    ["soc 2 type ii", "soc2 type ii", "soc 2 type 2", "soc2 type 2",
                         "soc2 type ii", "soc type ii", "soc ii certified"],
    "SOC 2 Type I":     ["soc 2 type i", "soc2 type i", "soc 2 type 1", "soc2 type 1"],
    "SOC 2":            ["soc 2", "soc2", "aicpa soc", "service organization control 2",
                         "achieved soc", "soc certification", "soc compliant"],
    "SOC 1":            ["soc 1", "soc1", "ssae 18", "ssae 16", "ssae no. 18"],
    # ISO 27001 — extremely common in Indian tech + global SaaS
    "ISO 27001":        ["iso 27001", "iso/iec 27001", "iso-27001", "iso27001",
                         "iso/iec 27001:2013", "iso/iec 27001:2022", "iso 27001:2022",
                         "iso 27001 certified", "iso 27001 compliant",
                         "iso/iec27001", "27001 certified", "iso27001 certification"],
    "ISO 27017":        ["iso 27017", "iso/iec 27017", "iso 27017 certified"],
    "ISO 27018":        ["iso 27018", "iso/iec 27018", "iso 27018 certified"],
    "ISO 27701":        ["iso 27701", "iso/iec 27701", "iso 27701 certified"],
    "ISO 9001":         ["iso 9001", "iso9001", "iso 9001:2015", "iso 9001 certified",
                         "iso9001:2015", "iso 9001 certification"],
    "ISO 22301":        ["iso 22301", "iso 22301 certified", "business continuity management"],
    "PCI DSS":          ["pci dss", "pci-dss", "pci level 1", "pci level 2",
                         "pci compliant", "pci certified",
                         "payment card industry data security", "pci dss compliant",
                         "pci dss certified"],
    "CSA STAR":         ["csa star", "cloud security alliance star", "csa star certified"],
    "Cyber Essentials": ["cyber essentials", "cyber essentials plus", "cyber essentials certified"],
    "TISAX":            ["tisax", "tisax certified", "tisax assessment"],
    "NIST CSF":         ["nist csf", "nist cybersecurity framework", "nist csf compliant"],
    "NIST 800-53":      ["nist 800-53", "nist sp 800-53"],
    "FedRAMP":          ["fedramp", "fedramp authorized", "fedramp certified",
                         "federal risk and authorization management program"],
    "StateRAMP":        ["stateramp", "stateramp authorized"],
    # Privacy regulations — web-search results often say "compliant with GDPR"
    "GDPR":             ["gdpr", "general data protection regulation",
                         "gdpr compliant", "gdpr certified", "gdpr compliance",
                         "compliant with gdpr", "gdpr ready"],
    "CCPA":             ["ccpa", "california consumer privacy act",
                         "ccpa compliant", "ccpa compliance"],
    "CPRA":             ["cpra", "california privacy rights act"],
    "HIPAA":            ["hipaa", "health insurance portability and accountability",
                         "hipaa compliant", "hipaa certified", "hipaa compliance",
                         "compliant with hipaa", "hipaa-compliant"],
    "HITECH":           ["hitech", "hitech compliant"],
    "FERPA":            ["ferpa", "ferpa compliant"],
    "COPPA":            ["coppa", "coppa compliant"],
    "DPDP":             ["dpdp", "digital personal data protection", "dpdp act"],
    "LGPD":             ["lgpd", "lei geral de proteção de dados"],
    "PIPEDA":           ["pipeda"],
    "SOX":              ["sox", "sarbanes-oxley", "sarbanes oxley", "sox compliant"],
    "GLBA":             ["glba", "gramm-leach-bliley", "glba compliant"],
    "PSD2":             ["psd2", "payment services directive"],
    "CJIS":             ["cjis", "criminal justice information services"],
    "FISMA":            ["fisma"],
    "ITAR":             ["itar", "itar compliant", "itar registered"],
    # India-specific — expanded to catch press-release and directory mentions
    "ISO 20000":        ["iso 20000", "iso/iec 20000", "iso20000", "iso 20000 certified",
                         "it service management iso"],
    "CMMI Level 5":     ["cmmi level 5", "cmmi ml5", "cmmi maturity level 5",
                         "cmmi dev 5", "cmmi svc 5", "cmmi-dev/5", "cmmi dev/5",
                         "capability maturity model level 5", "cmmi 5"],
    "CMMI Level 3":     ["cmmi level 3", "cmmi ml3", "cmmi maturity level 3",
                         "cmmi dev 3", "cmmi svc 3", "cmmi-dev/3",
                         "capability maturity model level 3", "cmmi 3"],
    "NASSCOM":          ["nasscom member", "nasscom certified", "nasscom registered",
                         "nasscom foundation", "nasscom company", "member of nasscom",
                         "nasscom emerge 50", "nasscom 10000 startups"],
    "DPIIT Recognized": ["dpiit", "startup india recognized", "recognized by dpiit",
                         "dipp recognized", "department for promotion of industry",
                         "dpiit registered", "dpiit recognition", "startup india dpiit"],
    "CII Member":       ["cii member", "confederation of indian industry", "cii affiliated"],
    "BIS":              ["bis certified", "bis certification", "bureau of indian standards",
                         "bis hallmark"],
}

# ── Tier weights ───────────────────────────────────────────────────────────────
W_CERTIFIED = 10
W_BADGE     = 10
W_PDF       = 10
W_ATTESTED  = 8
W_SUPPORTS  = 5
W_MENTIONED = 1

TIER_ORDER = ["Certified", "Attested", "Supports", "Mentioned"]

_CERT_BADGE_PATHS = frozenset([
    "/trust", "/trust-center", "/certifications", "/audit", "/governance",
    "/iso-27001", "/soc2", "/certifications-and-compliance", "/audit-reports",
])
_TRUSTED_PATHS = _CERT_BADGE_PATHS | frozenset([
    "/security", "/compliance", "/privacy", "/legal",
    "/iso-certifications", "/security-and-compliance",
])

_CERT_PHRASES    = frozenset([
    "certified", "certification", "compliant", "compliance certified",
    "audited", "attestation report", "audit report", "certificate",
    "achieved", "attained", "earned", "obtained", "awarded", "accredited",
    "successfully completed", "has been certified", "is certified",
    "is compliant", "are compliant", "maintains", "holds certification",
])
_ATTEST_PHRASES  = frozenset([
    "attested", "attestation", "meets the requirements",
    "in compliance with", "aligned with", "adheres to",
    "complies with", "meets", "conforms to", "accordance with",
])
_SUPPORT_PHRASES = frozenset(["we support", "supports", "working towards", "in progress",
                               "planning", "road map", "roadmap", "coming soon",
                               "pursuing", "preparing for"])
_TEST_KEYWORDS   = frozenset(["test", "scan", "pentest", "vulnerability", "assessment",
                               "audit tool"])
_PENALTY_PHRASES = frozenset(["working towards", "planning", "roadmap", "pursuing",
                               "not certified"])

_SECURITY_SIGNALS = [
    "security team", "security engineer", "ciso", "chief security",
    "infosec", "information security", "security operations", "soc team", "devsecops",
]


def _page_type(url: str) -> str:
    try:
        path = _up(url).path.lower()
        if any(p in path for p in _CERT_BADGE_PATHS):
            return "cert_badge"
        if any(p in path for p in _TRUSTED_PATHS):
            return "trusted"
    except Exception:
        pass
    return "other"


def _classify_ctx(context: str, ptype: str):
    ctx = context.lower()
    if any(p in ctx for p in _SUPPORT_PHRASES):
        return "Supports", W_SUPPORTS
    if any(p in ctx for p in _CERT_PHRASES):
        if ptype in ("cert_badge", "trusted"):
            return "Certified", W_CERTIFIED
        return "Attested", W_ATTESTED
    if any(p in ctx for p in _ATTEST_PHRASES):
        return "Attested", W_ATTESTED
    if ptype in ("cert_badge", "trusted"):
        return "Attested", W_ATTESTED
    return "Mentioned", W_MENTIONED


def _scan_text(text: str, url: str) -> list:
    hits = []
    tl = text.lower()
    ptype = _page_type(url)
    for fw, aliases in COMPLIANCE_KB.items():
        for alias in aliases:
            idx = tl.find(alias)
            if idx == -1:
                continue
            ctx = text[max(0, idx - 100): idx + len(alias) + 100]
            tier, weight = _classify_ctx(ctx, ptype)
            hits.append((fw, tier, weight, ctx.strip()[:200]))
            break  # one hit per framework per source block
    return hits


def _scan_badges(html: str, url: str) -> list:
    hits = []
    ptype = _page_type(url)
    for img in _re.findall(r'<img[^>]+>', html, _re.I):
        alt_m = _re.search(r'alt=["\']([^"\']*)["\']', img, _re.I)
        src_m = _re.search(r'src=["\']([^"\']*)["\']', img, _re.I)
        alt = alt_m.group(1) if alt_m else ""
        src = src_m.group(1) if src_m else ""
        combined = (alt + " " + src).lower()
        if not combined.strip():
            continue
        is_test = any(t in combined for t in _TEST_KEYWORDS)
        for fw, aliases in COMPLIANCE_KB.items():
            if any(a in combined for a in aliases):
                if is_test:
                    hits.append((fw, "Supports", W_SUPPORTS, f"badge: {combined[:100]}"))
                elif ptype == "cert_badge":
                    hits.append((fw, "Certified", W_BADGE, f"badge: {combined[:100]}"))
                else:
                    hits.append((fw, "Attested", W_BADGE, f"badge: {combined[:100]}"))
    return hits


def _scan_pdfs(html: str, url: str) -> list:
    hits = []
    ptype = _page_type(url)
    for href, link_text in _re.findall(
        r'<a[^>]+href=["\']([^"\']*\.pdf[^"\']*)["\'][^>]*>(.*?)</a>',
        html, _re.I | _re.S,
    ):
        combined = (href + " " + link_text).lower()
        for fw, aliases in COMPLIANCE_KB.items():
            if any(a in combined for a in aliases):
                tier = "Certified" if ptype == "cert_badge" else "Attested"
                hits.append((fw, tier, W_PDF, f"pdf: {link_text[:100].strip()}"))
    return hits


def _aggregate(hits: list) -> dict:
    fw_data: dict = {}
    for fw, tier, weight, snippet in hits:
        if fw not in fw_data:
            fw_data[fw] = {
                "best_tier":   tier,
                "tier_idx":    TIER_ORDER.index(tier),
                "total_score": 0,
                "evidence":    [],
            }
        tidx = TIER_ORDER.index(tier)
        if tidx < fw_data[fw]["tier_idx"]:
            fw_data[fw]["best_tier"] = tier
            fw_data[fw]["tier_idx"]  = tidx
        fw_data[fw]["total_score"] += weight
        if len(fw_data[fw]["evidence"]) < 3:
            fw_data[fw]["evidence"].append(snippet)
    return fw_data


def _score_to_confidence(tier: str, score: float) -> float:
    if tier == "Certified": return min(100, 90 + score * 0.5)
    if tier == "Attested":  return min(94,  78 + score * 0.8)
    if tier == "Supports":  return min(79,  42 + score * 3.0)
    return min(39, 12 + score * 5.0)


def _tier_symbol(tier: str) -> str:
    return {"Certified": "[✓]", "Attested": "[~]",
            "Supports": "[?]", "Mentioned": "[ ]"}.get(tier, "[ ]")


def detect_compliance(website_data: dict, gemini_key: str = "") -> dict:
    """
    Scan website_data (from fetch_website_content) for compliance frameworks.

    Returns:
        {
          "frameworks": [
            {"framework": "SOC 2 Type II", "tier": "Certified", "symbol": "[✓]",
             "confidence": 95, "score": 10, "evidence": [...]}
          ],
          "has_security_team": "Yes" | "Unknown",
          "confidence": "High" | "Medium" | "Low",
          "source": "rule-based" | "rule-based + gemma-verified",
        }
    """
    if not website_data:
        return {
            "frameworks": [], "has_security_team": "Unknown",
            "confidence": "Low", "source": "none",
        }

    url       = website_data.get("url", "")
    full_text = website_data.get("full_text", "")
    scan_html = website_data.get("scan_text", "")

    all_hits = (
        _scan_text(full_text, url) +
        _scan_text(scan_html[:20_000], url) +
        _scan_badges(scan_html, url) +
        _scan_pdfs(scan_html, url)
    )

    fw_data = _aggregate(all_hits)

    results = []
    for fw, d in fw_data.items():
        tier  = d["best_tier"]
        score = d["total_score"]
        if tier == "Mentioned" and score < 5:
            continue  # too weak to report
        results.append({
            "framework":  fw,
            "tier":       tier,
            "symbol":     _tier_symbol(tier),
            "confidence": round(_score_to_confidence(tier, score)),
            "score":      score,
            "evidence":   d["evidence"],
        })

    results.sort(key=lambda x: x["confidence"], reverse=True)

    full_lower = full_text.lower()
    has_security_team = (
        "Yes" if any(s in full_lower for s in _SECURITY_SIGNALS) else "Unknown"
    )

    source = "rule-based"

    # ── Gemma verification (optional) ─────────────────────────────────────────
    if gemini_key and results:
        try:
            import requests as _req, json as _json, re as _re2
            evidence_summary = "\n".join(
                f"- {r['framework']} ({r['tier']}, {r['confidence']}%): "
                + (r["evidence"][0] if r["evidence"] else "no snippet")
                for r in results[:10]
            )
            prompt = (
                "You are a compliance certification verifier. Review these detected compliance "
                "frameworks from a company website and verify which are genuine certifications.\n\n"
                f"Detected:\n{evidence_summary}\n\n"
                "Return ONLY a JSON array:\n"
                '[{"framework":"SOC 2 Type II","verified":true,"tier":"Certified",'
                '"confidence":95,"reason":"explicit cert page"}, ...]\n'
                "Only include frameworks listed above. Do not add new ones."
            )
            resp = _req.post(
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemma-3-27b-it:generateContent?key={gemini_key}",
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 600},
                },
                timeout=25,
            )
            d = resp.json()
            if "candidates" in d:
                raw = d["candidates"][0]["content"]["parts"][0]["text"].strip()
                raw = _re2.sub(r"^```json\s*", "", raw)
                raw = _re2.sub(r"\s*```$", "", raw)
                gemma_out = _json.loads(raw)
                fw_map = {r["framework"]: dict(r) for r in results}
                verified = []
                for gr in gemma_out:
                    fw = gr.get("framework")
                    if fw not in fw_map or not gr.get("verified", True):
                        continue
                    orig   = fw_map[fw]
                    reason = gr.get("reason", "").lower()
                    if any(p in reason for p in _PENALTY_PHRASES):
                        orig["tier"]       = "Supports"
                        orig["confidence"] = min(69, orig["confidence"])
                        orig["symbol"]     = "[?]"
                    else:
                        bonus = 10 if gr.get("tier") == orig["tier"] else 5
                        orig["confidence"] = min(100, orig["confidence"] + bonus)
                        orig["tier"]       = gr.get("tier", orig["tier"])
                        orig["symbol"]     = _tier_symbol(orig["tier"])
                    if orig["confidence"] >= 30:
                        verified.append(orig)
                if verified:
                    results = sorted(verified, key=lambda x: x["confidence"], reverse=True)
                    source  = "rule-based + gemma-verified"
        except Exception as _e:
            print(f"[compliance_detector] Gemma error: {_e}", flush=True)

    top_conf = results[0]["confidence"] if results else 0
    return {
        "frameworks":        results,
        "has_security_team": has_security_team,
        "confidence":        "High" if top_conf >= 80 else "Medium" if top_conf >= 50 else "Low",
        "source":            source,
    }


def format_for_db(detection: dict) -> str:
    """
    Format detected frameworks as a DB string.
    Only Certified and Attested frameworks are included — Supports/Mentioned
    are advisory only.
    Example: "SOC 2 Type II [✓] 95%, ISO 27001 [~] 82%"
    """
    credible = [
        f for f in detection.get("frameworks", [])
        if f["tier"] in ("Certified", "Attested")
    ]
    if not credible:
        return "None detected"
    return ", ".join(
        f"{f['framework']} {f['symbol']} {f['confidence']}%"
        for f in credible
    )
