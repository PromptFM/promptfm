// src/lib/email/receiving.ts
// Resend Inbound Receiving, Retrieval, and Forwarding Service

export interface ReceivedEmailSummary {
  id: string;
  from: string;
  to: string[];
  subject: string;
  createdAt: string;
}

export interface ReceivedEmailDetail extends ReceivedEmailSummary {
  text?: string | null;
  html?: string | null;
}

/**
 * Lists received inbound emails from Resend Receiving API.
 */
export async function listReceivedEmails(apiKey?: string): Promise<ReceivedEmailSummary[]> {
  const token = apiKey || process.env.RESEND_API_KEY;
  if (!token) return [];

  try {
    const res = await fetch('https://api.resend.com/emails/receiving', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return [];

    const json = (await res.json()) as { data?: Array<{ id: string; from: string; to: string[]; subject: string; created_at: string }> };
    return (json.data || []).map((item) => ({
      id: item.id,
      from: item.from,
      to: item.to,
      subject: item.subject,
      createdAt: item.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Retrieves full body content for a received email.
 */
export async function getReceivedEmail(emailId: string, apiKey?: string): Promise<ReceivedEmailDetail | null> {
  const token = apiKey || process.env.RESEND_API_KEY;
  if (!token || !emailId) return null;

  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      id: string;
      from: string;
      to: string[];
      subject: string;
      text?: string | null;
      html?: string | null;
      created_at: string;
    };

    return {
      id: data.id,
      from: data.from,
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html,
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Forwards an inbound email to a target administrator address.
 */
export async function forwardInboundEmail(
  email: ReceivedEmailDetail,
  targetEmail: string,
  apiKey?: string
): Promise<boolean> {
  const token = apiKey || process.env.RESEND_API_KEY;
  if (!token || !targetEmail) return false;

  const contentHtml = email.html || (email.text ? `<pre>${email.text}</pre>` : '<p>(No content)</p>');
  const wrappedHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; background-color: #09090b; color: #f4f4f5; border-radius: 8px;">
      <div style="border-bottom: 1px solid #27272a; padding-bottom: 12px; margin-bottom: 16px;">
        <span style="background: #10b981; color: #000; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">PromptFM Inbound</span>
        <h2 style="margin: 8px 0 4px 0; color: #fff;">${email.subject}</h2>
        <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
          <strong>From:</strong> ${email.from} &nbsp;|&nbsp; <strong>To:</strong> ${email.to.join(', ')}
        </p>
      </div>
      <div style="padding: 12px 0;">
        ${contentHtml}
      </div>
      <div style="border-top: 1px solid #27272a; margin-top: 20px; padding-top: 10px; font-size: 11px; color: #71717a;">
        PromptFM Automated Forwarder • Received via Resend for ${email.to.join(', ')}
      </div>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        from: 'PromptFM Forwarder <dev@promptfm.live>',
        to: targetEmail,
        subject: `[PromptFM Inbound] ${email.subject}`,
        html: wrappedHtml,
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}
