## 📋 Pull Request Details

### 1. Associated GitHub Issue
> Every PR must link to an existing issue. PRs without an issue will be closed.
- Closes / Fixes: #<!-- enter issue number here, e.g. #42 -->

---

### 2. Change Category (Select all that apply)
- [ ] **UI / Frontend** (React, Tailwind, Next.js components, Audio Player)
- [ ] **Backend / API** (Server routes, Supabase migrations, RAG, DJ Engine)
- [ ] **Community / Bot** (Discord bot, Telegram bot, slash commands)
- [ ] **Infrastructure** (Terraform, Ansible, Cloudflare R2, GCP IAM)
- [ ] **Documentation / Testing** (Guides, Vitest suites, Stryker configs)

---

### 3. Environment Variables & Secrets Required
- [ ] **No new secrets or environment variables required.**
- [ ] **YES — This PR requires new environment variables or API keys in Vercel.**

> [!CAUTION]
> **NEVER PASTE SECRETS, API KEYS, OR TOKENS IN THIS PR OR IN GITHUB ISSUES.**
> If your changes introduce new secrets, you MUST generate an ephemeral encrypted link via [Password Pusher](https://pwpush.com) or [OneTimeSecret](https://onetimesecret.com) and share it directly with Board Admin (@atrifan) via private DM / email.
> 
> **Secret Checklist for Board Admin:**
> - Secret Name(s): `...`
> - Target Environment(s): `Production` / `Preview` / `Development`
> - Ephemeral Link delivered to @atrifan: [ ] Yes

---

### 4. Engineering Quality Checklist (TDD Mandatory)
- [ ] **TDD Followed:** Failing test written first (Red) $\to$ Minimal code to pass (Green) $\to$ Refactor.
- [ ] **Tests Pass:** `npm test` passes 100% with no skipped or failing suites.
- [ ] **Lint & Types Clean:** `npm run lint` and `npm run typecheck` report 0 errors.
- [ ] **Mutation Testing Target Met:** `npm run test:mutate` run locally with:
  - Mutation score $\ge$ 80% (Breaking threshold).
  - Mutants killed $\ge$ 85% on new core business logic.
- [ ] **Infra (if applicable):** `terraform fmt` checked; note that Terraform & Ansible are applied manually by Board Admin.

---

### 5. Review & Governance
- [ ] Assigned Core Team Reviewer: **@PromptFM/core** (or **@atrifan**)
- [ ] Confirmed no proprietary code reuse or license violation.

