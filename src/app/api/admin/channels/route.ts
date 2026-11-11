// src/app/api/admin/channels/route.ts
// First-party admin channel management API for the /admin console.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { autoGenerateChannelGuardrails } from '@/lib/safety/channel-guardrails';
import { setChannelActiveOverride } from '@/lib/radio/channels';
import { isAdminAuthorized } from '@/lib/auth/admin-route-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'create') {
      const slug = String(body.slug || '').trim().toLowerCase();
      const name = String(body.name || '').trim();
      const description = String(body.description || '').trim();
      const djId = String(body.djId || 'dj_neon').trim() || 'dj_neon';
      const is18Plus = Boolean(body.is18Plus);
      const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

      if (!slug || !name) {
        return NextResponse.json({ error: 'Channel slug and name are required.' }, { status: 400 });
      }

      const guardrails = autoGenerateChannelGuardrails({
        is18Plus,
        allowExplicit247: is18Plus,
      });

      setChannelActiveOverride(slug, isActive);

      const channel = {
        slug,
        name,
        short_name: name,
        description,
        vibe: description || (guardrails.allow_explicit_24_7 ? '18+ Explicit Underground' : 'AI Generated Radio'),
        badge: guardrails.allow_explicit_24_7 ? '🔞 18+ Explicit' : '📻 Live Channel',
        accent_color: guardrails.allow_explicit_24_7 ? 'rose' : 'emerald',
        icon: guardrails.allow_explicit_24_7 ? 'Flame' : 'Radio',
        dj_id: djId,
        is_family_safe: guardrails.is_family_safe,
        min_age: guardrails.min_age,
        requires_age_gate: guardrails.requires_age_gate,
        allow_explicit_24_7: guardrails.allow_explicit_24_7,
        age_gate_disclaimer: guardrails.age_gate_disclaimer,
        stream_url: `https://stream.promptfm.live/live?channel=${slug}`,
        is_active: isActive,
      };

      const dbPayload = {
        slug,
        name,
        description,
        dj_id: djId,
        is_family_safe: guardrails.is_family_safe,
        min_age: guardrails.min_age,
        requires_age_gate: guardrails.requires_age_gate,
        allow_explicit_24_7: guardrails.allow_explicit_24_7,
        age_gate_disclaimer: guardrails.age_gate_disclaimer,
        is_active: isActive,
      };

      try {
        const supabase = createAdminClient();
        const { error } = await supabase.from('channels').upsert(dbPayload, { onConflict: 'slug' });
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Channel "${name}" (${slug}) created with automated guardrails.`,
        channel,
      });
    }

    if (action === 'set_status') {
      const slug = String(body.slug || '').trim().toLowerCase();
      if (!slug) {
        return NextResponse.json({ error: 'Channel slug is required.' }, { status: 400 });
      }

      const isActive = Boolean(body.isActive);
      setChannelActiveOverride(slug, isActive);

      try {
        const supabase = createAdminClient();
        const { error } = await supabase.from('channels').upsert({ slug, is_active: isActive }, { onConflict: 'slug' });
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        slug,
        is_active: isActive,
        message: `Channel "${slug}" has been ${isActive ? 'enabled' : 'disabled'}.`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
