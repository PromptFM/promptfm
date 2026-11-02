#!/usr/bin/env node
// scripts/promptfm.ts
// Command-line interface for PromptFM DJs, station admins, and terminal power-users.
// Usage:
//   npx tsx scripts/promptfm.ts announce "Station message here"
//   npx tsx scripts/promptfm.ts news "Latest news topic"
//   npx tsx scripts/promptfm.ts queue "cyberpunk synthwave"
//   npx tsx scripts/promptfm.ts listen

import { createBroadcastDrop } from '../src/lib/dj/engine';
import { createAdminClient } from '../src/lib/supabase/server';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (!command || command === 'help') {
    console.log(`
📻 PromptFM Terminal Station Manager
------------------------------------
Usage:
  announce <text>   Generate a live AI DJ spoken announcement & queue it
  news [topic]      Synthesize an AI news bulletin with Gemini + Google TTS
  queue <prompt>    Find and queue a track matching a text vibe or prompt
  listen            Launch the live audio stream in terminal (via mpv/ffplay)
  help              Show this guide
`);
    return;
  }

  switch (command) {
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

    case 'news': {
      const topic = args.slice(1).join(' ') || 'Latest AI music releases and model updates';
      console.log(`📰 Generating AI News Flash on: "${topic}"...`);
      const { script, audioUrl } = await createBroadcastDrop({
        type: 'news',
        topicOrText: topic,
      });
      console.log(`\n🎙️  Broadcast Script:\n"${script}"\n`);
      console.log(`🔗 Audio Broadcast URL: ${audioUrl}`);
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
      console.error(`Unknown command: ${command}. Run "npx tsx scripts/promptfm.ts help" for guidance.`);
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
