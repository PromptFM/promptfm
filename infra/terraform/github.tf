# infra/terraform/github.tf
# Declarative Infrastructure as Code for PromptFM GitHub Milestones, Labels, and Repository Settings.

provider "github" {
  owner = var.github_owner
  token = var.github_token != "" ? var.github_token : null
}

# ── Release Milestones ────────────────────────────────────────────────────────

resource "github_repository_milestone" "v0_2_0" {
  owner       = var.github_owner
  repository  = var.github_repository
  title       = "v0.2.0 - Zero-Cost Infrastructure & Stream Server"
  description = "GCP Always-Free VM, Icecast 2 streaming, Hostinger DNS, Terraform IaC, Vercel preview budget gating, and release automation."
  state       = "open"
}

resource "github_repository_milestone" "v0_3_0" {
  owner       = var.github_owner
  repository  = var.github_repository
  title       = "v0.3.0 - Autonomous Playback & Station Clock Wheel"
  description = "Continuous rotation engine, anti-repeat logic, DJ commentary transitions, station ID drops, and queue ETA synchronization."
  state       = "open"
}

resource "github_repository_milestone" "v0_4_0" {
  owner       = var.github_owner
  repository  = var.github_repository
  title       = "v0.4.0 - Mobile Player Ergonomics & Multi-Channel UX"
  description = "Sub-375px viewport layout, mobile slide-up controls drawer, public song list, playback progress, and light/dark theme switching."
  state       = "open"
}

resource "github_repository_milestone" "v0_5_0" {
  owner       = var.github_owner
  repository  = var.github_repository
  title       = "v0.5.0 - Creator Community, Submissions & Safety Guardrails"
  description = "Direct track uploading, first-login consent, creator identity, request lifecycle state machine, and automated Whisper/Gemini vocal ASR safety scanning."
  state       = "open"
}

resource "github_repository_milestone" "v0_6_0" {
  owner       = var.github_owner
  repository  = var.github_repository
  title       = "v0.6.0 - Admin Studio, Web MCP & Observability"
  description = "Interactive Web MCP console, Vercel Flags SDK kill switches, soft track deletion, channel administration, and realtime moderation queues."
  state       = "open"
}

resource "github_repository_milestone" "v1_0_0" {
  owner       = var.github_owner
  repository  = var.github_repository
  title       = "v1.0.0 - Production Readiness, Bot Ecosystem & Scale"
  description = "Discord slash commands, Telegram bridge, cross-platform mini-player, AdSense monetization, and public launch."
  state       = "open"
}

# ── Issue Taxonomy Labels ─────────────────────────────────────────────────────

locals {
  github_labels = {
    "urgent" = {
      color       = "e11d21"
      description = "Current issue with severe user, production, or security impact"
    }
    "high" = {
      color       = "d93f0b"
      description = "High impact or strong usability/operational priority"
    }
    "moderate" = {
      color       = "fbca04"
      description = "Meaningful improvement or medium-impact issue"
    }
    "low" = {
      color       = "7f8c8d"
      description = "Nice-to-have or lower-impact issue"
    }
    "client_facing" = {
      color       = "1d76db"
      description = "Directly affects listeners, reviewers, or public product experience"
    }
    "admin_facing" = {
      color       = "5319e7"
      description = "Directly affects station admins, operators, or moderation workflows"
    }
    "dev_facing" = {
      color       = "0e8a16"
      description = "Directly affects developer workflows or engineering experience"
    }
    "ci_cd" = {
      color       = "000000"
      description = "Build, test, release, or deployment automation"
    }
    "infra" = {
      color       = "0366d6"
      description = "Runtime infrastructure, hosting, streaming, or operations"
    }
    "security" = {
      color       = "b60205"
      description = "Auth, exposure, data protection, or abuse-risk issue"
    }
    "triage" = {
      color       = "cfd3d7"
      description = "Needs initial review, priority, and surface labels"
    }
    "accessibility" = {
      color       = "f143ab"
      description = "Barrier affecting people with disabilities"
    }
  }
}

resource "github_issue_label" "promptfm_labels" {
  for_each    = local.github_labels
  repository  = var.github_repository
  name        = each.key
  color       = each.value.color
  description = each.value.description
}

