"""
Generate synthetic fine-tuning training data for 4 use cases.
Pure Python — no API calls needed. Produces 60 varied examples per use case.

Usage:
    python3 scripts/generate_training_data.py

Output (4 JSONL files ready for Google AI Studio):
    scripts/finetune_email_writer.jsonl
    scripts/finetune_lead_scorer.jsonl
    scripts/finetune_enrichment.jsonl
    scripts/finetune_icp_matcher.jsonl
"""

import json
import os
import random

random.seed(42)

# ── Seed pools ─────────────────────────────────────────────────────────────────

FIRST_NAMES = ["Sarah", "James", "Priya", "Michael", "Emma", "David", "Sofia",
               "Alex", "Nina", "Ryan", "Zara", "Marcus", "Lena", "Omar", "Claire"]

TITLES = [
    ("CTO", "technical", "engineering"),
    ("CEO", "strategic", "growth"),
    ("VP of Sales", "revenue", "pipeline"),
    ("Head of Growth", "acquisition", "conversion"),
    ("CISO", "security", "compliance"),
    ("Co-Founder", "strategic", "product"),
    ("CPO", "product", "roadmap"),
    ("Director of Engineering", "technical", "delivery"),
    ("Head of Security", "security", "risk"),
    ("CRO", "revenue", "forecasting"),
    ("VP of Engineering", "technical", "scaling"),
    ("Head of Partnerships", "partnerships", "ecosystem"),
    ("Director of Marketing", "pipeline", "brand"),
    ("COO", "operations", "efficiency"),
]

COMPANIES = [
    ("Rippling", "HRTech", "501-1000", True, "workforce management"),
    ("Deel", "HRTech", "1001-5000", True, "global payroll"),
    ("Drata", "Cybersecurity", "201-500", True, "compliance automation"),
    ("Vanta", "Cybersecurity", "51-200", True, "security monitoring"),
    ("Clerk", "DevTools", "11-50", True, "authentication"),
    ("Supabase", "DevTools", "51-200", True, "database infrastructure"),
    ("Merge", "DataAnalytics", "11-50", True, "API integrations"),
    ("Hightouch", "DataAnalytics", "51-200", True, "data activation"),
    ("Retool", "DevTools", "201-500", True, "internal tooling"),
    ("Brex", "FinTech", "501-1000", True, "business banking"),
    ("Ramp", "FinTech", "501-1000", True, "spend management"),
    ("Gusto", "HRTech", "1001-5000", True, "payroll and benefits"),
    ("Linear", "DevTools", "11-50", True, "project management"),
    ("Vercel", "CloudInfrastructure", "201-500", True, "deployment platform"),
    ("Segment", "DataAnalytics", "501-1000", True, "customer data platform"),
    ("Intercom", "SaaS", "501-1000", True, "customer messaging"),
    ("Loom", "SaaS", "201-500", True, "video messaging"),
    ("Notion", "SaaS", "201-500", True, "knowledge management"),
    ("Figma", "SaaS", "1001-5000", True, "design collaboration"),
    ("Webflow", "DevTools", "201-500", True, "website building"),
]

PAIN_POINTS = [
    "scaling outbound without adding headcount",
    "poor lead data quality from current tools",
    "too much time spent on manual prospecting",
    "low email reply rates",
    "no visibility into which accounts are ready to buy",
    "difficulty identifying decision-makers at target companies",
    "CRM data going stale too quickly",
    "too many disconnected tools that don't integrate",
    "compliance concerns around outreach at scale",
    "missing signals on when prospects change jobs",
    "long sales cycles with unclear next steps",
    "no way to prioritize the best-fit accounts",
]

TECH_STACKS = [
    ["Salesforce", "HubSpot", "Outreach"],
    ["Pipedrive", "Apollo", "Slack"],
    ["Notion", "Linear", "Vercel", "Supabase"],
    ["Segment", "Mixpanel", "Intercom"],
    ["AWS", "Terraform", "Datadog"],
    ["Stripe", "Paddle", "Chargebee"],
    ["Snowflake", "dbt", "Looker"],
    ["Jira", "Confluence", "GitHub"],
    ["HubSpot", "Clearbit", "Gong"],
    ["Salesforce", "Outreach", "ZoomInfo"],
]

EMAIL_HOOKS = [
    ("noticed", "your team is scaling fast"),
    ("saw", "you recently expanded into enterprise"),
    ("read", "your post on building a lean sales motion"),
    ("noticed", "Drata just raised their Series B"),
    ("saw", "you're hiring 3 AEs right now"),
    ("noticed", "you spoke at SaaStr last month"),
    ("came across", "your LinkedIn post on pipeline quality"),
    ("saw", "your team just launched a new product"),
]

EMAIL_CTAS = [
    "Worth a 15-min call this week?",
    "Open to a quick chat to see if it's relevant?",
    "Happy to share how similar teams are doing this — interested?",
    "Would it make sense to connect for 15 minutes?",
    "Curious if this is something worth exploring together?",
]

SCORE_REASONS = {
    "high": [
        "Strong ICP match — decision-maker title at a growth-stage SaaS company within the target size range. High-intent signals suggest active evaluation.",
        "Excellent fit — verified email, right industry, and seniority level matches ideal buyer profile. Prior engagement indicates interest.",
        "Top-tier lead — title and company size align perfectly with ICP. Cybersecurity-adjacent role adds urgency around compliance signals.",
        "Very strong match — co-founder/C-suite at a Series B SaaS company. Tech stack overlap suggests they'd immediately understand the value prop.",
    ],
    "mid": [
        "Moderate fit — right industry but company is slightly outside the ideal size range. Title suggests influence but not final decision authority.",
        "Decent prospect — industry aligns but engagement signals are weak. Worth nurturing but not high-priority outreach.",
        "Reasonable match — the title is right but the company is pre-product-market fit, which may delay purchasing decisions.",
        "Mixed signals — company size and industry are a good fit, but no verified email and zero engagement lowers confidence.",
    ],
    "low": [
        "Poor ICP match — company is too large (enterprise) and likely has entrenched vendors. Long sales cycles expected.",
        "Weak fit — industry is outside target verticals and title is too junior to influence a purchase decision.",
        "Not a good match — company is in a non-tech industry with no SaaS buying signals. Low priority.",
        "Disqualified — role is operational, not technical or revenue-focused. Unlikely to be a champion for this solution.",
    ],
}

ENRICH_OUTPUTS = [
    {
        "classification": "B2B SaaS",
        "company_size_tier": "Mid-Market",
        "growth_stage": "Series B",
        "target_customer": "growth-stage SaaS companies",
        "buying_signals": ["hiring sales team", "recent funding"],
    },
    {
        "classification": "Infrastructure",
        "company_size_tier": "Startup",
        "growth_stage": "Series A",
        "target_customer": "developer teams at startups",
        "buying_signals": ["open job postings for engineers", "product-led growth signals"],
    },
    {
        "classification": "Enterprise Software",
        "company_size_tier": "Enterprise",
        "growth_stage": "Series C+",
        "target_customer": "enterprise security teams",
        "buying_signals": ["compliance mandate", "SOC2 certification push"],
    },
    {
        "classification": "B2B SaaS",
        "company_size_tier": "SMB",
        "growth_stage": "Seed",
        "target_customer": "early-stage founders",
        "buying_signals": ["bootstrapped growth", "hiring first sales rep"],
    },
]

ICP_PROFILES = [
    {
        "name": "Security-focused SaaS",
        "target_industries": ["Cybersecurity", "FinTech", "HealthTech"],
        "company_size": "50-500",
        "target_roles": ["CISO", "CTO", "Head of Security"],
        "tech_signals": ["AWS", "Kubernetes", "SOC2"],
        "pain_points": ["compliance", "data security", "audit fatigue"],
    },
    {
        "name": "High-growth DevTools",
        "target_industries": ["DevTools", "CloudInfrastructure", "SaaS"],
        "company_size": "10-200",
        "target_roles": ["CTO", "Co-Founder", "Head of Engineering"],
        "tech_signals": ["GitHub", "Vercel", "Supabase"],
        "pain_points": ["developer productivity", "infrastructure costs", "scaling"],
    },
    {
        "name": "Sales-led FinTech",
        "target_industries": ["FinTech", "InsurTech", "SaaS"],
        "company_size": "100-1000",
        "target_roles": ["VP of Sales", "CRO", "Head of Revenue"],
        "tech_signals": ["Salesforce", "Stripe", "HubSpot"],
        "pain_points": ["lead quality", "pipeline velocity", "CAC reduction"],
    },
]

VERDICTS = {
    (True, True): ("Strong Match", "High", 8, 10),
    (True, False): ("Weak Match", "Medium", 5, 7),
    (False, True): ("Weak Match", "Medium", 4, 6),
    (False, False): ("No Match", "Low", 1, 3),
}


def save_jsonl(path: str, records: list[dict]) -> None:
    with open(path, "w") as f:
        for r in records:
            f.write(json.dumps(r) + "\n")
    print(f"  Saved {len(records)} examples → {path}")


# ── Use case 1: Cold Email Writer ─────────────────────────────────────────────

def generate_email_examples(n: int) -> list[dict]:
    print(f"\n[1/4] Generating {n} cold email examples...")
    records = []
    for _ in range(n):
        name = random.choice(FIRST_NAMES)
        title, focus1, focus2 = random.choice(TITLES)
        company, industry, size, _, specialty = random.choice(COMPANIES)
        pain1, pain2 = random.sample(PAIN_POINTS, 2)
        hook_verb, hook_context = random.choice(EMAIL_HOOKS)
        cta = random.choice(EMAIL_CTAS)

        subject_styles = [
            f"Quick question about {company}'s {focus2}",
            f"{company}'s outbound — quick thought",
            f"Idea for {company}'s {focus1} team",
            f"How {company} could 3x reply rates",
            f"Re: {company}'s prospecting stack",
        ]
        subject = random.choice(subject_styles)

        body = (
            f"Hi {name},\n\n"
            f"I {hook_verb} {hook_context} — congrats. "
            f"I work with {industry} teams like yours on {pain1}.\n\n"
            f"Most {title}s we talk to are dealing with {pain2}, "
            f"and end up solving it with Sonar — an AI platform that finds the right prospects, "
            f"enriches their data automatically, and runs personalised sequences without extra headcount.\n\n"
            f"{cta}\n\nBest,\nAlex"
        )

        input_text = json.dumps({
            "first_name": name,
            "title": title,
            "company": company,
            "industry": industry,
            "company_size": size,
            "pain_points": [pain1, pain2],
        })
        output = f"SUBJECT: {subject}\nBODY:\n{body}"
        records.append({"text_input": input_text, "output": output})

    return records


# ── Use case 2: Lead Scorer ────────────────────────────────────────────────────

def generate_lead_scoring_examples(n: int) -> list[dict]:
    print(f"\n[2/4] Generating {n} lead scoring examples...")
    records = []

    icp = {
        "target_industries": ["SaaS", "Cybersecurity", "FinTech", "DevTools", "CloudInfrastructure"],
        "target_titles": ["CTO", "CEO", "VP of Sales", "Head of Growth", "CISO", "Co-Founder"],
        "ideal_company_size": "11-500",
        "must_have": ["decision-maker or strong influencer", "growth-stage company"],
        "disqualifiers": ["enterprise 5000+", "non-tech industry"],
    }

    for _ in range(n):
        title, _, _ = random.choice(TITLES)
        company, industry, size, _, _ = random.choice(COMPANIES)
        has_email = random.choice([True, True, False])
        engagement = random.choice(["none", "none", "opened", "clicked", "replied"])

        industry_match = industry in icp["target_industries"]
        title_match = any(t in title for t in ["CTO", "CEO", "VP", "Head", "CISO", "Founder", "CRO", "CPO", "COO"])
        size_match = size not in ["1001-5000", "5000+"]

        if industry_match and title_match and size_match:
            score = random.randint(7, 10)
            tier = "Hot"
            reason = random.choice(SCORE_REASONS["high"])
        elif (industry_match or title_match) and size_match:
            score = random.randint(4, 6)
            tier = "Warm"
            reason = random.choice(SCORE_REASONS["mid"])
        else:
            score = random.randint(1, 3)
            tier = "Cold"
            reason = random.choice(SCORE_REASONS["low"])

        if engagement == "replied":
            score = min(10, score + 2)
        elif engagement == "clicked":
            score = min(10, score + 1)

        input_text = json.dumps({
            "title": title,
            "company": company,
            "industry": industry,
            "company_size": size,
            "has_verified_email": has_email,
            "email_engagement": engagement,
            "icp": icp,
        })
        output = f"SCORE: {score}\nTIER: {tier}\nREASON: {reason}"
        records.append({"text_input": input_text, "output": output})

    return records


# ── Use case 3: Company Enrichment Extractor ──────────────────────────────────

def generate_enrichment_examples(n: int) -> list[dict]:
    print(f"\n[3/4] Generating {n} enrichment examples...")
    records = []

    specialties_pool = [
        "enterprise software", "API-first architecture", "developer tools",
        "compliance automation", "workflow automation", "data enrichment",
        "real-time analytics", "identity management", "payment processing",
        "HR automation", "security monitoring", "cloud storage",
        "machine learning infrastructure", "observability", "no-code tooling",
    ]

    for _ in range(n):
        company, industry, size, is_saas, specialty = random.choice(COMPANIES)
        tech = random.choice(TECH_STACKS)
        specs = random.sample(specialties_pool, 3)
        enrich_base = random.choice(ENRICH_OUTPUTS)

        raw_desc = (
            f"{company} is a {industry} company with {size} employees. "
            f"They specialize in {', '.join(specs)}. "
            f"Their tech stack includes {', '.join(tech)}. "
            f"They help businesses {random.choice(['scale faster', 'reduce costs', 'automate workflows', 'improve security posture', 'make better data decisions'])}."
        )

        output_obj = {
            "industry": industry,
            "classification": enrich_base["classification"],
            "company_size_tier": enrich_base["company_size_tier"],
            "is_saas": is_saas,
            "tech_stack": tech[:3],
            "specialties": specs,
            "target_customer": enrich_base["target_customer"],
            "growth_stage": enrich_base["growth_stage"],
            "buying_signals": enrich_base["buying_signals"],
        }

        records.append({"text_input": raw_desc, "output": json.dumps(output_obj)})

    return records


# ── Use case 4: ICP Matcher ────────────────────────────────────────────────────

def generate_icp_matching_examples(n: int) -> list[dict]:
    print(f"\n[4/4] Generating {n} ICP matching examples...")
    records = []

    for _ in range(n):
        company, industry, size, is_saas, _ = random.choice(COMPANIES)
        tech = random.choice(TECH_STACKS)
        icp = random.choice(ICP_PROFILES)

        industry_match = industry in icp["target_industries"]
        tech_match = any(t in tech for t in icp["tech_signals"])

        verdict, priority, score_min, score_max = VERDICTS[(industry_match, tech_match)]
        score = random.randint(score_min, score_max)

        matching = []
        gaps = []

        if industry_match:
            matching.append(f"industry ({industry} is in target list)")
        else:
            gaps.append(f"industry ({industry} not in target list)")

        if tech_match:
            overlap = [t for t in tech if t in icp["tech_signals"]]
            matching.append(f"tech stack overlap ({', '.join(overlap)})")
        else:
            gaps.append("no tech stack overlap with ICP signals")

        size_num = int(size.split("-")[0].replace("+", "").replace(",", ""))
        icp_min = int(icp["company_size"].split("-")[0])
        icp_max = int(icp["company_size"].split("-")[1]) if "-" in icp["company_size"] else 9999
        if icp_min <= size_num <= icp_max:
            matching.append(f"company size ({size} within {icp['company_size']})")
        else:
            gaps.append(f"company size ({size} outside {icp['company_size']})")

        reasoning = (
            f"{company} {'matches' if verdict == 'Strong Match' else 'partially matches' if 'Weak' in verdict else 'does not match'} "
            f"the '{icp['name']}' ICP. "
            f"{'Key signals align well with the target profile.' if score >= 7 else 'Some criteria match but gaps reduce fit confidence.' if score >= 4 else 'Significant criteria gaps make this a low-priority account.'}"
        )

        input_text = json.dumps({
            "company": {"name": company, "industry": industry, "size": size, "tech_stack": tech, "is_saas": is_saas},
            "icp": icp,
        })
        output = (
            f"MATCH_SCORE: {score}\n"
            f"VERDICT: {verdict}\n"
            f"MATCHING_CRITERIA: {', '.join(matching) or 'none'}\n"
            f"GAPS: {', '.join(gaps) or 'none'}\n"
            f"OUTREACH_PRIORITY: {priority}\n"
            f"REASONING: {reasoning}"
        )
        records.append({"text_input": input_text, "output": output})

    return records


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))

    save_jsonl(os.path.join(out_dir, "finetune_email_writer.jsonl"),  generate_email_examples(60))
    save_jsonl(os.path.join(out_dir, "finetune_lead_scorer.jsonl"),   generate_lead_scoring_examples(60))
    save_jsonl(os.path.join(out_dir, "finetune_enrichment.jsonl"),    generate_enrichment_examples(60))
    save_jsonl(os.path.join(out_dir, "finetune_icp_matcher.jsonl"),   generate_icp_matching_examples(60))

    print(f"""
Done! 240 training examples across 4 files in {out_dir}/

Next steps:
1. Go to https://aistudio.google.com → "Tune a model"
2. Upload each JSONL, train separately (Gemini 1.5 Flash, free)
3. Copy tuned model IDs after training
4. Add to Vercel env vars:
     TUNED_MODEL_EMAIL_WRITER=tunedModels/...
     TUNED_MODEL_LEAD_SCORER=tunedModels/...
     TUNED_MODEL_ENRICHMENT=tunedModels/...
     TUNED_MODEL_ICP_MATCHER=tunedModels/...
""")
