# Contributing to PromptFM

Welcome to the **PromptFM** development community! We are excited to collaborate with engineers, designers, and community members building the future of 24/7 AI-generated radio.

Before contributing, please read this guide and our [`LICENSE`](./LICENSE) to understand our governance, intellectual property boundaries, and quality requirements.

---

## 📜 1. License & Intellectual Property

PromptFM is governed by the **PromptFM Community Source-Available License (Version 1.0)**:
- **You are welcome to:** Fork the repository, explore the codebase, test locally, submit bug fixes, propose new radio features, and contribute pull requests to the official project.
- **Strictly Prohibited:** You may **not** copy, extract, resell, or reuse this codebase or its AI DJ personas to launch a competing or commercial radio/streaming service.
- **Contribution Grant:** By submitting a Pull Request, you grant PromptFM and Alexander Trifan full rights to integrate, deploy, and maintain your contributions within PromptFM.

---

## 🏛️ 2. Organization & Governance

1. **GitHub Organization:** PromptFM development is managed through our GitHub organization (`promptfm`).
2. **Review Board:** Every pull request requires an explicit review and approval from a member of the Board (**@atrifan** chairs the board).
3. **Mandatory GitHub Issue:** Every PR must address or resolve an open GitHub Issue (`Fixes #<number>`). PRs without an issue will be closed.

---

## 🚀 3. Quickstart: Local Development Setup

PromptFM is designed with zero-cost developer fallbacks so you can run the entire radio station locally without paid API accounts.

### Prerequisites
- **Node.js**: `20.x` or higher
- **npm**: `10.x` or higher
- **Git**

### Installation
```bash
# 1. Fork the repository on GitHub, then clone your fork:
git clone https://github.com/<your-username>/promptfm.git
cd promptfm

# 2. Install dependencies:
npm install

# 3. Create your local environment file:
cp .env.example .env.local

# 4. Start the development server:
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser. The live audio player, schedule, and song submission portals will be fully operational in dev simulation mode.

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

### Continuous Deployment (Vercel)
- Merging a PR into `main` automatically triggers a production deployment to **[promptfm.live](https://promptfm.live)** via Vercel GitHub integration.

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
4. Push to your fork and submit a PR to `promptfm/main`.
5. Fill out all sections of the [Pull Request Template](./.github/PULL_REQUEST_TEMPLATE.md).
6. Request review from **@atrifan**. Once approved and CI is green, your code will be merged to `main` and deployed to production!
