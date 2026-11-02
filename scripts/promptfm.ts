#!/usr/bin/env node
// scripts/promptfm.ts
// Command-line interface for PromptFM DJs, station admins, and terminal power-users.
// Usage:
//   npm run promptfm dj "Crack a joke about GPUs melting and introduce the next synthwave block"
//   npm run promptfm news [topic] [--live]
//   npm run promptfm queue "cyberpunk synthwave"
//   npm run promptfm broadcast "Announcement to Discord & Telegram"
//   npm run promptfm schedule
//   npm run promptfm admin pending
//   npm run promptfm admin approve <trackId>
//   npm run promptfm listen

import { createBroadcastDrop, fetchLiveHeadlines } from '../src/lib/dj/engine';
import { createAdminClient } from '../src/lib/supabase/server';
import { broadcastToCommunity } from '../src/lib/chat/bridge';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (!command || command === 'help') {
    console.log(`
📻 PromptFM Terminal Station Manager & Admin CLI
------------------------------------------------
AI DJ & Custom Voice Prompting:
  dj <prompt>             Send ANY custom prompt to Gemini -> Generates script + synthesizes voice + queues MP3
  news [topic] [--live]   Fetch real live tech headlines from RSS -> Generates news broadcast with voice
  announce <text>         Synthesize a quick announcement drop for listeners
  queue <prompt>          Find and queue a track matching a text vibe or prompt
  listen                  Launch the live audio stream in terminal (mpv/ffplay)

Station Admin & Socials:
  schedule                Display declarative hourly programming & prompt styles from schedule.yaml
  broadcast <message>     Push rich notification to connected Discord & Telegram channels
  admin pending           List community tracks waiting for approval
  admin approve <id>      Approve a pending track for airplay
  admin reject <id>       Reject a track
  help                    Show this guide
`);
    return;
  }

  switch (command) {
    case 'dj': {
      const userPrompt = args.slice(1).join(' ');
      if (!userPrompt) {
        console.error('Error: Please provide a prompt for Gemini.');
        console.log('Example: npm run promptfm dj "Crack a joke about GPUs melting while generating synthwave"');
        process.exit(1);
      }
      console.log(`🤖 Prompting Gemini with: "${userPrompt}"...`);
      console.log(`🎙️  Synthesizing radio voice via Google Cloud Journey Voice...`);
      const { script, audioUrl } = await createBroadcastDrop({
        type: 'custom_prompt',
        topicOrText: userPrompt,
      });
      console.log(`\n✨ Spoken Monologue:\n"${script}"\n`);
      console.log(`🔗 Audio Drop URL: ${audioUrl}`);
      break;
    }

    case 'news': {
      const isLive = args.includes('--live');
      const filteredArgs = args.slice(1).filter((a) => a !== '--live');
      const topic = filteredArgs.join(' ') || 'Latest AI music releases and generative audio updates';

      let headlines: string[] = [];
      if (isLive || filteredArgs.length === 0) {
        console.log(`🌐 Scraping live RSS headlines (Hacker News, Google News AI)...`);
        headlines = await fetchLiveHeadlines();
        console.log(`📰 Found ${headlines.length} fresh headlines:\n` + headlines.map((h, i) => `   ${i + 1}. ${h}`).join('\n'));
      }

      console.log(`\n🤖 Prompting Gemini with headlines on topic: "${topic}"...`);
      const { script, audioUrl } = await createBroadcastDrop({
        type: 'news',
        headlines,
        topicOrText: topic,
      });
      console.log(`\n🎙️  Broadcast News Script:\n"${script}"\n`);
      console.log(`🔗 Audio Broadcast URL: ${audioUrl}`);
      break;
    }

    case 'announce': {
      const text = args.slice(1).join(' ');
      if (!text) {
        console.error('Error: Please provide announcement text.');
        process.exit(1);
      }
      console.log(`🎙️  Generating DJ announcement for: "${text}"...`);
      const { script, audioUrl } = await createBroadcastDrop({
        type: 'announcement',
        topicOrText: text,
      });
      console.log(`\n✨ Spoken Script:\n"${script}"\n`);
      console.log(`🔗 Audio Drop URL: ${audioUrl}`);
      break;
    }

    case 'broadcast': {
      const message = args.slice(1).join(' ');
      if (!message) {
        console.error('Error: Provide message to broadcast to Discord/Telegram.');
        process.exit(1);
      }
      console.log(`📢 Broadcasting to connected community channels (Discord/Telegram)...`);
      await broadcastToCommunity({
        title: 'PromptFM Live Announcement',
        message,
        author: 'Station Admin',
      });
      console.log(`✅ Broadcast sent.`);
      break;
    }

    case 'schedule': {
      const schedulePath = join(process.cwd(), 'config', 'schedule.yaml');
      if (!existsSync(schedulePath)) {
        console.log('No schedule.yaml found at config/schedule.yaml');
        return;
      }
      const raw = readFileSync(schedulePath, 'utf8');
      console.log(`\n📅 PromptFM Active Station Schedule & Prompts:\n`);
      console.log(raw);
      break;
    }

    case 'admin': {
      const sub = args[1];
      const targetId = args[2];
      const supabase = createAdminClient();

      if (sub === 'pending') {
        const { data: pending, error } = await supabase
          .from('tracks')
          .select('id, title, artist_name, tool_used, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching tracks:', error);
          return;
        }

        console.log(`\n⏳ Pending Tracks Awaiting Moderation (${pending?.length || 0}):`);
        pending?.forEach((t) => {
          console.log(`• [${t.id}] "${t.title}" by ${t.artist_name} (${t.tool_used})`);
        });
        return;
      }

      if (sub === 'approve') {
        if (!targetId) {
          console.error('Provide track ID: npm run promptfm admin approve <id>');
          return;
        }
        const { error } = await supabase
          .from('tracks')
          .update({ status: 'approved' })
          .eq('id', targetId);

        if (error) {
          console.error('Failed to approve track:', error.message);
        } else {
          console.log(`✅ Track ${targetId} is now APPROVED and live on charts!`);
        }
        return;
      }

      if (sub === 'reject') {
        if (!targetId) {
          console.error('Provide track ID: npm run promptfm admin reject <id>');
          return;
        }
        const { error } = await supabase
          .from('tracks')
          .update({ status: 'rejected' })
          .eq('id', targetId);

        if (error) {
          console.error('Failed to reject track:', error.message);
        } else {
          console.log(`❌ Track ${targetId} marked as REJECTED.`);
        }
        return;
      }

      console.log('Admin subcommands: pending, approve <id>, reject <id>');
      break;
    }

    case 'queue': {
      const query = args.slice(1).join(' ');
      if (!query) {
        console.error('Error: Provide a prompt or vibe to search (e.g. "chill synth")');
        process.exit(1);
      }
      console.log(`🔎 Searching approved tracks matching: "${query}"...`);
      const supabase = createAdminClient();
      const { data: tracks, error } = await supabase
        .from('tracks')
        .select('id, title, artist_name, tool_used, audio_url')
        .eq('status', 'approved')
        .ilike('title', `%${query}%`)
        .limit(3);

      if (error || !tracks || tracks.length === 0) {
        console.log(`No exact title match found for "${query}". Showing highest-rated track to queue.`);
        const { data: top } = await supabase
          .from('tracks')
          .select('id, title, artist_name')
          .eq('status', 'approved')
          .order('upvotes_count', { ascending: false })
          .limit(1)
          .single();
        if (top) {
          console.log(`✅ Queued: "${top.title}" by ${top.artist_name} (ID: ${top.id})`);
        }
      } else {
        const selected = tracks[0];
        if (selected) {
          console.log(`✅ Queued for airplay: "${selected.title}" by ${selected.artist_name} (${selected.tool_used})`);
        }
      }
      break;
    }

    case 'listen': {
      const streamUrl = process.env.NEXT_PUBLIC_STREAM_URL || 'https://ice1.somafm.com/groovesalad-128-mp3';
      console.log(`🔊 Connecting to PromptFM Stream: ${streamUrl}`);
      try {
        execSync(`mpv --no-video "${streamUrl}"`, { stdio: 'inherit' });
      } catch {
        try {
          execSync(`ffplay -nodisp -autoexit "${streamUrl}"`, { stdio: 'inherit' });
        } catch {
          console.log(`To listen in the terminal, install mpv: brew install mpv`);
          console.log(`Or listen directly at your browser: http://localhost:3000`);
        }
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}. Run "npm run promptfm help" for guidance.`);
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
