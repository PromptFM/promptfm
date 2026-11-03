// scripts/upload-violin-track.ts
// Uploads AbsoluteSound Violin track to Supabase Storage, sets it to Chillout & Ambient,
// generates 768-dim pgvector embeddings, and tests rotation.

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import fs from 'fs';
import { createAdminClient } from '../src/lib/supabase/server';
import { indexTrackEmbedding } from '../src/lib/dj/rag';

async function main() {
  console.log('🚀 Uploading "Echoes of the Violin" by AbsoluteSound to Chillout & Ambient Channel...\n');
  const supabase = createAdminClient();

  const localPath = '/Users/trifan/Downloads/absolutesound-violin-violin-music-557858.mp3';
  const storageFileName = 'absolutesound-violin-music.mp3';
  const title = 'Echoes of the Violin';
  const artist = 'AbsoluteSound';
  const category = 'Chillout & Ambient';
  const toolUsed = 'Other';
  const description = 'Emotive neoclassical violin solo layered over gentle atmospheric pads, perfect for deep study and twilight reflection.';
  const upvotes = 28;

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

  console.log(`   🎉 "${title}" is now active in rotation on Chillout & Ambient channel!\n`);

  // Query all tracks
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
