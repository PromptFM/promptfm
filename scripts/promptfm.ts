#!/usr/bin/env node
// scripts/promptfm.ts
// Command-line interface for PromptFM DJs, station admins, and terminal power-users.

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { createBroadcastDrop, fetchLiveHeadlines } from '../src/lib/dj/engine';
import { getNextAirplayItem, fetchLiveWeatherSummary, getNowPlaying, getUpNext } from '../src/lib/dj/rotation';
import { synthesizeScheduledRequest, rejectScheduledRequest } from '../src/lib/dj/batches';
import { getAllDJs, getActiveDJ, getDJById, getAdsConfig, getActiveAdSpot } from '../src/lib/dj/roster';
import { createAdminClient } from '../src/lib/supabase/server';
import { broadcastToCommunity, castVoteForTrack } from '../src/lib/chat/bridge';
import { submitContentReport, getRecentReports, resolveContentReport } from '../src/lib/safety/reports';
import { autoGenerateChannelGuardrails } from '../src/lib/safety/channel-guardrails';
import { getAllChannels } from '../src/lib/radio/channels';
import type { ReportReason } from '../src/types/database';
import { extractMetadataFromBuffer, DEFAULT_TRACK_ICON } from '../src/lib/audio/metadata';
import { getR2Client, getBucketName, getPublicUrl } from '../src/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';

const args = process.argv.slice(2);
const command = args[0];

function parseArg(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return undefined;
}

async function main() {
  if (!command || command === 'help') {
    console.log(`
📻 PromptFM Terminal Station Manager & Admin CLI
------------------------------------------------
Tracks & Playlists:
  upload <file>           Upload a local MP3 from your Mac directly to R2 as approved
                          Flags: --title "Name" --artist "Artist" --tool "Suno"

Airplay Queue ("Up Next"):
  now                     Show what is currently playing on stream and active DJ
  next                    Test the rotation clock: calculate what plays next (music, news, or weather)
  vote <trackId>          Cast an upvote for a track from terminal
  queue list              View the upcoming songs scheduled to play next
  queue next <trackId>    Bump a track to the very top of the live queue
  queue remove <queueId>  Remove an item from the upcoming queue
  queue <prompt>          Find & queue a track matching a text vibe

AI Voice & Broadcast:
  djs                     View full AI DJ roster, voices, and who is currently LIVE
  dj <prompt> [--dj name] Send ANY prompt to Gemini -> Generates voice monologue
  weather [city] [--dj]   Synthesize a live weather report for a city in schedule.yaml
  news [topic] [--live]   Fetch live tech headlines -> Generates news audio broadcast
  announce <text> [--dj]  Synthesize a quick announcement drop for listeners
  inject <type> <text>    Force-inject (news|weather|announcement) to play NEXT on air
  ads list                List active sponsor campaigns, frequency, and ad spots
  ads inject [id]         Force-inject a sponsor ad spot to play NEXT on stream
  broadcast <message>     Push notification to connected Discord & Telegram channels
  listen                  Launch the live audio stream in terminal (mpv/ffplay)

Moderation & Schedule:
  channels list           List radio broadcast channels, assigned DJs & guardrail policies
  channels create <slug> <name> Create a channel with automated 18+ guardrails & disclaimers
                          Flags: --18plus --dj <id> --desc "Vibe description"
  requests list           View scheduled Discord/Telegram requests by batch
  requests air <id>       Force-synthesize & air a scheduled dedication or request
  requests reject <id>    Remove item from batch with reason & notify user on Telegram/Discord
                          Flags: --reason "Religious mockery / 18+ content"
  admin pending           List community tracks waiting for review
  admin approve <id>      Approve a pending track for airplay
  admin reject <id>       Reject a track
  schedule                Display declarative hourly programming from schedule.yaml
  help                    Show this guide
`);
    return;
  }

  switch (command) {
    case 'now':
    case 'np': {
      const np = await getNowPlaying();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://promptfm.live';
      const streamUrl = process.env.NEXT_PUBLIC_STREAM_URL || 'https://stream.promptfm.live/stream.mp3';
      const rankText = np.rank
        ? `#${np.rank}${np.totalApprovedTracks ? ` of ${np.totalApprovedTracks}` : ''} on Weekly Chart`
        : 'Featured Airplay';

      console.log(`\n📻 PromptFM — Now Playing on Air:`);
      console.log(`------------------------------------------------`);
      console.log(`Track ID:    ${np.item.id || 'N/A'}`);
      console.log(`Title:       "${np.item.title}"`);
      console.log(`Artist/Host: ${np.item.artist} ${np.item.tool_used ? `(${np.item.tool_used})` : ''}`);
      console.log(`Type:        [${np.item.type.toUpperCase()}]`);
      console.log(`Chart Rank:  🏆 ${rankText}`);
      console.log(`Community:   🔥 ${np.item.upvotes_count ?? 0} upvotes`);
      console.log(`Active DJ:   🎙️ ${np.activeDJ.name} — ${np.activeDJ.title}`);
      console.log(`Airtime:     ${np.elapsedSeconds}s elapsed (Started at ${np.startedAt})`);
      console.log(`Audio File:  ${np.item.audio_url}`);
      console.log(`Stream Live: ${streamUrl}`);
      console.log(`Tune In Web: ${siteUrl}`);
      if (np.item.id && np.item.id !== 'demo-fallback') {
        console.log(`Quick Vote:  npm run promptfm vote ${np.item.id}`);
      }
      console.log(`------------------------------------------------\n`);
      break;
    }

    case 'vote': {
      const targetId = args[1];
      if (!targetId) {
        console.error('Error: Please provide track ID: npm run promptfm vote <trackId>');
        return;
      }
      const res = await castVoteForTrack(targetId);
      if (res.success) {
        console.log(`🎉 Upvoted "${res.title}"! Total community votes: ${res.newCount}`);
      } else {
        console.error(`Failed to cast vote for track ${targetId}.`);
      }
      break;
    }

    case 'requests': {
      const sub = args[1];
      const targetId = args[2];
      const supabase = createAdminClient();

      if (sub === 'air') {
        if (!targetId) {
          console.error('Provide request ID: npm run promptfm requests air <requestId>');
          return;
        }
        console.log(`🎙️  Synthesizing voice drop for request ${targetId}...`);
        const result = await synthesizeScheduledRequest(targetId);
        console.log(`\n✨ Synthesized Script:\n"${result.script}"\n`);
        console.log(`🔗 Audio URL: ${result.audioUrl}`);
        console.log(`📢 Dispatched "ON AIR NOW" alert to community Discord/Telegram.`);
        return;
      }

      if (sub === 'reject' || sub === 'remove') {
        if (!targetId) {
          console.error('Provide request ID: npm run promptfm requests reject <requestId> --reason "Explanation"');
          return;
        }
        const reason = parseArg('--reason') || 'Declined by broadcast standards & practices';
        console.log(`🚫 Removing request ${targetId} from broadcast batch...`);
        const result = await rejectScheduledRequest(targetId, reason, 'Station Director (CLI)');
        console.log(`✅ ${result.message}`);
        return;
      }

      // Default: list
      const { data: requests, error } = await supabase
        .from('community_requests')
        .select('*')
        .in('status', ['pending', 'scheduled'])
        .order('created_at', { ascending: true })
        .limit(20);

      if (error) {
        console.error('Error fetching requests:', error.message);
        return;
      }

      console.log(`\n📬 Incoming Community Requests (${requests?.length || 0}):`);
      if (!requests || requests.length === 0) {
        console.log('• No pending requests. All batches clear.');
      } else {
        requests.forEach((r) => {
          console.log(
            `• [ID: ${r.id}] [${r.batch_id || 'NEXT'}] [${r.type.toUpperCase()}] from @${r.platform_user_name} (${r.platform}): "${r.content}" ${
              r.target ? `(Target: ${r.target})` : ''
            }`
          );
        });
      }
      break;
    }

    case 'next': {
      console.log('📻 Calculating next item on the PromptFM clock wheel...');
      const item = await getNextAirplayItem('main');
      console.log(`\n🎧 Up Next on Air:`);
      console.log(`• Type: [${item.type.toUpperCase()}]`);
      console.log(`• Title: "${item.title}"`);
      console.log(`• Artist / Host: ${item.artist}`);
      console.log(`• Stream URL: ${item.audio_url}`);
      break;
    }

    case 'upload': {
      const filePath = args[1];
      if (!filePath || filePath.startsWith('--')) {
        console.error('Error: Please specify the local path to the MP3 file.');
        console.log('Usage: npm run promptfm upload /path/to/song.mp3 --title "My Track" --artist "DJ Name" --category "Synthwave & Electro" --tool "Suno"');
        process.exit(1);
      }

      if (!existsSync(filePath)) {
        console.error(`Error: File not found at "${filePath}"`);
        process.exit(1);
      }

      const fileBuffer = readFileSync(filePath);
      const rawFileName = basename(filePath);
      const cleanFileName = rawFileName.replace(/^["']|["']$/g, '');

      // Detect media extension and MIME type
      const lowerName = cleanFileName.toLowerCase();
      let ext = 'mp3';
      let contentType = 'audio/mpeg';

      if (lowerName.endsWith('.mp4')) {
        ext = 'mp4';
        contentType = 'video/mp4';
      } else if (lowerName.endsWith('.m4a')) {
        ext = 'm4a';
        contentType = 'audio/mp4';
      } else if (lowerName.endsWith('.wav')) {
        ext = 'wav';
        contentType = 'audio/wav';
      } else if (lowerName.endsWith('.ogg')) {
        ext = 'ogg';
        contentType = 'audio/ogg';
      } else if (lowerName.endsWith('.flac')) {
        ext = 'flac';
        contentType = 'audio/flac';
      }

      console.log(`🔍 Inspecting audio metadata & ID3 tags for "${cleanFileName}"...`);
      const meta = await extractMetadataFromBuffer(fileBuffer, cleanFileName, contentType);

      const title = parseArg('--title') || meta.title;
      const artist = parseArg('--artist') || meta.artist;
      const category = parseArg('--category') || meta.category;
      const tool = (parseArg('--tool') || 'Suno') as 'Suno' | 'Udio' | 'Stable Audio' | 'Other';
      const description = parseArg('--description') || meta.description;
      const lyrics = parseArg('--lyrics') || meta.lyrics;

      console.log(`\n🎵 Track Metadata Extracted:`);
      console.log(`• Title:       "${title}"`);
      console.log(`• Artist:      "${artist}"`);
      console.log(`• Category:    "${category}"`);
      console.log(`• Tool Used:   "${tool}"`);
      if (description) console.log(`• Prompt/Desc: "${description}"`);
      if (lyrics) console.log(`• Lyrics:      "${lyrics.slice(0, 60)}..."`);
      console.log(`• Cover Icon:  ${meta.hasCoverArt ? 'Embedded Picture Found (Saved)' : 'PromptFM Default Brand Icon'}`);

      console.log(`\n📤 Uploading "${cleanFileName}" (${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB, ${contentType}) to Cloudflare R2...`);

      const key = `tracks/admin/${randomUUID()}.${ext}`;
      const s3 = getR2Client();

      await s3.send(
        new PutObjectCommand({
          Bucket: getBucketName(),
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
        })
      );

      const publicUrl = getPublicUrl(key);
      console.log(`✅ Stored on R2: ${publicUrl}`);

      console.log(`💾 Adding to Supabase as an APPROVED rotation track...`);
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('tracks')
        .insert({
          title,
          artist_name: artist,
          category,
          tool_used: tool,
          audio_url: publicUrl,
          description: description || null,
          lyrics: lyrics || null,
          cover_art_url: meta.hasCoverArt ? meta.coverArtUrl : DEFAULT_TRACK_ICON,
          status: 'approved',
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving track to database:', error.message);
        process.exit(1);
      }

      console.log(`\n🎉 Track is LIVE on PromptFM!`);
      console.log(`• ID: ${data.id}`);
      console.log(`• Title: "${data.title}" by ${data.artist_name}`);
      console.log(`• Tool: ${data.tool_used}`);
      break;
    }

    case 'queue': {
      const sub = args[1];
      const supabase = createAdminClient();

      if (sub === 'list') {
        const { data: qData, error } = await supabase
          .from('channel_queue')
          .select('id, track_id, prompt_used, requested_by, created_at, track:tracks(title, artist_name, tool_used)')
          .is('played_at', null)
          .order('created_at', { ascending: true })
          .limit(15);

        if (error) {
          console.error('Error fetching queue:', error.message);
          return;
        }

        console.log(`\n🎵 PromptFM Active "Up Next" Queue (${qData?.length || 0} upcoming):`);
        if (!qData || qData.length === 0) {
          console.log('• Queue is empty. Looping community top chart tracks.');
        } else {
          qData.forEach((item, index) => {
            const tr = (item as unknown as { track: { title: string; artist_name: string; tool_used: string } }).track;
            console.log(
              `  #${index + 1} [Queue ID: ${item.id}] "${tr?.title || 'Unknown'}" by ${tr?.artist_name || 'N/A'} (Requested by: ${item.requested_by}${
                item.prompt_used ? ` - "${item.prompt_used}"` : ''
              })`
            );
          });
        }
        return;
      }

      if (sub === 'remove') {
        const queueId = args[2];
        if (!queueId) {
          console.error('Provide queue ID: npm run promptfm queue remove <queueId>');
          return;
        }
        const { error } = await supabase.from('channel_queue').delete().eq('id', queueId);
        if (error) {
          console.error('Failed to remove:', error.message);
        } else {
          console.log(`✅ Removed queue item ${queueId}.`);
        }
        return;
      }

      if (sub === 'next') {
        const trackId = args[2];
        if (!trackId) {
          console.error('Provide track ID: npm run promptfm queue next <trackId>');
          return;
        }

        // Fetch main channel
        const { data: channel } = await supabase.from('channels').select('id').eq('slug', 'main').single();
        if (!channel) {
          console.error('Main channel not found.');
          return;
        }

        // Insert at the front with an earlier timestamp
        const { error } = await supabase.from('channel_queue').insert({
          channel_id: channel.id,
          track_id: trackId,
          requested_by: 'Station Admin',
          created_at: new Date(Date.now() - 3600000).toISOString(), // Prioritized to front
        });

        if (error) {
          console.error('Failed to bump track:', error.message);
        } else {
          console.log(`⚡ Bumped track ${trackId} to play NEXT!`);
        }
        return;
      }

      // Default: prompt-search
      const query = args.slice(1).join(' ');
      if (!query) {
        console.error('Provide search prompt: npm run promptfm queue "cyberpunk"');
        return;
      }

      console.log(`🔎 Searching approved tracks matching: "${query}"...`);
      const { data: tracks } = await supabase
        .from('tracks')
        .select('id, title, artist_name, tool_used')
        .eq('status', 'approved')
        .ilike('title', `%${query}%`)
        .limit(1);

      const selected = tracks?.[0];
      if (selected) {
        const { data: channel } = await supabase.from('channels').select('id').eq('slug', 'main').single();
        if (channel) {
          await supabase.from('channel_queue').insert({
            channel_id: channel.id,
            track_id: selected.id,
            prompt_used: query,
            requested_by: 'Terminal Listener',
          });
          console.log(`✅ Queued for airplay: "${selected.title}" by ${selected.artist_name} (${selected.tool_used})`);
        }
      } else {
        console.log(`No matching track found for "${query}".`);
      }
      break;
    }

    case 'djs': {
      const djs = getAllDJs();
      const active = getActiveDJ();
      console.log('\n🎙️  PromptFM AI DJ Roster & Schedule Shifts:');
      console.log('------------------------------------------------');
      djs.forEach((dj) => {
        const isLive = dj.id === active.id;
        const liveBadge = isLive ? '🔴 LIVE ON AIR NOW' : '⚪ Off Air';
        console.log(`\n• ${dj.name} [${dj.id}] — ${liveBadge}`);
        console.log(`  Title:   ${dj.title}`);
        console.log(`  Voice:   ${dj.voice.name} (${dj.voice.ssmlGender}) | Rate: ${dj.voice.speakingRate ?? 1.0} | Pitch: ${dj.voice.pitch ?? 0.0}`);
        console.log(`  Shifts:  ${dj.shifts.length > 0 ? dj.shifts.join(', ') : 'Special Events / Custom Channel'}`);
        console.log(`  Persona: ${dj.stylePrompt}`);
        console.log(`  Bio:     ${dj.bio}`);
      });
      break;
    }

    case 'ads': {
      const sub = args[1];
      const config = getAdsConfig();

      if (sub === 'inject') {
        const adId = args[2];
        const spot = adId ? config.spots.find((s) => s.id === adId) : getActiveAdSpot();
        if (!spot) {
          console.error('No matching sponsor spot found.');
          return;
        }
        const requestedDj = parseArg('--dj');
        const activeDJ = requestedDj ? getDJById(requestedDj) : getActiveDJ();

        console.log(`🎙️  Injecting sponsor spot "${spot.title}" (${spot.sponsor}) with ${activeDJ.name}...`);
        let audioUrl = spot.audioUrl || '';
        let script = spot.copy || '';
        if (spot.type === 'ai_read' || !audioUrl) {
          const drop = await createBroadcastDrop({
            type: 'ad',
            topicOrText: spot.copy || spot.title,
            dj: activeDJ,
          });
          audioUrl = drop.audioUrl;
          script = drop.script;
        }
        const supabase = createAdminClient();
        const { data: track } = await supabase
          .from('tracks')
          .insert({
            title: `[Sponsor Ad] ${spot.title}`,
            artist_name: `${activeDJ.name} for ${spot.sponsor}`,
            tool_used: 'Other',
            audio_url: audioUrl,
            status: 'approved',
          })
          .select()
          .single();

        if (track) {
          const { data: channel } = await supabase.from('channels').select('id').eq('slug', 'main').single();
          if (channel) {
            await supabase.from('channel_queue').insert({
              channel_id: channel.id,
              track_id: track.id,
              requested_by: 'CLI (Ad Inject)',
              created_at: new Date(Date.now() - 3600000).toISOString(),
            });
            console.log(`⚡ Injected sponsor ad! Will play NEXT on air.`);
            if (script) console.log(`✨ Script Spoken: "${script}"`);
          }
        }
        return;
      }

      // Default: ads list
      console.log(`\n📢 PromptFM Sponsor & Audio Ad Configuration:`);
      console.log(`------------------------------------------------`);
      console.log(`Enabled:   ${config.enabled ? 'Yes' : 'No'}`);
      console.log(`Cadence:   Every ${config.frequencyTracks} music tracks`);
      console.log(`Clock:     At minutes :${config.clockMinutes.join(', :')} past the hour`);
      console.log(`\nConfigured Spots (${config.spots.length}):`);
      config.spots.forEach((s) => {
        console.log(`\n• [${s.id}] "${s.title}" — ${s.sponsor}`);
        console.log(`  Type: ${s.type} | Duration: ${s.durationSeconds}s | Weight: ${s.weight} | Active: ${s.active}`);
        if (s.copy) console.log(`  AI Read Copy: "${s.copy}"`);
        if (s.audioUrl) console.log(`  Audio URL: ${s.audioUrl}`);
      });
      break;
    }

    case 'weather': {
      const requestedDj = parseArg('--dj');
      const dj = requestedDj ? getDJById(requestedDj) : getActiveDJ();
      const cityArgs = args.slice(1).filter((a, i, arr) => a !== '--dj' && arr[i - 1] !== '--dj');
      const city = cityArgs.join(' ');

      console.log(`🌤️  Fetching live weather conditions${city ? ` for ${city}` : ' from schedule.yaml'}...`);
      const weather = await fetchLiveWeatherSummary(city || undefined);
      console.log(`📍 City: ${weather.city} -> "${weather.text}"`);

      console.log(`🎙️  Prompting Gemini & synthesizing with ${dj.name} (${dj.voice.name})...`);
      const { script, audioUrl } = await createBroadcastDrop({
        type: 'custom_prompt',
        topicOrText: `Give a 15-second radio station weather check for our listeners in ${weather.city}: "${weather.text}". Add upbeat radio vibes.`,
        dj,
      });
      console.log(`\n✨ Spoken Script (${dj.name}):\n"${script}"\n`);
      console.log(`🔗 Audio URL: ${audioUrl}`);
      break;
    }

    case 'inject': {
      const type = (args[1] || 'announcement') as 'news' | 'weather' | 'announcement';
      const requestedDj = parseArg('--dj');
      const dj = requestedDj ? getDJById(requestedDj) : getActiveDJ();
      const textArgs = args.slice(2).filter((a, i, arr) => a !== '--dj' && arr[i - 1] !== '--dj');
      const text = textArgs.join(' ') || 'Station special announcement';

      console.log(`💉 Force-injecting [${type.toUpperCase()}] into the live airplay queue with ${dj.name}...`);

      let promptText = text;
      if (type === 'weather') {
        const weather = await fetchLiveWeatherSummary(text !== 'Station special announcement' ? text : undefined);
        promptText = `Give a 15-second radio station weather check for ${weather.city}: "${weather.text}".`;
      }

      const { script, audioUrl } = await createBroadcastDrop({
        type: type === 'weather' ? 'custom_prompt' : type,
        topicOrText: promptText,
        dj,
      });

      const supabase = createAdminClient();
      const { data: track } = await supabase
        .from('tracks')
        .insert({
          title: `Injected: ${type.toUpperCase()}`,
          artist_name: `${dj.name} (Live Priority)`,
          tool_used: 'Other',
          audio_url: audioUrl,
          status: 'approved',
        })
        .select()
        .single();

      if (track) {
        const { data: channel } = await supabase.from('channels').select('id').eq('slug', 'main').single();
        if (channel) {
          await supabase.from('channel_queue').insert({
            channel_id: channel.id,
            track_id: track.id,
            requested_by: 'Admin CLI (Priority Inject)',
            created_at: new Date(Date.now() - 3600000).toISOString(), // Placed at very front
          });
          console.log(`⚡ Successfully injected! "${script}" by ${dj.name} will play NEXT.`);
        }
      }
      break;
    }

    case 'dj': {
      const requestedDj = parseArg('--dj');
      const dj = requestedDj ? getDJById(requestedDj) : getActiveDJ();
      const promptArgs = args.slice(1).filter((a, i, arr) => a !== '--dj' && arr[i - 1] !== '--dj');
      const userPrompt = promptArgs.join(' ');

      if (!userPrompt) {
        console.error('Error: Please provide a prompt for Gemini.');
        process.exit(1);
      }
      console.log(`🤖 Prompting Gemini with ${dj.name}: "${userPrompt}"...`);
      console.log(`🎙️  Synthesizing radio voice via ${dj.voice.name}...`);
      const { script, audioUrl } = await createBroadcastDrop({
        type: 'custom_prompt',
        topicOrText: userPrompt,
        dj,
      });
      console.log(`\n✨ Spoken Monologue (${dj.name}):\n"${script}"\n`);
      console.log(`🔗 Audio Drop URL: ${audioUrl}`);
      break;
    }

    case 'news': {
      const isLive = args.includes('--live');
      const requestedDj = parseArg('--dj');
      const dj = requestedDj ? getDJById(requestedDj) : getActiveDJ();
      const filteredArgs = args.slice(1).filter((a, i, arr) => a !== '--live' && a !== '--dj' && arr[i - 1] !== '--dj');
      const topic = filteredArgs.join(' ') || 'Latest AI music releases and generative audio updates';

      let headlines: string[] = [];
      if (isLive || filteredArgs.length === 0) {
        console.log(`🌐 Scraping live RSS headlines (Hacker News, Google News AI)...`);
        headlines = await fetchLiveHeadlines();
        console.log(`📰 Found ${headlines.length} fresh headlines:\n` + headlines.map((h, i) => `   ${i + 1}. ${h}`).join('\n'));
      }

      console.log(`\n🤖 Prompting Gemini with ${dj.name} on topic: "${topic}"...`);
      const { script, audioUrl } = await createBroadcastDrop({
        type: 'news',
        headlines,
        topicOrText: topic,
        dj,
      });
      console.log(`\n🎙️  Broadcast News Script (${dj.name}):\n"${script}"\n`);
      console.log(`🔗 Audio Broadcast URL: ${audioUrl}`);
      break;
    }

    case 'announce': {
      const requestedDj = parseArg('--dj');
      const dj = requestedDj ? getDJById(requestedDj) : getActiveDJ();
      const textArgs = args.slice(1).filter((a, i, arr) => a !== '--dj' && arr[i - 1] !== '--dj');
      const text = textArgs.join(' ');
      if (!text) {
        console.error('Error: Please provide announcement text.');
        process.exit(1);
      }
      console.log(`🎙️  Generating announcement with ${dj.name} for: "${text}"...`);
      const { script, audioUrl } = await createBroadcastDrop({
        type: 'announcement',
        topicOrText: text,
        dj,
      });
      console.log(`\n✨ Spoken Script (${dj.name}):\n"${script}"\n`);
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

      if (sub === 'list' || sub === 'approved') {
        const { data: allTracks, error } = await supabase
          .from('tracks')
          .select('id, title, artist_name, tool_used, status, upvotes_count')
          .order('upvotes_count', { ascending: false });

        if (error) {
          console.error('Error fetching tracks:', error);
          return;
        }

        console.log(`\n🎵 PromptFM Tracks in Database (${allTracks?.length || 0}):`);
        allTracks?.forEach((t, i) => {
          console.log(`${i + 1}. [${t.id}] "${t.title}" by ${t.artist_name} | status: ${t.status} | votes: ${t.upvotes_count}`);
        });
        return;
      }

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

    case 'report': {
      const sub = args[1]; // 'list' | 'file'
      if (sub === 'list') {
        const reports = await getRecentReports(20);
        console.log(`\n🛡️ PromptFM Community Content Reports (${reports.length}):`);
        if (reports.length === 0) {
          console.log('No reports pending. Broadcast stream is clean.');
        } else {
          reports.forEach((r) => {
            console.log(`• [${r.id}] [${r.target_type}] target="${r.target_id}" reason="${r.reason}" status="${r.status}" via ${r.reporter_platform} ${r.details ? `("${r.details}")` : ''}`);
          });
        }
        return;
      }

      if (sub === 'file') {
        const targetId = args[2];
        const reason = (args[3] || 'copyright_dmca') as ReportReason;
        const details = args.slice(4).join(' ') || 'Filed via PromptFM CLI';

        if (!targetId) {
          console.error('Usage: npm run promptfm -- report file <targetId> [reason] [details]');
          return;
        }

        const res = await submitContentReport({
          target_type: 'track',
          target_id: targetId,
          reason,
          details,
          reporter_platform: 'web',
          reporter_id: 'CLI Operator',
        });
        console.log(`✅ Report submitted! Ticket ID: ${res.reportId}`);
        console.log(`   Target: ${targetId} | Reason: ${reason}`);
        return;
      }

      if (sub === 'resolve' || sub === 'action') {
        const reportId = args[2];
        const action = (parseArg('--action') || 'actioned') as 'actioned' | 'dismissed';
        const notes = parseArg('--notes') || 'Resolved via PromptFM Admin CLI';

        if (!reportId) {
          console.error('Usage: npm run promptfm -- report resolve <reportId> [--action actioned|dismissed] [--notes "explanation"]');
          return;
        }

        const res = await resolveContentReport(reportId, action, notes);
        console.log(`✅ Report ${res.reportId} marked as ${res.status.toUpperCase()}!`);
        if (res.notes) console.log(`   Notes: "${res.notes}"`);
        return;
      }

      console.log('Report commands: npm run promptfm -- report list | report file <id> [reason] [details] | report resolve <id> [--action actioned|dismissed]');
      break;
    }

    case 'channels': {
      const sub = args[1]; // 'list' | 'create'
      if (sub === 'list' || !sub) {
        const official = getAllChannels();
        let dbChannels: any[] = [];
        try {
          const supabase = createAdminClient();
          const { data, error } = await supabase.from('channels').select('*');
          if (data && data.length > 0) {
            dbChannels = data;
          }
        } catch {
          // DB optional in offline CLI
        }

        const channelMap = new Map<string, any>();
        for (const ch of official) {
          channelMap.set(ch.slug, {
            slug: ch.slug,
            name: ch.name,
            djId: ch.djId,
            djName: ch.djName,
            isFamilySafe: ch.isFamilySafe,
            requiresAgeGate: ch.requiresAgeGate ?? false,
            allowExplicit247: ch.allowExplicitAllDay ?? false,
            minAge: ch.minAge ?? 0,
            badge: ch.badge,
          });
        }
        for (const ch of dbChannels) {
          const existing = channelMap.get(ch.slug) || {};
          const isExplicitHint = Boolean(
            ch.allow_explicit_24_7 ||
            ch.requires_age_gate ||
            ch.name?.includes('18+') ||
            ch.description?.toLowerCase().includes('explicit') ||
            ch.description?.toLowerCase().includes('uncensored')
          );
          const guard = autoGenerateChannelGuardrails({ is18Plus: isExplicitHint });
          channelMap.set(ch.slug, {
            ...existing,
            ...ch,
            slug: ch.slug,
            name: ch.name || existing.name,
            djId: ch.dj_id || existing.djId,
            djName: (ch.dj_id ? getDJById(ch.dj_id)?.name : null) || existing.djName || 'AI Host',
            isFamilySafe: ch.is_family_safe ?? existing.isFamilySafe ?? guard.is_family_safe,
            requiresAgeGate: ch.requires_age_gate ?? existing.requiresAgeGate ?? guard.requires_age_gate,
            allowExplicit247: ch.allow_explicit_24_7 ?? existing.allowExplicit247 ?? guard.allow_explicit_24_7,
            minAge: ch.min_age ?? existing.minAge ?? guard.min_age,
            badge: ch.badge || existing.badge || (guard.allow_explicit_24_7 ? '🔞 18+ Explicit' : '📻 Channel'),
          });
        }

        console.log(`\n📻 PromptFM Broadcast Channels (${channelMap.size}):`);
        console.log(`--------------------------------------------------------------------------------`);
        for (const ch of channelMap.values()) {
          const rating = ch.requiresAgeGate
            ? '🔞 18+ EXPLICIT (Age Gate Required 24/7)'
            : ch.isFamilySafe
            ? '✅ FAMILY SAFE (All Ages)'
            : '⚡ 16+ STANDARD';
          console.log(`• [${ch.slug.padEnd(12)}] "${ch.name}" | Host: ${ch.djName || ch.djId} | ${rating}`);
        }
        return;
      }

      if (sub === 'create') {
        const slug = args[2]?.toLowerCase().trim();
        const name = args[3]?.trim();
        const is18Plus = args.includes('--18plus');
        const djId = parseArg('--dj') || 'dj_neon';
        const desc = parseArg('--desc') || '';

        if (!slug || !name) {
          console.error('Usage: npm run promptfm -- channels create <slug> <name> [--18plus] [--dj <djId>] [--desc "Description"]');
          return;
        }

        const guardrails = autoGenerateChannelGuardrails({
          is18Plus,
          allowExplicit247: is18Plus,
        });

        const newChannel = {
          slug,
          name,
          short_name: name,
          description: desc,
          vibe: desc || (guardrails.allow_explicit_24_7 ? '18+ Explicit Underground' : 'AI Generated Radio'),
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
        };

        const dbPayload = {
          slug,
          name,
          description: desc,
          is_family_safe: guardrails.is_family_safe,
          min_age: guardrails.min_age,
          requires_age_gate: guardrails.requires_age_gate,
          allow_explicit_24_7: guardrails.allow_explicit_24_7,
          age_gate_disclaimer: guardrails.age_gate_disclaimer,
        };

        try {
          const supabase = createAdminClient();
          const { error } = await supabase.from('channels').upsert(dbPayload, { onConflict: 'slug' });
          if (error) {
            // Fallback to base columns if migration columns are not yet cached
            const { error: fallbackError } = await supabase.from('channels').upsert(
              { slug, name, description: desc },
              { onConflict: 'slug' }
            );
            if (fallbackError) {
              console.error('Database Error:', fallbackError.message);
            } else {
              console.log(`✅ Channel "${name}" (${slug}) created in database with automated guardrails:`);
              console.log(`   - 18+ Explicit 24/7:   ${guardrails.allow_explicit_24_7}`);
              console.log(`   - Age Gate Required:   ${guardrails.requires_age_gate}`);
              console.log(`   - Minimum Age:         ${guardrails.min_age}`);
              console.log(`   - Family Safe:         ${guardrails.is_family_safe}`);
              console.log(`   - Host DJ:             ${djId}`);
              if (guardrails.age_gate_disclaimer) {
                console.log(`   - Legal Disclaimer:    "${guardrails.age_gate_disclaimer.slice(0, 80)}..."`);
              }
            }
          } else {
            console.log(`✅ Channel "${name}" (${slug}) created successfully with automated guardrails:`);
            console.log(`   - 18+ Explicit 24/7:   ${guardrails.allow_explicit_24_7}`);
            console.log(`   - Age Gate Required:   ${guardrails.requires_age_gate}`);
            console.log(`   - Minimum Age:         ${guardrails.min_age}`);
            console.log(`   - Family Safe:         ${guardrails.is_family_safe}`);
            console.log(`   - Host DJ:             ${djId}`);
            if (guardrails.age_gate_disclaimer) {
              console.log(`   - Legal Disclaimer:    "${guardrails.age_gate_disclaimer.slice(0, 80)}..."`);
            }
          }
        } catch (err: any) {
          console.log(`Channel provisioned locally (DB error/offline: ${err?.message || err})`);
        }
        return;
      }

      console.log('Channels subcommands: npm run promptfm -- channels list | channels create <slug> <name> [--18plus]');
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
