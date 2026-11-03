# PromptFM Model Context Protocol (MCP) Integration Manual

> **Official Live Server Endpoint:** [`https://promptfm.live/api/mcp`](https://promptfm.live/api/mcp)  
> **Protocol Specification:** JSON-RPC 2.0 (Streamable HTTP / Model Context Protocol)  
> **Server Version:** `1.0.0` (Supports both Public Listener Mode and Station Admin Mode)

---

## 1. Dual-Tier Architecture: User vs. Admin Access

PromptFM’s MCP server is architected with a **dual-tier security model**:

| Tier | Required Authentication | Who Uses It? | Available Capabilities |
|---|---|---|---|
| **Public Listener Mode** | **NONE ($0 / Zero Friction)** | Listeners, community creators, AI researchers, Claude Desktop, Cursor users | Query weekly charts, perform pgvector semantic vibe searches, request song dedications on air, inspect live DJ rotation, and file safety reports. |
| **Station Admin Mode** | **`ADMIN_API_KEY`** | Station Program Directors, automated DJ agents, moderation subagents, CI/CD runners | 1-Click track approval/rejection, voice drop synthesis, live Discord/Telegram broadcasts, sponsor audio injection, and channel provisioning. |

---

## 2. Client Setup: As a Public User (No Key Required)

In Public Listener Mode, AI assistants can search the music catalog, explore the radio schedule, upvote tracks, and dedicate songs without needing any secrets.

### A. Claude Desktop
Add this to your `claude_desktop_config.json` (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "promptfm": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote-proxy",
        "https://promptfm.live/api/mcp"
      ]
    }
  }
}
```

### B. Cursor IDE
Open **Cursor Settings** $\to$ **Features** $\to$ **MCP** $\to$ **+ Add New MCP Server** (or edit `.cursor/mcp.json` in your workspace):

```json
{
  "mcpServers": {
    "promptfm": {
      "url": "https://promptfm.live/api/mcp"
    }
  }
}
```

### C. Google Antigravity / Gemini CLI
Add to your project's `.gemini/antigravity/mcp/promptfm.json` or global config:

```json
{
  "name": "promptfm",
  "endpoint": "https://promptfm.live/api/mcp",
  "protocol": "jsonrpc-http"
}
```

### D. Windsurf / Cline / Roo Code
Configure the remote MCP URL directly as:
```text
https://promptfm.live/api/mcp
```

---

## 3. Client Setup: As Station Admin (Privileged Access)

Station Administrators and automated DJ agents authenticate by providing `ADMIN_API_KEY`. The server accepts the key via:
1. **HTTP Header:** `Authorization: Bearer <ADMIN_API_KEY>`
2. **Custom Header:** `x-admin-key: <ADMIN_API_KEY>`
3. **Query Parameter:** `https://promptfm.live/api/mcp?key=<ADMIN_API_KEY>`

### A. Claude Desktop (Admin Mode)
```json
{
  "mcpServers": {
    "promptfm-admin": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote-proxy",
        "https://promptfm.live/api/mcp",
        "--header",
        "Authorization: Bearer YOUR_ADMIN_API_KEY"
      ]
    }
  }
}
```

### B. Cursor IDE (Admin Mode)
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "promptfm-admin": {
      "url": "https://promptfm.live/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_ADMIN_API_KEY"
      }
    }
  }
}
```
*Alternatively, use the query parameter format if your client does not support custom headers:*
```json
{
  "mcpServers": {
    "promptfm-admin": {
      "url": "https://promptfm.live/api/mcp?key=YOUR_ADMIN_API_KEY"
    }
  }
}
```

### C. Direct cURL Command (Admin Authentication)
```bash
curl -X POST https://promptfm.live/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

---

## 4. Architectural Analysis: API Key vs. OAuth 2.0 for MCP

| Dimension | Static API Key (`ADMIN_API_KEY`) | OAuth 2.0 Bearer Flow |
|---|---|---|
| **Autonomous Agent Suitability** | 🟢 **Ideal**: Headless subagents, cron jobs, and CI/CD pipelines authenticate indefinitely without human interaction. | 🔴 **Poor**: Tokens expire after 1 hour; headless agents fail without complex refresh token token-broker servers. |
| **Client Ecosystem Support** | 🟢 **100% Support**: Native support in Claude Desktop, Cursor, Antigravity, Cline, Windsurf via standard headers or query strings. | 🔴 **Very Low Support**: Most MCP clients (Claude Desktop, Cursor) **do not support interactive OAuth PKCE browser redirect flows** inside MCP tool definitions. |
| **Operational & Cost Footprint** | 🟢 **$0 Cost**: Validated in-memory and against Vercel environment variables with zero database lookups or external auth services. | 🟡 **Added Complexity**: Requires maintaining OAuth client registries, authorization endpoints, token refresh loops, and session state. |
| **Revocation & Key Rotation** | 🟢 **Instant**: Updating `ADMIN_API_KEY` in Vercel immediately revokes compromised tokens across all agents. | 🟡 **Moderate**: Token revocation requires checking blacklists or waiting for token expiry. |

### Architectural Recommendation:
1. **Station Administration:** Keep **Static API Key (`ADMIN_API_KEY`)**. It is the industry standard for agentic tools, reliable, headless, and supported across all MCP hosts.
2. **Listener Accounts:** Keep **Public Tools Open (No Auth)**. Listeners should not face any sign-in friction when asking Claude or Cursor to search for a song by vibe or check what is playing.
3. **Future Multi-User Delegation:** If PromptFM later allows third-party listeners to link their personal accounts so an agent can vote or manage playlists *on their personal behalf*, a hybrid approach using **Supabase JWTs** can be introduced without disrupting admin tool workflows.

---

## 5. Complete Tool Reference

### Public Listener Tools (Available to All)

| Tool Name | Parameters | Description |
|---|---|---|
| `promptfm_search_tracks_by_vibe` | `prompt` (string), `channel?` (string), `limit?` (number) | Performs dense pgvector semantic similarity search across catalog (e.g. *"dark metal about lost love"*, *"chill morning lo-fi"*). |
| `promptfm_get_top_tracks` | `limit?` (number) | Returns top community-voted tracks on the weekly leaderboard with play counts and audio links. |
| `promptfm_queue_song_request` | `prompt` (string), `requested_by?` (string), `channel?` (string) | Queues a track into the live broadcast rotation matching the requested musical vibe. |
| `promptfm_upvote_track` | `track_id` (string) | Casts a real-time community vote for a track on the leaderboard. |
| `promptfm_get_now_playing` | `channel?` (string) | Returns current on-air track, audio streams, active AI DJ, and listener telemetry. |
| `promptfm_get_schedule` | `channel?` (string) | Returns station clock wheel programming blocks, AI news cadences, and weather schedules. |
| `promptfm_report_content` | `target_type`, `target_id`, `reason`, `details?` | Files a content report or copyright notice; immediately dispatches alert to moderation staff. |

### Privileged Admin Tools (`ADMIN_API_KEY` Required)

| Tool Name | Parameters | Description |
|---|---|---|
| `promptfm_admin_list_pending` | *None* | Lists all uploaded community tracks awaiting editorial review. |
| `promptfm_admin_moderate_track` | `track_id` (string), `action` ("approved" \| "rejected") | Approves track for live airplay (triggering vector indexing) or rejects it. |
| `promptfm_admin_list_reports` | `limit?` (number) | Retrieves filed copyright, hate speech, and watershed reports with claimant evidence. |
| `promptfm_admin_resolve_report` | `report_id` (string), `action` ("dismissed" \| "quarantined"), `notes?` | Resolves moderation report and optionally removes infringing audio from broadcast. |
| `promptfm_admin_create_channel` | `slug`, `name`, `description?`, `dj_id?`, `is_18_plus?` | Provisions a new broadcast channel with automatic guardrails and statutory 18+ disclaimers. |
| `promptfm_admin_list_channels` | *None* | Returns all station channels, assigned DJs, age requirements, and live listeners. |
| `promptfm_admin_voice_drop` | `prompt` (string), `dj_id?` (string) | Instructs Gemini 3.5 Flash to compose and voice an on-air radio host announcement. |
| `promptfm_admin_broadcast` | `message` (string) | Pushes an instant station alert or breaking announcement to Discord and Telegram. |
| `promptfm_admin_inject_interstitial` | `type` ("news" \| "weather" \| "announcement"), `prompt?`, `city?` | Forces an interstitial audio drop to play next on air. |
| `promptfm_admin_inject_ad` | `sponsor?`, `copy?`, `dj_id?` | Injects a sponsor read or audio commercial into the live broadcast stream. |
| `promptfm_admin_reject_request` | `request_id`, `reason` | Rejects a listener dedication and sends an automated polite explanation to Discord/Telegram. |
