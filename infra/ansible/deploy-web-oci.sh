#!/usr/bin/env bash
# Deploys the PromptFM web app to the Oracle host. Mirrors deploy-oci.sh so the
# same repo-owned entrypoint works on a laptop and in CI.
set -euo pipefail
cd "$(dirname "$0")"

REPO_ROOT="$(cd ../.. && pwd)"
RESOLVER="$REPO_ROOT/scripts/resolve-oci-web-env.cjs"
PULLED_ENV_FILE="$REPO_ROOT/.env.production.local"

SECRET="${OCI_SECRET:-promptfm-oci-credentials}"
PROJECT="${GCP_PROJECT_ID:-promptfm-radio-1793623670}"
CLI_PROMPTFM_WEB_RELEASE_ID=""
CLI_PROMPTFM_WEB_IMAGE=""

looks_like_github_token() {
  case "${1:-}" in
    ghp_*|gho_*|ghu_*|ghs_*|ghr_*|github_pat_*) return 0 ;;
    *) return 1 ;;
  esac
}

resolve_git_origin_url() {
  git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true
}

resolve_git_head_sha() {
  git -C "$REPO_ROOT" rev-parse --short=12 HEAD 2>/dev/null || true
}

extract_origin_registry_username() {
  local remote_url="${1:-}"
  local auth_segment=""
  local username=""

  case "$remote_url" in
    https://*@github.com/*)
      auth_segment="${remote_url#https://}"
      auth_segment="${auth_segment%%@github.com/*}"
      if [[ "$auth_segment" == *:* ]]; then
        username="${auth_segment%%:*}"
        case "$username" in
          x-access-token|oauth2) username="" ;;
        esac
      fi
      ;;
  esac

  printf '%s' "$username"
}

extract_origin_registry_token() {
  local remote_url="${1:-}"
  local auth_segment=""
  local token=""

  case "$remote_url" in
    https://*@github.com/*)
      auth_segment="${remote_url#https://}"
      auth_segment="${auth_segment%%@github.com/*}"
      if [[ "$auth_segment" == *:* ]]; then
        token="${auth_segment#*:}"
      elif looks_like_github_token "$auth_segment"; then
        token="$auth_segment"
      fi
      ;;
  esac

  printf '%s' "$token"
}

extract_origin_repository_owner() {
  local remote_url="${1:-}"
  local owner=""

  case "$remote_url" in
    https://github.com/*)
      owner="$(printf '%s' "$remote_url" | sed -E 's#^https://github\.com/([^/]+)/.*#\1#')"
      ;;
    https://*@github.com/*)
      owner="$(printf '%s' "$remote_url" | sed -E 's#^https://[^@]+@github\.com/([^/]+)/.*#\1#')"
      ;;
    git@github.com:*)
      owner="$(printf '%s' "$remote_url" | sed -E 's#^git@github\.com:([^/]+)/.*#\1#')"
      ;;
    ssh://git@github.com/*)
      owner="$(printf '%s' "$remote_url" | sed -E 's#^ssh://git@github\.com/([^/]+)/.*#\1#')"
      ;;
  esac

  printf '%s' "$owner"
}

resolve_repository_owner() {
  if [ -n "${GITHUB_REPOSITORY_OWNER:-}" ]; then
    printf '%s' "$GITHUB_REPOSITORY_OWNER"
    return
  fi

  if [ -n "${GITHUB_REPOSITORY:-}" ] && [[ "$GITHUB_REPOSITORY" == */* ]]; then
    printf '%s' "${GITHUB_REPOSITORY%%/*}"
    return
  fi

  extract_origin_repository_owner "$(resolve_git_origin_url)"
}

sanitize_release_id() {
  printf '%s' "${1:-}" \
    | sed 's#^promptfm/##' \
    | tr '/:@ ' '-' \
    | tr -cd '[:alnum:]._-' \
    | cut -c1-63
}

extract_extra_var_value() {
  EXTRA_VARS_PAYLOAD="${1:-}" EXTRA_VARS_KEY="${2:-}" python3 - <<'PY'
import json
import os
import shlex
import sys

payload = os.environ.get("EXTRA_VARS_PAYLOAD", "")
key = os.environ.get("EXTRA_VARS_KEY", "")
value = ""
trimmed = payload.strip()

if trimmed and not trimmed.startswith("@"):
    if trimmed.startswith("{"):
        try:
            parsed = json.loads(trimmed)
        except Exception:
            parsed = None
        if isinstance(parsed, dict) and key in parsed and parsed[key] is not None:
            value = str(parsed[key])

    if not value:
        try:
            tokens = shlex.split(payload)
        except Exception:
            tokens = payload.split()

        for token in tokens:
            if "=" not in token:
                continue
            token_key, token_value = token.split("=", 1)
            if token_key == key:
                value = token_value
                break

sys.stdout.write(value)
PY
}

capture_cli_extra_var_overrides() {
  local expecting_extra_vars=0
  local arg=""
  local extra_vars=""
  local release_id=""
  local image_ref=""

  for arg in "$@"; do
    if [ "$expecting_extra_vars" -eq 1 ]; then
      extra_vars="$arg"
      expecting_extra_vars=0
    else
      case "$arg" in
        -e|--extra-vars)
          expecting_extra_vars=1
          continue
          ;;
        -e?*)
          extra_vars="${arg#-e}"
          ;;
        --extra-vars=*)
          extra_vars="${arg#--extra-vars=}"
          ;;
        *)
          continue
          ;;
      esac
    fi

    release_id="$(extract_extra_var_value "$extra_vars" "promptfm_web_release_id")"
    if [ -n "$release_id" ]; then
      CLI_PROMPTFM_WEB_RELEASE_ID="$release_id"
    fi

    image_ref="$(extract_extra_var_value "$extra_vars" "promptfm_web_image")"
    if [ -n "$image_ref" ]; then
      CLI_PROMPTFM_WEB_IMAGE="$image_ref"
    fi
  done
}

resolve_registry_auth_defaults() {
  export PROMPTFM_WEB_REGISTRY="${PROMPTFM_WEB_REGISTRY:-ghcr.io}"

  if [ -n "${PROMPTFM_WEB_REGISTRY_USERNAME:-}" ] && [ -n "${PROMPTFM_WEB_REGISTRY_TOKEN:-}" ]; then
    return
  fi

  local origin_url=""
  if [ -z "${PROMPTFM_WEB_REGISTRY_USERNAME:-}" ]; then
    local registry_username="${GITHUB_ACTOR:-${GITHUB_USER:-}}"
    if [ -z "$registry_username" ]; then
      if [ -z "$origin_url" ]; then
        origin_url="$(resolve_git_origin_url)"
      fi
      registry_username="$(extract_origin_registry_username "$origin_url")"
    fi
    if [ -n "$registry_username" ]; then
      export PROMPTFM_WEB_REGISTRY_USERNAME="$registry_username"
    fi
  fi

  if [ -z "${PROMPTFM_WEB_REGISTRY_TOKEN:-}" ]; then
    local registry_token="${GH_PAT:-${GITHUB_TOKEN:-}}"
    if [ -z "$registry_token" ]; then
      if [ -z "$origin_url" ]; then
        origin_url="$(resolve_git_origin_url)"
      fi
      registry_token="$(extract_origin_registry_token "$origin_url")"
    fi
    if [ -n "$registry_token" ]; then
      export PROMPTFM_WEB_REGISTRY_TOKEN="$registry_token"
    fi
  fi
}

resolve_release_metadata_defaults() {
  if [ -z "${PROMPTFM_WEB_RELEASE_ID:-}" ]; then
    local head_sha=""
    local source_ref=""
    local release_id=""

    if [ -n "$CLI_PROMPTFM_WEB_RELEASE_ID" ]; then
      release_id="$CLI_PROMPTFM_WEB_RELEASE_ID"
    else
      source_ref="${PROMPTFM_WEB_RELEASE_TAG:-${PROMPTFM_WEB_ROLLBACK_REF:-}}"
      if [ -z "$source_ref" ]; then
        head_sha="$(resolve_git_head_sha)"
        source_ref="$head_sha"
      fi
      if [ -n "$source_ref" ]; then
        release_id="$(sanitize_release_id "$source_ref")"
      fi
    fi

    if [ -z "$release_id" ]; then
      if [ -n "$head_sha" ]; then
        release_id="release-$head_sha"
      else
        release_id="release-local"
      fi
    fi

    export PROMPTFM_WEB_RELEASE_ID="$release_id"
  fi

  if [ -z "${PROMPTFM_WEB_IMAGE:-}" ]; then
    if [ -n "$CLI_PROMPTFM_WEB_IMAGE" ]; then
      export PROMPTFM_WEB_IMAGE="$CLI_PROMPTFM_WEB_IMAGE"
      return
    fi

    local repository_owner=""
    local owner_lower=""

    repository_owner="$(resolve_repository_owner)"
    owner_lower="$(printf '%s' "${repository_owner:-promptfm}" | tr '[:upper:]' '[:lower:]')"
    export PROMPTFM_WEB_IMAGE="${PROMPTFM_WEB_REGISTRY:-ghcr.io}/$owner_lower/promptfm-web:${PROMPTFM_WEB_RELEASE_ID}"
  fi
}

capture_cli_extra_var_overrides "$@"
resolve_registry_auth_defaults
resolve_release_metadata_defaults

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
  export GOOGLE_OAUTH_ACCESS_TOKEN
fi

KEY="$(mktemp)"
trap 'rm -f "$KEY"' EXIT
gcloud secrets versions access latest --secret="$SECRET" --project="$PROJECT" \
  | python3 -c 'import json,sys; sys.stdout.write(json.load(sys.stdin)["ssh_private_key"])' > "$KEY"
chmod 600 "$KEY"

if [ -z "${OCI_WEB_RUNTIME_ENV_JSON:-}" ]; then
  if [ -n "${VERCEL_TOKEN:-}" ]; then
    (
      cd "$REPO_ROOT"
      npx vercel env pull .env.production.local --environment=production --yes
    ) || echo "ℹ️ Vercel env pull failed, continuing with the GCP bundle secret and existing environment." >&2
  elif [ -z "${VERCEL_TOKEN:-}" ]; then
    echo "ℹ️ VERCEL_TOKEN not provided, continuing with the GCP bundle secret and existing environment." >&2
  fi

  BUNDLE_SECRET_NAME="$(node "$RESOLVER" --print-bundle-secret-name | tr -d '\n')"
  if [ -z "$BUNDLE_SECRET_NAME" ]; then
    echo "config/non-infra-app-env.json must define gcpBundleSecretName." >&2
    exit 1
  fi

  GCP_BUNDLED_APP_ENV_JSON="$(gcloud secrets versions access latest --secret="$BUNDLE_SECRET_NAME" --project="$PROJECT" 2>/dev/null || true)"
  OCI_WEB_RUNTIME_ENV_JSON="$({
    cd "$REPO_ROOT"
    GCP_BUNDLED_APP_ENV_JSON="$GCP_BUNDLED_APP_ENV_JSON" node "$RESOLVER"
  } | python3 -c 'import json,sys; payload=json.load(sys.stdin); sys.stdout.write(json.dumps(payload.get("runtimeEnv", {}), separators=(",", ":")))')"
  export OCI_WEB_RUNTIME_ENV_JSON
fi

terraform -chdir=../terraform-oci init -input=false >/dev/null
IP="$(terraform -chdir=../terraform-oci output -raw public_ip)"

export ANSIBLE_CONFIG="$PWD/ansible.cfg"
export ANSIBLE_HOST_KEY_CHECKING=False

PLAYBOOK_CMD=(
  env
  -u ANSIBLE_VAULT_PASSWORD_FILE
  ansible-playbook
  playbook-web-oci.yml
  -e "ansible_host=$IP"
  -e "ansible_ssh_private_key_file=$KEY"
)

if [ -n "${PROMPTFM_WEB_CANDIDATE_SMOKE_PATHS_JSON:-}" ]; then
  PLAYBOOK_CMD+=(
    -e "promptfm_web_candidate_smoke_paths_json=${PROMPTFM_WEB_CANDIDATE_SMOKE_PATHS_JSON}"
  )
fi

PLAYBOOK_CMD+=("$@")

"${PLAYBOOK_CMD[@]}"
