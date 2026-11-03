// scripts/add-anthem-track.ts
// Uploads the PromptFM Ambient AI Anthem to Supabase storage and adds it to the active playlist

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import fs from 'fs';
import path from 'path';
import { createAdminClient } from '../src/lib/supabase/server';
import { indexTrackEmbedding } from '../src/lib/dj/rag';

async function main() {
  console.log('🎵 Adding "PromptFM Ambient AI Anthem" to the permanent playlist...');

  const filePath = '/tmp/promptfm_ambient_ai_anthem.mp3';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const supabase = createAdminClient();

  // 1. Upload to Supabase Storage in 'tracks' bucket
  const storagePath = 'promptfm_ambient_ai_anthem.mp3';
  console.log(`📤 Uploading to Supabase Storage bucket "tracks/${storagePath}"...`);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('tracks')
    .upload(storagePath, fileBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (uploadError) {
    console.warn('Supabase storage upload note:', uploadError.message);
  } else {
    console.log('✅ Uploaded successfully:', uploadData);
  }

  const { data: urlData } = supabase.storage.from('tracks').getPublicUrl(storagePath);
  const publicAudioUrl = urlData?.publicUrl || 'https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/promptfm_ambient_ai_anthem.mp3';
  console.log('🔗 Public Audio URL:', publicAudioUrl);

  // 2. Insert or update in tracks table
  const trackData = {
    title: 'PromptFM Ambient AI Anthem',
    artist_name: 'PromptFM Core',
    category: 'Ambient & Lo-Fi',
    tool_used: 'Stable Audio',
    description: 'The official PromptFM ambient station anthem and signature melodic soundscape.',
    audio_url: publicAudioUrl,
    cover_art_url: '/logo-mark.png',
    status: 'approved',
    family_friendly: true,
    is_explicit: false,
    upvotes_count: 20,
  };

  const { data: existingTrack } = await supabase
    .from('tracks')
    .select('id, title')
    .eq('title', trackData.title)
    .maybeSingle();

  let trackId: string;

  if (existingTrack) {
    console.log(`Track already exists (ID: ${existingTrack.id}), updating...`);
    const { data: updated, error: updateError } = await supabase
      .from('tracks')
      .update(trackData)
      .eq('id', existingTrack.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update track:', updateError.message);
      process.exit(1);
    }
    trackId = updated.id;
  } else {
    console.log('Inserting new track into database...');
    const { data: inserted, error: insertError } = await supabase
      .from('tracks')
      .insert(trackData)
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert track:', insertError.message);
      process.exit(1);
    }
    trackId = inserted.id;
  }

  console.log(`✅ Track saved in database with ID: ${trackId}`);

  // 3. Generate pgvector embedding for semantic search
  console.log('🤖 Indexing pgvector embedding for semantic RAG vibe search...');
  const indexRes = await indexTrackEmbedding(trackId, {
    title: trackData.title,
    artist_name: trackData.artist_name,
    category: trackData.category,
    tool_used: trackData.tool_used,
    description: trackData.description,
  });

  if (indexRes.success) {
    console.log('✅ pgvector embedding successfully stored!');
  } else {
    console.warn('Embedding note:', indexRes.error);
  }

  console.log('\n🎉 "PromptFM Ambient AI Anthem" is now an official approved track on PromptFM!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
