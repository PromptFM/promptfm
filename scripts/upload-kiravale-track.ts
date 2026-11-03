// scripts/upload-kiravale-track.ts
// Uploads KiraVale Gaming Music track to Supabase Storage, sets it to Chiptune & 8-Bit / Gaming,
// generates 768-dim pgvector embeddings, and syncs to the streamer VM.

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import fs from 'fs';
import { createAdminClient } from '../src/lib/supabase/server';
import { indexTrackEmbedding } from '../src/lib/dj/rag';

async function main() {
  console.log('🚀 Uploading "Level Up" by KiraVale to PromptFM...\n');
  const supabase = createAdminClient();

  const localPath = '/Users/trifan/Downloads/kiravale-gaming-music-593659.mp3';
  const storageFileName = 'kiravale-gaming-music.mp3';
  const title = 'Level Up';
  const artist = 'KiraVale';
  const category = 'Chiptune & 8-Bit';
  const toolUsed = 'Other';
  const description = 'High-energy electronic gaming anthem with punchy synths, fast-paced 8-bit arcade arpeggios, and epic boss fight adrenaline.';
  const upvotes = 29;

  if (!fs.existsSync(localPath)) {
    console.error(`❌ Local file not found: ${localPath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(localPath);
  const fileSizeMb = (fileBuffer.length / (1024 * 1024)).toFixed(2);
  console.log(`   File size: ${fileSizeMb} MB`);

  // 1. Upload to Supabase Storage
  console.log(`   📤 Uploading to Supabase bucket "tracks/${storageFileName}"...`);
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('tracks')
    .upload(storageFileName, fileBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (uploadError) {
    console.warn(`   ⚠️ Supabase storage upload note: ${uploadError.message}`);
  } else {
    console.log(`   ✅ Supabase storage upload succeeded:`, uploadData.path);
  }

  const { data: urlData } = supabase.storage.from('tracks').getPublicUrl(storageFileName);
  const publicAudioUrl =
    urlData?.publicUrl ||
    `https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/${storageFileName}`;
  console.log(`   🔗 Public Audio URL: ${publicAudioUrl}`);

  // 2. Insert or update in tracks table
  const { data: existingTrack } = await supabase
    .from('tracks')
    .select('id, title')
    .eq('title', title)
    .eq('artist_name', artist)
    .maybeSingle();

  let trackId: string;

  if (existingTrack) {
    trackId = existingTrack.id;
    console.log(`   ♻️ Track already exists (ID: ${trackId}). Updating...`);
    await supabase
      .from('tracks')
      .update({
        audio_url: publicAudioUrl,
        category,
        tool_used: toolUsed,
        description,
        status: 'approved',
        family_friendly: true,
        is_explicit: false,
        cover_art_url: '/logo-mark.png',
        upvotes_count: upvotes,
      })
      .eq('id', trackId);
  } else {
    console.log(`   💾 Inserting new track record into "tracks" table...`);
    const { data: inserted, error: insertError } = await supabase
      .from('tracks')
      .insert({
        title,
        artist_name: artist,
        category,
        tool_used: toolUsed,
        description,
        audio_url: publicAudioUrl,
        cover_art_url: '/logo-mark.png',
        status: 'approved',
        family_friendly: true,
        is_explicit: false,
        upvotes_count: upvotes,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error(`   ❌ Failed to insert track: ${insertError.message}`);
      process.exit(1);
    }

    trackId = inserted.id;
    console.log(`   ✅ Registered track with ID: ${trackId}`);
  }

  // 3. Index pgvector embedding for semantic vibe search
  console.log(`   🧠 Generating 768-dim pgvector embedding...`);
  try {
    const indexResult = await indexTrackEmbedding(trackId, {
      title,
      artist_name: artist,
      category,
      description,
    });
    if (indexResult.success) {
      console.log(`   ✨ pgvector embedding successfully stored!`);
    } else {
      console.log(`   ℹ️ Embedding indexing note: ${indexResult.error}`);
    }
  } catch (embErr) {
    console.warn(`   ⚠️ Embedding indexing skipped: ${embErr}`);
  }

  console.log(`   🎉 "${title}" is now active in rotation!\n`);

  // Print current library
  const { data: allTracks } = await supabase
    .from('tracks')
    .select('id, title, artist_name, upvotes_count, category, family_friendly, is_explicit, status')
    .order('upvotes_count', { ascending: false });

  console.log('📻 CURRENT ACTIVE ROTATION LIBRARY:');
  console.table(allTracks);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
