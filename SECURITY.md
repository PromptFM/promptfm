# Security Policy

The PromptFM maintainers and community take security vulnerabilities seriously. We appreciate your efforts to responsibly disclose findings and will work with you to remediate vulnerabilities swiftly.

---

## Supported Versions

PromptFM follows continuous delivery for the hosted platform ([promptfm.live](https://promptfm.live)). We provide active security support and patches for the following versions:

| Version / Branch | Supported | Notes |
| :--- | :--- | :--- |
| `main` (Latest) | :white_check_mark: Yes | Supported mainline branch. Public `promptfm.live` is currently an Oracle-hosted maintenance page; OCI production web release/rollback workflows are implemented in repo, but live cutover evidence is not asserted here. |
| `v0.1.x` | :white_check_mark: Yes | Current release series |
| `< v0.1.0` | :x: No | Deprecated development prototypes |

---

## Reporting a Vulnerability

### 🔒 Preferred Method: GitHub Private Vulnerability Reporting
Please submit all security disclosures privately using GitHub's **Private Vulnerability Reporting**:
👉 **[Open a Private Security Advisory](https://github.com/PromptFM/promptfm/security/advisories/new)**

This feature allows you to collaborate directly with PromptFM maintainers in a secure, encrypted workspace before public disclosure.

### ✉️ Alternative Method: Encrypted Email
If you cannot use GitHub Security Advisories, send your findings to:
- **Email:** [security@promptfm.live](mailto:security@promptfm.live)
- **Primary Security Officer:** **@atrifan**

Please include:
1. Description of the vulnerability and its potential impact.
2. Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
3. Affected components (e.g., Next.js frontend, Icecast streaming pipeline, Supabase/pgvector queries, or cloud infrastructure).
4. Any proposed remediations or patches.

> [!WARNING]
> **Please do NOT report security vulnerabilities via public GitHub issues, pull requests, or discussions.**

---

## Response & SLA

Our maintainers commit to the following response timeline:

| Milestone | SLA Target | Description |
| :--- | :--- | :--- |
| **Initial Acknowledgment** | **< 24 hours** | A maintainer confirms receipt of the vulnerability report. |
| **Triage & Severity Assessment** | **< 48 hours** | Reproduction of the report, severity assignment (CVSS), and impact analysis. |
| **Fix & Patch Development** | **< 7 calendar days** | Development of patch in private branch with unit and mutation tests. |
| **Coordinated Disclosure** | **30 - 90 days** | Public disclosure published alongside deployment to production. |

---

## Safe Harbor & Responsible Disclosure

We consider security research conducted under this policy to be authorized and protected under Safe Harbor:
- We will not pursue legal action against researchers acting in good faith.
- We will not report your activities to law enforcement if you follow responsible disclosure principles.
- If an issue is resolved, we will gladly credit your contribution in our security advisories and release notes (unless you prefer anonymity).

### Guidelines for Safe Harbor:
- Make a good faith effort to avoid privacy violations, destruction of data, and service interruption.
- Do not access, modify, or exfiltrate listener or user data that does not belong to you.
- Give us reasonable time to remediate the vulnerability before sharing details publicly.
- Do not perform Denial of Service (DoS) attacks against our production streaming infrastructure or free-tier quotas.
