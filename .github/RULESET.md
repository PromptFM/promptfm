# PromptFM GitHub Repository Ruleset Specification

This document defines the live branch protection rules and declarative Infrastructure-as-Code (IaC) governance applied to the **`PromptFM/promptfm`** repository.

---

## 🎯 1. Overview & Live Status

- **Ruleset Name:** `Main Branch Production Gate`
- **Ruleset ID:** `26815412`
- **Target Branch:** `refs/heads/main` (`~DEFAULT_BRANCH`)
- **Status:** **ACTIVE & ENFORCED** (Live on GitHub)
- **IaC Definition:** [`infra/terraform/github.tf`](../infra/terraform/github.tf) (`github_repository_ruleset.main_branch_gate`)

---

## 🛡️ 2. Enforced Rules

| Rule | Parameter | Behavior / Enforcement |
| :--- | :--- | :--- |
| **Direct Push Prohibition** | `creation: false`, `update: false` | Direct `git push origin main` is **strictly blocked** for all users. All code modifications must arrive via Pull Request. |
| **Force Push Prohibition** | `non_fast_forward: true` | `git push --force` or non-fast-forward ref updates to `main` are permanently rejected. |
| **Branch Deletion** | `deletion: true` | Deletion of the `main` branch is prohibited. |
| **Linear History** | `required_linear_history: true` | Enforces clean, bisectable history (merge commits, squash merges, or rebase merges). |
| **Pull Request Review** | `required_approving_review_count: 1` | Requires at least 1 approving pull request review prior to merge. |
| **CODEOWNERS Approval** | `require_code_owner_review: true` | Requires approval from registered code owners in [`.github/CODEOWNERS`](./CODEOWNERS) (`@PromptFM/core`, `@atrifan`). |
| **Stale Review Dismissal** | `dismiss_stale_reviews_on_push: true` | Pushing new commits to an open PR automatically invalidates prior approvals. |
| **Conversation Resolution** | `required_review_thread_resolution: true` | All review comment threads must be marked resolved before merging. |
| **Status Checks** | `strict_required_status_checks_policy: true` | Branch must be up-to-date with `main` and pass 6 mandatory CI quality checks. |

---

## 🚦 3. Required CI Status Checks

Every Pull Request must pass the following 6 quality and security gates:
1. `lint-and-typecheck`: TypeScript (`tsc --noEmit`), Next.js ESLint, and SQL schema validation.
2. `unit-and-integration-tests`: Vitest test suite (1,618+ tests).
3. `mutation-testing`: Stryker Mutator (> 50% mutation score threshold).
4. `terraform-lint-validate`: Terraform format and syntax validation.
5. `secret-leak-detection`: Gitleaks and SecretShare security scan.
6. `codeql-security-scan`: GitHub CodeQL static analysis.

---

## 👥 4. Bypass Matrix: Core Team vs Contributors

| Role / Actor | Actor ID | Actor Type | Bypass Mode | Permissions & Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Core Team (`@PromptFM/core`)** | `20507550` | `Team` | `pull_request` | **Can merge own PR without external approval.** Cannot push directly to `main` outside PR. |
| **Repository Admins** | `5` | `RepositoryRole` | `pull_request` | **Can merge own PR without external approval.** Cannot push directly to `main` outside PR. |
| **External Contributors** | N/A | N/A | None | **Must have at least 1 approval from `@PromptFM/core` (CODEOWNERS)** before merging. Cannot merge independently. |

---

## 🛠️ 5. Managing Rulesets via Terraform IaC

The ruleset is managed declaratively in [`infra/terraform/github.tf`](../infra/terraform/github.tf):

```hcl
resource "github_repository_ruleset" "main_branch_gate" {
  name        = "Main Branch Production Gate"
  repository  = var.github_repository
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["~DEFAULT_BRANCH"]
      exclude = []
    }
  }

  bypass_actors {
    actor_id    = 20507550 # @PromptFM/core team
    actor_type  = "Team"
    bypass_mode = "pull_request"
  }

  bypass_actors {
    actor_id    = 5 # Repository Admin Role
    actor_type  = "RepositoryRole"
    bypass_mode = "pull_request"
  }

  rules {
    deletion         = true
    non_fast_forward = true

    pull_request {
      required_approving_review_count   = 1
      dismiss_stale_reviews_on_push     = true
      require_code_owner_review         = true
      require_last_push_approval        = false
      required_review_thread_resolution = true
    }

    required_status_checks {
      strict_required_status_checks_policy = true

      required_check { context = "lint-and-typecheck" }
      required_check { context = "unit-and-integration-tests" }
      required_check { context = "mutation-testing" }
      required_check { context = "terraform-lint-validate" }
      required_check { context = "secret-leak-detection" }
      required_check { context = "codeql-security-scan" }
    }

    required_linear_history = true
  }
}
```

To verify or synchronize changes to the ruleset:
```bash
npm run promptfm -- tag infra --version 0.1.1
# or locally:
cd infra/terraform && terraform plan
```

---

## 📍 6. Where and How to Change Branch Rules

| What to Change | File / Location | How to Apply |
| :--- | :--- | :--- |
| **Ruleset Configuration** (approvals, status checks, linear history) | [`infra/terraform/github.tf`](../infra/terraform/github.tf) (`github_repository_ruleset.main_branch_gate`) | Open PR ➔ Merge ➔ Run `apply-terraform.yml` (or `npm run promptfm -- tag infra`). |
| **Emergency Ruleset Override** (disable gate during severe incident) | GitHub Web UI: **Settings ➔ Rules ➔ Rulesets ➔ [Main Branch Production Gate](https://github.com/PromptFM/promptfm/rules/26815412)** | Set enforcement to `Disabled` or `Evaluate` directly from browser (requires Repo Admin). |
| **Required Reviewers & Domain Ownership** | [`.github/CODEOWNERS`](./CODEOWNERS) | Edit `@PromptFM/core` and `@atrifan` path mappings via PR. |
| **Issue Labels & Taxonomy** | [`infra/terraform/github.tf`](../infra/terraform/github.tf) (`local.github_labels`) | Managed via Terraform IaC. |

---

## 🎯 7. Milestones & UI Drift Protection

In [`infra/terraform/github.tf`](../infra/terraform/github.tf), milestones declare:

```hcl
lifecycle {
  ignore_changes = [state]
}
```

**Why this matters:**
When you close a milestone from the GitHub Web UI or mobile app upon shipping a release, Terraform **ignores the `state` attribute**. Subsequent `terraform apply` runs will **never** reopen closed milestones or fight your UI workflow.

---

## 📖 8. Step-by-Step Developer & Admin Examples

### Example 1: Adding a New Issue Label
To add a new label to the repository, add a new key to `local.github_labels` in [`infra/terraform/github.tf`](../infra/terraform/github.tf):

```hcl
locals {
  github_labels = {
    # Existing labels...
    "performance" = {
      color       = "ff9900"
      description = "Speed insights, latency profiling, and bundle optimization"
    }
  }
}
```
Optionally also reflect it in [`config/github-project.json`](../config/github-project.json) for documentation.

---

### Example 2: Adding a New Milestone
To declare a new release milestone in [`infra/terraform/github.tf`](../infra/terraform/github.tf), define a `github_repository_milestone` block and ensure `ignore_changes = [state]` is set:

```hcl
resource "github_repository_milestone" "v1_1_0" {
  owner       = var.github_owner
  repository  = var.github_repository
  title       = "v1.1.0 - Next-Gen DJ Voice Synthesis"
  description = "Custom voice cloning, automated multi-lingual commentary, and RAG contextual banter."
  state       = "open"

  lifecycle {
    ignore_changes = [state]
  }
}
```

---

### Example 3: Adding a New Project View
To add or modify views in the PromptFM Community Project Board ([https://github.com/orgs/PromptFM/projects/1](https://github.com/orgs/PromptFM/projects/1)), update [`config/github-project.json`](../config/github-project.json):

```json
{
  "id": "security-audit",
  "name": "🛡️ Security & Access Audits",
  "layout": "BOARD_LAYOUT"
}
```
Supported layout types:
- `BOARD_LAYOUT`: Kanban column view (Todo, In Progress, Done).
- `TABLE_LAYOUT`: Dense spreadsheet/backlog view with sorting and filters.
- `ROADMAP_LAYOUT`: Timeline view mapped to milestone deadlines.

---

### Example 4: Modifying Production Gate Branch Rules
To change branch protection settings (e.g. increase required approvals or add new CI checks), edit `resource "github_repository_ruleset" "main_branch_gate"` in [`infra/terraform/github.tf`](../infra/terraform/github.tf):

#### A. Increasing Required Approvals from 1 to 2:
```hcl
pull_request {
  required_approving_review_count = 2 # Changed from 1
  require_code_owner_review       = true
  dismiss_stale_reviews_on_push   = true
}
```

#### B. Adding a New Required CI Status Check:
```hcl
required_status_checks {
  strict_required_status_checks_policy = true

  # Add new check context alongside existing checks:
  required_check {
    context = "playwright-e2e-tests"
  }
}
```

#### C. Adding a New Bypass Team (e.g., Security Leads):
```hcl
bypass_actors {
  actor_id    = 20507551 # Team ID from: gh api orgs/PromptFM/teams/<slug>
  actor_type  = "Team"
  bypass_mode = "pull_request"
}
```

---

### Example 5: Assigning Domain Ownership in CODEOWNERS
To require review from specific sub-teams or individuals for particular paths, edit [`.github/CODEOWNERS`](./CODEOWNERS):

```text
# Default global maintainers
* @PromptFM/core @atrifan

# Audio & DJ engineering require @PromptFM/core
src/lib/dj/ @PromptFM/core @atrifan
src/lib/audio/ @PromptFM/core @atrifan

# Cloud infrastructure & deployment require board review
infra/ @PromptFM/core @atrifan
.github/ @PromptFM/core @atrifan
```



