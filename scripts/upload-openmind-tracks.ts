// scripts/upload-openmind-tracks.ts
// Uploads OpenMindAudio tracks from Downloads to Supabase Storage,
// registers them as approved in the tracks table, and indexes pgvector embeddings.

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import fs from 'fs';
import path from 'path';
import { createAdminClient } from '../src/lib/supabase/server';
import { indexTrackEmbedding } from '../src/lib/dj/rag';

interface OpenMindSongConfig {
  localPath: string;
  storageFileName: string;
  title: string;
  artist: string;
  category: string;
  toolUsed: 'Suno' | 'Udio' | 'Stable Audio' | 'Other';
  description: string;
  upvotes: number;
}

const songs: OpenMindSongConfig[] = [
  {
    localPath: '/Users/trifan/Downloads/openmindaudio-psychedelic-rock-music-scarlet-haze-580078.mp3',
    storageFileName: 'openmindaudio-scarlet-haze.mp3',
    title: 'Scarlet Haze',
    artist: 'OpenMindAudio',
    category: 'Cyberpunk & Dark Synth',
    toolUsed: 'Other',
    description: 'Psychedelic rock journey featuring hypnotic fuzz guitars and vintage analog grooves.',
    upvotes: 27,
  },
  {
    localPath: '/Users/trifan/Downloads/openmindaudio-desert-psychedelic-rock-music-desert-mirage-580053.mp3',
    storageFileName: 'openmindaudio-desert-mirage.mp3',
    title: 'Desert Mirage',
    artist: 'OpenMindAudio',
    category: 'Chillout & Ambient',
    toolUsed: 'Other',
    description: 'Desert psychedelic rock with expansive desert atmosphere, twangy leads, and cosmic rhythms.',
    upvotes: 25,
  },
  {
    localPath: '/Users/trifan/Downloads/openmindaudio-retro-psychedelic-blues-rock-serpent-voice-580077.mp3',
    storageFileName: 'openmindaudio-serpent-voice.mp3',
    title: 'Serpent Voice',
    artist: 'OpenMindAudio',
    category: 'Cyberpunk & Dark Synth',
    toolUsed: 'Other',
    description: 'Retro psychedelic blues rock packed with gritty overdrive, blues licks, and hypnotic pulse.',
    upvotes: 22,
  },
];

async function main() {
  console.log('🚀 Starting OpenMindAudio tracks upload to PromptFM...\n');
  const supabase = createAdminClient();

  for (const song of songs) {
    console.log(`🎵 Processing "${song.title}" by ${song.artist}...`);

    if (!fs.existsSync(song.localPath)) {
      console.error(`❌ Local file not found: ${song.localPath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(song.localPath);
    const fileSizeMb = (fileBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`   File size: ${fileSizeMb} MB`);

    // 1. Upload to Supabase Storage
    console.log(`   📤 Uploading to Supabase bucket "tracks/${song.storageFileName}"...`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tracks')
      .upload(song.storageFileName, fileBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.warn(`   ⚠️ Supabase storage upload note: ${uploadError.message}`);
    } else {
      console.log(`   ✅ Supabase storage upload succeeded:`, uploadData.path);
    }

    const { data: urlData } = supabase.storage.from('tracks').getPublicUrl(song.storageFileName);
    const publicAudioUrl =
      urlData?.publicUrl ||
      `https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/${song.storageFileName}`;
    console.log(`   🔗 Public Audio URL: ${publicAudioUrl}`);

    // 2. Check if track already exists by title and artist
    const { data: existingTrack } = await supabase
      .from('tracks')
      .select('id, title')
      .eq('title', song.title)
      .eq('artist_name', song.artist)
      .maybeSingle();

    let trackId: string;

    if (existingTrack) {
      trackId = existingTrack.id;
      console.log(`   ♻️ Track already exists in database (ID: ${trackId}). Updating record...`);
      const { error: updateError } = await supabase
        .from('tracks')
        .update({
          audio_url: publicAudioUrl,
          category: song.category,
          tool_used: song.toolUsed,
          description: song.description,
          status: 'approved',
          family_friendly: true,
          is_explicit: false,
          cover_art_url: '/logo-mark.png',
        })
        .eq('id', trackId);

      if (updateError) {
        console.error(`   ❌ Failed to update track: ${updateError.message}`);
        continue;
      }
    } else {
      console.log(`   💾 Inserting new track record into "tracks" table...`);
      const { data: insertedTrack, error: insertError } = await supabase
        .from('tracks')
        .insert({
          title: song.title,
          artist_name: song.artist,
          category: song.category,
          tool_used: song.toolUsed,
          description: song.description,
          audio_url: publicAudioUrl,
          cover_art_url: '/logo-mark.png',
          status: 'approved',
          family_friendly: true,
          is_explicit: false,
          upvotes_count: song.upvotes,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`   ❌ Failed to insert track: ${insertError.message}`);
        continue;
      }

      trackId = insertedTrack.id;
      console.log(`   ✅ Track registered successfully with ID: ${trackId}`);
    }

    // 3. Index pgvector embedding for semantic vibe search
    console.log(`   🧠 Generating 768-dim pgvector embedding...`);
    try {
      const indexResult = await indexTrackEmbedding(trackId, {
        title: song.title,
        artist_name: song.artist,
        category: song.category,
        description: song.description,
      });
      if (indexResult.success) {
        console.log(`   ✨ pgvector embedding successfully stored!`);
      } else {
        console.log(`   ℹ️ Embedding indexing note: ${indexResult.error}`);
      }
    } catch (embErr) {
      console.warn(`   ⚠️ Embedding indexing skipped: ${embErr}`);
    }

    console.log(`   🎉 "${song.title}" is now active in rotation!\n`);
  }

  // Summary
  const { data: allTracks } = await supabase
    .from('tracks')
    .select('id, title, artist_name, upvotes_count, category, status')
    .order('upvotes_count', { ascending: false });

  console.log('📻 CURRENT ACTIVE ROTATION LIBRARY:');
  console.table(allTracks);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

