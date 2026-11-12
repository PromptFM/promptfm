# Contributing to PromptFM

Welcome to the **PromptFM** development community! We are excited to collaborate with engineers, designers, and community members building the future of 24/7 AI-generated radio.

Before contributing, please read this guide and our [`LICENSE`](./LICENSE) to understand our governance, intellectual property boundaries, and quality requirements.

---

## 📜 1. License & Intellectual Property

PromptFM is governed by the **PromptFM Community Source-Available License (Version 1.0)**:
- **You are welcome to:** Fork the repository, explore the codebase, test locally, submit bug fixes, propose new radio features, and contribute pull requests to the official project.
- **Strictly Prohibited:** You may **not** copy, extract, resell, or reuse this codebase or its AI DJ personas to launch a competing or commercial radio/streaming service.
- **Contribution Grant:** By submitting a Pull Request, you grant PromptFM full rights to integrate, deploy, and maintain your contributions within PromptFM.

---

## 🏛️ 2. Organization & Governance

1. **GitHub Organization:** PromptFM development is managed through our GitHub organization ([`PromptFM`](https://github.com/PromptFM)).
2. **Review Board & CODEOWNERS:** Every pull request requires an explicit review and approval from a member of the Board (**@atrifan** chairs the board, or **@PromptFM/core** per [`.github/CODEOWNERS`](.github/CODEOWNERS)).
3. **Mandatory GitHub Issue:** Every PR must address or resolve an open GitHub Issue (`Fixes #<number>`). PRs without an issue will be closed.
4. **Direct Push & Force Push Prohibition:** Direct pushes and force pushes to `main` are strictly rejected by GitHub Repository Rulesets for all users. All code modifications must arrive through Pull Requests. Core Team members (`@PromptFM/core`) can merge approved PRs without external signoff, while community contributions require at least 1 approval from `@PromptFM/core`.

---

## 🚀 3. Quickstart: Local Development Setup

PromptFM is designed with **zero production dependencies** and built-in developer simulation fallbacks. You can run the entire radio station locally without paid API accounts, and your local development will never touch or affect production.

### Prerequisites
- **Node.js**: `20.x` or higher
- **npm**: `10.x` or higher
- **Git**
- *(Optional for full cloud stack simulation)*: **Docker & Docker Compose**

### Installation
```bash
# 1. Fork the repository on GitHub, then clone your fork:
git clone https://github.com/<your-username>/promptfm.git
cd promptfm

# 2. Install dependencies:
npm install
```

For zero-config local development, you do **not** need to create `.env.local` first. `npm run dev` bootstraps the safe local defaults it needs automatically.

### Choose Your Development Mode:

#### Option A: 100% Zero-Docker Pure UI Development (Fastest)
If you are working on the Next.js frontend, React components, Tailwind styling, or player controls:
```bash
npm run dev

# Optional: inspect exactly which local defaults and localhost services were resolved
npm run dev:config
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser. The live audio player, schedule, and song submission portals will be fully operational in dev simulation mode using local mock state and safe fallbacks.

#### Option B: Full Local Cloud Simulator (Simulating GCP & Supabase with Docker)
If you are testing audio crossfading, Icecast stream mounting, pgvector RAG queries, or S3 uploads locally:
```bash
# Starts Icecast (port 8000), Liquidsoap (port 1234), PostgreSQL+pgvector (port 54322),
# MinIO (port 9000), then launches Next.js with the local wrapper:
npm run local:dev
```
* **Local Icecast Audio Stream**: `http://localhost:8000/stream.mp3`
* **Local Icecast Admin**: `http://localhost:8000/admin/` (User: `admin`, Pass: `admin_local`)
* **Local PostgreSQL / pgvector**: `postgres://postgres:postgres@localhost:54322/postgres` (auto-seeded with test channels and tracks)
* **Local MinIO R2 Console**: `http://localhost:9001` (User: `minioadmin`, Pass: `minioadmin`)

To stop local containers:
```bash
npm run local:down
```

If you need real cloud credentials instead of the safe local defaults, copy `.env.local.example` to `.env.local` and fill in your own values explicitly.

> [!NOTE]
> `.env.example` and the localhost / MinIO values are only for local developer simulation. Maintainers running `npm run media:*` against live PromptFM data should use ambient `gcloud` auth or ignored local env files and follow the **Public Track Media Cutover (Supabase Storage -> Cloudflare R2)** runbook in [`docs/admin-guide.md`](docs/admin-guide.md).

---

## 🧪 4. Mandatory Quality Mandates & CI Pipeline

Every pull request is automatically verified by our GitHub Actions CI pipeline (`.github/workflows/ci.yml`). You must verify these checks locally before opening a PR:

### 1. Test-Driven Development (TDD)
- **Red $\to$ Green $\to$ Refactor**: Write a failing test in `tests/unit/` or `tests/integration/` before writing implementation code.
- Run tests:
  ```bash
  npm test
  ```

### 2. Code Coverage ($\ge$ 80%)
- All test suites must maintain at least 80% line, branch, and function coverage:
  ```bash
  npm run test:coverage
  ```

### 3. Mutation Testing ($\ge$ 80% Break / $\ge$ 85% Target)
- We use **Stryker Mutator** to verify test suite strength:
  ```bash
  npm run test:mutate
  ```
  *PRs with surviving mutants on core business logic will fail CI.*

### 4. Linting & Typecheck
- Must have 0 ESLint errors and 0 TypeScript errors:
  ```bash
  npm run lint
  npm run typecheck
  ```

---

## 🛡️ 5. Security & Secret Sharing Policy

### ⚠️ Never Commit Secrets to GitHub
Our CI runs **Gitleaks** and **CodeQL** on every PR commit. If an API key, private token, or secret is detected, your PR will fail and your commit may be rejected.

### Introducing New Environment Variables or Secrets:
If your feature requires new API keys or environment variables in Vercel:
1. Note the required variables in your PR description using the [PR Template](./.github/PULL_REQUEST_TEMPLATE.md).
2. **Do NOT** post the secrets in GitHub comments or issues.
3. Encrypt the secret using an ephemeral link service:
   - **[Password Pusher](https://pwpush.com)** (set to 1 view / 24 hours) or
   - **[OneTimeSecret](https://onetimesecret.com)**
4. Send the secret link privately to **@atrifan**. The Board Admin will securely configure the secret in Vercel Production/Preview.

---

## ☁️ 6. Deployment & Infrastructure Workflow

### Production Release Deployments (Tag-Based)
- Merging a PR into `main` runs full CI validation and triggers testing pipelines. To protect our $0 infrastructure budget and prevent exhausting Vercel Fluid Active CPU, production deployments to **[promptfm.live](https://promptfm.live)** are triggered exclusively via versioned release tags (`promptfm/<version>` or `v*.*.*`).
- Documentation changes are published to GitHub Pages via `gh-pages/<version>` tags.

### Vercel Preview Deployments & $0 Infra Policy
- **Gated Previews:** To keep PromptFM within the $0/month free tier (Vercel Hobby 4-hour Fluid Active CPU limit), preview deployments are gated. Previews for forked pull requests require maintainer authorization before building.
- **Opt-in Previews:** If your pull request requires a live visual preview deployment for UI review, include `[preview]` in your commit message or PR title.
- **Automated Skip:** Documentation, markdown, infra, and Dependabot PRs automatically bypass preview deployments to conserve free-tier compute budget. Use `[skip preview]` to explicitly bypass preview builds.

### Infrastructure (Terraform & Ansible)
- Pull requests modifying `infra/terraform` or `infra/ansible` are validated by CI (`terraform fmt -check`, `terraform validate`).
- **Execution Policy:** All Terraform `apply` and Ansible playbook executions are **run manually by the Board Admin (@atrifan)** after merge. Contributors do not have direct cloud production credentials.

---

## 📋 7. Pull Request Lifecycle

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Write code with tests following TDD.
3. Verify local checks:
   ```bash
   npm run lint && npm run typecheck && npm test && npm run test:mutate
   ```
4. Push to your fork and submit a PR to [`PromptFM/promptfm`](https://github.com/PromptFM/promptfm) targeting the `main` branch.
5. Fill out all sections of the [Pull Request Template](./.github/PULL_REQUEST_TEMPLATE.md).
6. Request review from **@atrifan**. Once approved and CI is green, your code will be merged to `main` and shipped in the next tagged production release!
