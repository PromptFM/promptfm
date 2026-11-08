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
