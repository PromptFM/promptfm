# Google Cloud OAuth 2.0 & Multi-Cloud Identity Setup Guide

> **Target Goal:** 100% General Availability (In Production), $0 Cost, Zero Verification Delays.  
> **Production App:** [`https://promptfm.live`](https://promptfm.live)  
> **Supabase Auth Project:** `oxfacfdpxbxilucooijy.supabase.co`

---

## ⚡ Executive Summary: Answers to Key Questions

| Question | Answer | Why? |
|---|---|---|
| **Should you upload an app logo?** | ❌ **NO (Leave Empty)** | In Google Cloud's External OAuth policy, **uploading a custom logo automatically triggers mandatory Brand Verification**. Leaving it blank allows **instant publication to production with 0 verification delays**. |
| **Should you send it for verification?** | ❌ **NO** | If you only request non-sensitive scopes (`openid`, `email`, `profile`) without a logo, Google classifies the app as exempt from review. You can click **"Publish App"** to production immediately. |
| **Can we request Age / Birthdate from Google?** | ❌ **DO NOT REQUEST** | Google puts birthdate under the People API (`user.birthday.read`), which is a **Restricted Scope** requiring formal CASA security audits and paid third-party reviews. |
| **How does PromptFM handle Age legally?** | ✅ **Statutory Self-Attestation Modal** | PromptFM uses the statutory 18+ modal (`promptfm_age_verified_18`), which provides full legal compliance under US COPPA, Section 230, and age-of-majority laws at **$0 cost**. |
| **Is this $0 cost?** | ✅ **100% Free** | Google Cloud OAuth 2.0 Web Client credentials and Supabase Google OAuth are 100% free with unlimited sign-in volume. |

---

## 🛠️ Step-by-Step Google Cloud Console Walkthrough

### Step 1: Configure OAuth Consent Screen
1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials/consent?project=promptfm-radio-1793623670).
2. Choose **User Type: External** and click **CREATE**.
3. **App Information**:
   - **App name:** `PromptFM`
   - **User support email:** `trifan.alex.criss@gmail.com`
   - **App logo:** ⚠️ **LEAVE EMPTY (Do NOT upload any file)**.
4. **App Domain**:
   - **Application home page:** `https://promptfm.live`
   - **Application privacy policy link:** `https://promptfm.live/privacy`
   - **Application terms of service link:** `https://promptfm.live/terms`
5. **Authorized Domains**:
   - Add: `promptfm.live`
   - Add: `supabase.co`
6. **Developer Contact Information**:
   - Email: `trifan.alex.criss@gmail.com`
7. Click **SAVE AND CONTINUE**.

---

### Step 2: Configure Scopes (Non-Sensitive Only)
1. Click **ADD OR REMOVE SCOPES**.
2. Select only the following non-sensitive basic scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
3. ⚠️ **Do NOT select any sensitive or restricted scopes** (e.g. no Google Drive, Gmail, or People API birthday scopes).
4. Click **UPDATE** $\to$ **SAVE AND CONTINUE**.

---

### Step 3: Publish App to Production (General Availability)
1. In the left navigation, click **OAuth consent screen**.
2. Under **Publishing status**, look for the button **PUBLISH APP**.
3. A confirmation modal will pop up: *"Push to production? Your app will be available to any user with a Google Account."*
4. Click **CONFIRM**.
5. Your status will immediately switch to: **"In production"** with verification status: **"Verification not required"**.

---

### Step 4: Create OAuth 2.0 Web Client Credentials
1. In the left navigation, click **Credentials**.
2. Click **+ CREATE CREDENTIALS** $\to$ **OAuth client ID**.
3. **Application type:** Select **Web application**.
4. **Name:** `PromptFM Web Client`.
5. **Authorized JavaScript origins**:
   ```text
   https://promptfm.live
   https://oxfacfdpxbxilucooijy.supabase.co
   http://localhost:3000
   ```
6. **Authorized redirect URIs**:
   ```text
   https://oxfacfdpxbxilucooijy.supabase.co/auth/v1/callback
   https://promptfm.live
   http://localhost:3000
   ```
7. Click **CREATE**.
8. A modal appears displaying your **Client ID** and **Client Secret**. Keep this window open or copy both values.

---

### Step 5: Wire into Supabase Dashboard
1. Open the [Supabase Dashboard Google Provider Settings](https://supabase.com/dashboard/project/oxfacfdpxbxilucooijy/auth/providers).
2. Find **Google** in the list of providers.
3. Toggle **Enable Google provider: ON**.
4. Paste the **Client ID** and **Client Secret** copied from Google Cloud.
5. Click **Save**.
6. Google OAuth sign-in is now live on `https://promptfm.live`! Users can click the user avatar in the top right and sign in with one click.

---

## ☁️ Terraform Multi-Cloud Wiring (`infra/terraform/oauth.tf`)

If PromptFM ever migrates to another cloud provider (AWS Cognito, Cloudflare Access, self-hosted Keycloak, or another GCP project), all settings are declaratively defined:

- **Terraform File:** [`infra/terraform/oauth.tf`](file:///Users/trifan/DEVELOPMENT/promptfm/infra/terraform/oauth.tf)
- **Variables:** [`infra/terraform/variables.tf`](file:///Users/trifan/DEVELOPMENT/promptfm/infra/terraform/variables.tf)
- **Outputs:** [`infra/terraform/outputs.tf`](file:///Users/trifan/DEVELOPMENT/promptfm/infra/terraform/outputs.tf)

### Storing Credentials Securely in Google Secret Manager ($0 Tier)
```bash
# Save Client ID in Secret Manager
echo -n "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com" | \
  gcloud secrets versions add promptfm-google-oauth-client-id --data-file=-

# Save Client Secret in Secret Manager
echo -n "YOUR_GOOGLE_CLIENT_SECRET" | \
  gcloud secrets versions add promptfm-google-oauth-client-secret --data-file=-
```
GCP Secret Manager allows 6 active secret versions for free per month ($0).
