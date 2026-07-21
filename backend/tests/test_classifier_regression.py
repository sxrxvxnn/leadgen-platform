"""
Regression suite for the Sonar Classification Engine v2.

Run before every deploy:
    cd backend && python -m pytest tests/test_classifier_regression.py -v

Every case in this file must pass. If you change classify_website_saas,
you must not break any existing case — add a new case for the new behaviour.
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.website_analyzer import classify_website_saas


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _page(full_text="", pricing="", nav="", has_pricing=False, has_mobile=False,
           has_login=False, title="", meta=""):
    """Build a minimal website_data dict for test cases."""
    return {
        "full_text": full_text,
        "pricing": pricing,
        "nav": nav,
        "has_pricing_detected": has_pricing,
        "has_mobile_app": has_mobile,
        "has_login_detected": has_login,
        "title": title,
        "meta_description": meta,
        "header": "",
        "hero": "",
        "scan_text": "",
    }


def classify(description="", page=None, url="", snippets=""):
    return classify_website_saas(page, url, description, snippets)


# ---------------------------------------------------------------------------
# Regression cases
# Each tuple: (company_name, description, page, url, snippets,
#              expected_is_saas, expected_company_type, expected_business_model)
# ---------------------------------------------------------------------------

CASES = [

    # ── 1. SaaS companies ────────────────────────────────────────────────────

    (
        "Salesforce",
        "CRM software platform. Monthly subscription plan per user per month. "
        "Free trial available. Cancel anytime. Cloud-based management platform.",
        _page(
            nav="products pricing docs api integrations",
            has_pricing=True,
            title="Salesforce CRM Software | Subscription Plans",
        ),
        "https://salesforce.com",
        "",
        True, "Product", "SaaS",
    ),
    (
        "Atlassian",
        "Jira project management software. Pricing plan per seat per month. "
        "Annual plan available. Subscription billing. Free trial.",
        _page(
            nav="pricing products docs integrations",
            has_pricing=True,
            title="Atlassian | Project Management Software",
        ),
        "https://atlassian.com",
        "",
        True, "Product", "SaaS",
    ),
    (
        "Shopify",
        "E-commerce software platform. Start free trial. Monthly subscription. "
        "Per month pricing. Management platform for online stores.",
        _page(
            nav="pricing products docs api",
            has_pricing=True,
            title="Shopify | E-commerce Software Platform",
        ),
        "https://shopify.com",
        "",
        True, "Product", "SaaS",
    ),
    (
        "HubSpot",
        "CRM software and marketing platform. Free plan available. Subscription "
        "plans per user. Billing monthly or annual. Cloud-based SaaS.",
        _page(
            nav="pricing products integrations docs",
            has_pricing=True,
        ),
        "https://hubspot.com",
        "",
        True, "Product", "SaaS",
    ),
    (
        "Zoom",
        "Video conferencing software platform. Per user per month subscription. "
        "Free trial. Annual plan. Cloud-based management platform.",
        _page(
            nav="pricing plans products docs api",
            has_pricing=True,
            has_mobile=True,
        ),
        "https://zoom.us",
        "",
        True, "Product", "SaaS",
    ),

    # ── 2. Marketplace / Platform (Product but NOT SaaS) ─────────────────────

    (
        "Estateguru",
        "Peer-to-peer lending marketplace connecting borrowers and investors "
        "in real estate. Investors earn returns. Borrowers access capital.",
        _page(
            nav="invest borrow marketplace",
            title="Estateguru | P2P Real Estate Lending",
        ),
        "https://estateguru.co",
        "",
        False, "Product", "FinTech Platform",
    ),
    (
        "Airbnb",
        "Marketplace connecting hosts and guests. Commission-based revenue. "
        "Buyers and sellers of short-term accommodation. Transaction fee.",
        _page(
            nav="marketplace hosting",
            title="Airbnb | Home Rentals & Marketplace",
        ),
        "https://airbnb.com",
        "",
        False, "Product", "Marketplace",
    ),
    (
        "Etsy",
        "Marketplace for buyers and sellers of handmade goods. Listing fee "
        "per item. Transaction fee on sales. Commission-based platform.",
        _page(
            nav="marketplace sellers buyers",
            title="Etsy | Marketplace for Handmade Goods",
        ),
        "https://etsy.com",
        "",
        False, "Product", "Marketplace",
    ),
    (
        "Scramble",
        "Peer-to-peer lending crowdfunding platform. Investors and borrowers. "
        "Revenue-based returns. Community lending with transaction fees.",
        _page(title="Scramble | P2P Lending Platform"),
        "https://scramble.io",
        "",
        False, "Product", "FinTech Platform",
    ),

    # ── 3. FinTech capital providers (NOT SaaS, not pure marketplace) ─────────

    (
        "beatBread",
        "beatBread provides music royalty advance and revenue advance to "
        "artists. Advance against future royalties. Equity-free funding.",
        _page(title="beatBread | Music Revenue Advance"),
        "https://beatbread.com",
        "",
        False, "Product", "FinTech Platform",
    ),
    (
        "Clearco",
        "Clearco provides equity-free funding and working capital for "
        "e-commerce businesses. We provide capital to grow your business.",
        _page(title="Clearco | Equity-Free Funding"),
        "https://clearco.com",
        "",
        False, "Product", "FinTech Platform",
    ),
    (
        "Kavod Lending",
        "Community lending platform providing business loans to underserved "
        "communities. We lend to small businesses. Peer lending network.",
        _page(title="Kavod | Community Lending"),
        "https://kavodlending.com",
        "",
        False, "Product", "FinTech Platform",
    ),
    (
        "Capital On Tap",
        "Business credit cards and line of credit for small businesses. "
        "Credit facility up to £250,000. Business loans and credit lines.",
        _page(title="Capital On Tap | Business Credit"),
        "https://capitalontap.com",
        "",
        False, "Product", "FinTech Platform",
    ),

    # ── 4. Service / Consulting ───────────────────────────────────────────────

    (
        "Accenture",
        "Global consulting firm providing implementation services, outsourcing "
        "and managed services. We build solutions for our clients.",
        _page(
            nav="services clients expertise what we do",
            title="Accenture | Consulting & Technology Services",
        ),
        "https://accenture.com",
        "",
        False, "Service", "Consulting",
    ),
    (
        "Deloitte",
        "Professional services and consulting firm. Advisory, outsourcing, "
        "implementation services. Consulting fee based engagements.",
        _page(
            nav="services our work clients expertise",
            title="Deloitte | Audit, Consulting, Tax",
        ),
        "https://deloitte.com",
        "",
        False, "Service", "Consulting",
    ),
    (
        "William Penn Foundation",
        "Philanthropic foundation making grants to nonprofits in the "
        "Delaware Valley. Grant-making organization. Charitable foundation.",
        _page(title="William Penn Foundation | Philanthropic Grants"),
        "https://williampennfoundation.org",
        "",
        False, "Service", "Other",
    ),
    (
        "Digital Agency Co",
        "Digital agency providing creative agency services. We are a marketing "
        "agency. Request a quote. Custom development for your clients.",
        _page(
            nav="services our work clients what we do",
            title="Digital Agency | Creative & Marketing",
        ),
        "",
        "",
        False, "Service", "Agency",
    ),

    # ── 5. SaaS must not fire on login/dashboard alone ────────────────────────

    (
        "Generic Client Portal",
        "Client portal for managing your account. Log in to your dashboard. "
        "Sign in to track your application status.",
        _page(
            has_login=True,
            full_text="log in sign in dashboard client portal manage your account",
            title="Client Portal | Log In",
        ),
        "",
        "",
        False, "Service", "Consulting",
    ),
    (
        "Loan Application Portal",
        "Apply for a business loan. Sign up to start your application. "
        "Dashboard to track your loan progress. Get started today.",
        _page(
            has_login=True,
            full_text="apply for a loan sign up dashboard track application business loan",
            title="Business Loans | Apply Now",
        ),
        "",
        "",
        False, "Product", "FinTech Platform",
    ),

    # ── 6. Edge cases from v3 spec ────────────────────────────────────────────

    (
        "Uber",
        "Marketplace connecting drivers and riders. Commission-based platform. "
        "Buyers and sellers of transportation. Transaction fee per ride.",
        _page(
            nav="marketplace drivers",
            title="Uber | Rides & Marketplace",
            has_mobile=True,
        ),
        "https://uber.com",
        "",
        False, "Product", "Marketplace",
    ),
    (
        "Stripe",
        "Payment processing software platform. Subscription plan for platform "
        "access. Per transaction fee. API platform for developers. "
        "Billing, subscriptions, and recurring revenue management.",
        _page(
            nav="pricing products docs api",
            has_pricing=True,
            title="Stripe | Payment Processing Platform",
        ),
        "https://stripe.com",
        "",
        # Stripe is an API Platform (spec lists this separately from SaaS)
        # is_saas=True because they have subscription plans + per-seat billing
        True, "Product", "API Platform",
    ),

]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "name,description,page,url,snippets,exp_saas,exp_type,exp_model",
    CASES,
    ids=[c[0] for c in CASES],
)
def test_classifier(name, description, page, url, snippets,
                    exp_saas, exp_type, exp_model):
    result = classify_website_saas(page, url, description, snippets)

    assert result["is_saas"] == exp_saas, (
        f"[{name}] is_saas: expected {exp_saas}, got {result['is_saas']}. "
        f"Scores: {result['scores']}. Reason: {result['classification_reason']}"
    )
    assert result["company_type"] == exp_type, (
        f"[{name}] company_type: expected {exp_type}, got {result['company_type']}. "
        f"Scores: {result['scores']}. Reason: {result['classification_reason']}"
    )
    assert result["business_model"] == exp_model, (
        f"[{name}] business_model: expected {exp_model}, got {result['business_model']}. "
        f"Scores: {result['scores']}. Reason: {result['classification_reason']}"
    )


def test_no_evidence_returns_unknown():
    result = classify_website_saas(None, "", "", "")
    assert result["confidence"] == 0
    assert result["is_saas"] is False


def test_saas_requires_subscription_not_just_login():
    """A login page alone must never produce is_saas=True."""
    page = _page(has_login=True, full_text="log in sign in dashboard")
    result = classify_website_saas(page, "", "")
    assert result["is_saas"] is False, (
        "Login/dashboard alone should never produce is_saas=True. "
        f"Scores: {result['scores']}"
    )


def test_marketplace_not_saas_even_with_signup():
    """P2P platform with sign-up must not be classified as SaaS."""
    page = _page(
        full_text=(
            "peer-to-peer lending marketplace. sign up to invest. "
            "borrowers get business loans. lenders earn returns. "
            "transaction fee on funded loans."
        ),
        has_login=True,
    )
    result = classify_website_saas(page, "", "peer-to-peer lending platform for borrowers and investors")
    assert result["is_saas"] is False, (
        f"Marketplace should not be SaaS. Scores: {result['scores']}"
    )
    assert result["business_model"] == "FinTech Platform", (
        f"Expected FinTech Platform, got {result['business_model']}"
    )


def test_pricing_page_boosts_subscription_score():
    """A company with a pricing page should score higher subscription confidence."""
    without_pricing = classify_website_saas(
        _page(full_text="software platform for teams workflow automation integrations"),
        "", ""
    )
    with_pricing = classify_website_saas(
        _page(
            full_text="software platform for teams workflow automation integrations",
            has_pricing=True,
            nav="pricing products docs",
        ),
        "", ""
    )
    assert with_pricing["scores"]["subscription"] > without_pricing["scores"]["subscription"], (
        "Pricing page should increase subscription score"
    )


def test_confidence_bands():
    """Confidence should be higher with more evidence sources."""
    sparse = classify_website_saas(None, "", "SaaS platform subscription")
    rich = classify_website_saas(
        _page(
            full_text="SaaS management platform. Subscription plan per user per month. "
                      "Free trial. Cancel anytime. Pricing tiers.",
            has_pricing=True,
            nav="pricing products docs api",
            title="Acme | SaaS Platform",
        ),
        "https://acme.com",
        "SaaS management platform subscription per user per month free trial",
    )
    assert rich["confidence"] > sparse["confidence"], (
        f"Rich evidence should give higher confidence: rich={rich['confidence']}, sparse={sparse['confidence']}"
    )
