// scripts/upload-all-talk-tracks.ts
// Uploads All Talk No Spark (Power Mix and Lento Mix) by alextrifan to PromptFM,
// extracts embedded artwork and full lyrics, and syncs to the streaming server.

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import fs from 'fs';
import { createAdminClient } from '../src/lib/supabase/server';
import { extractMetadataFromBuffer } from '../src/lib/audio/metadata';
import { indexTrackEmbedding } from '../src/lib/dj/rag';

async function main() {
  console.log('🚀 Starting upload for "All Talk, No Spark" mixes by alextrifan...\n');
  const supabase = createAdminClient();

  const tracksToUpload = [
    {
      localPath: '/Users/trifan/Downloads/all-talk-no-spark-power.mp3',
      storageName: 'all-talk-no-spark-power.mp3',
      title: 'All Talk, No Spark (Power Mix)',
      artist: 'alextrifan',
      category: 'Synthwave & Electro',
      toolUsed: 'Suno' as const,
      description: 'Punchy synth-rock roast anthem with driving bass, biting lyrical flow, and unapologetic swagger.',
      upvotes: 31,
      mime: 'audio/mpeg',
    },
    {
      localPath: '/Users/trifan/Downloads/all-talk-no-spark-lento.m4a',
      storageName: 'all-talk-no-spark-lento.m4a',
      title: 'All Talk, No Spark (Lento Mix)',
      artist: 'alextrifan',
      category: 'Chillout & Ambient',
      toolUsed: 'Suno' as const,
      description: 'Downtempo melodic variation with atmospheric textures, chill grooves, and smooth vocal delivery.',
      upvotes: 27,
      mime: 'audio/mp4',
    },
  ];

  let sharedCoverArtUrl = '/logo-mark.png';

  for (const track of tracksToUpload) {
    console.log(`🎵 Processing "${track.title}"...`);

    if (!fs.existsSync(track.localPath)) {
      console.error(`❌ File not found: ${track.localPath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(track.localPath);
    console.log(`   Size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    const meta = await extractMetadataFromBuffer(fileBuffer, track.storageName, track.mime);

    // If power mix has cover art, extract and upload to Supabase storage
    if (meta.hasCoverArt && meta.coverArtUrl.startsWith('data:image/')) {
      console.log(`   🖼️ Embedded album artwork detected! Uploading to Supabase...`);
      const base64Data = meta.coverArtUrl.split(',')[1];
      if (base64Data) {
        const coverBuffer = Buffer.from(base64Data, 'base64');
        const coverFileName = 'all-talk-no-spark-cover.jpg';
        const { error: coverErr } = await supabase.storage
          .from('tracks')
          .upload(coverFileName, coverBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!coverErr) {
          const { data: cUrl } = supabase.storage.from('tracks').getPublicUrl(coverFileName);
          if (cUrl?.publicUrl) {
            sharedCoverArtUrl = cUrl.publicUrl;
            console.log(`   ✅ Cover art uploaded: ${sharedCoverArtUrl}`);
          }
        }
      }
    }

    // 1. Upload audio to Supabase Storage
    console.log(`   📤 Uploading audio to Supabase bucket "tracks/${track.storageName}"...`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tracks')
      .upload(track.storageName, fileBuffer, {
        contentType: track.mime,
        upsert: true,
      });

    if (uploadError) {
      console.warn(`   ⚠️ Supabase storage upload note: ${uploadError.message}`);
    } else {
      console.log(`   ✅ Supabase audio upload succeeded:`, uploadData.path);
    }

    const { data: urlData } = supabase.storage.from('tracks').getPublicUrl(track.storageName);
    const publicAudioUrl =
      urlData?.publicUrl ||
      `https://oxfacfdpxbxilucooijy.supabase.co/storage/v1/object/public/tracks/${track.storageName}`;
    console.log(`   🔗 Public Audio URL: ${publicAudioUrl}`);

    // 2. Insert or update in tracks table
    const { data: existingTrack } = await supabase
      .from('tracks')
      .select('id, title')
      .eq('title', track.title)
      .eq('artist_name', track.artist)
      .maybeSingle();

    let trackId: string;
    const lyricsToSave = meta.lyrics || null;

    if (existingTrack) {
      trackId = existingTrack.id;
      console.log(`   ♻️ Updating existing track record (ID: ${trackId})...`);
      await supabase
        .from('tracks')
        .update({
          audio_url: publicAudioUrl,
          category: track.category,
          tool_used: track.toolUsed,
          description: track.description,
          lyrics: lyricsToSave,
          cover_art_url: sharedCoverArtUrl,
          status: 'approved',
          family_friendly: true,
          is_explicit: false,
          upvotes_count: track.upvotes,
        })
        .eq('id', trackId);
    } else {
      console.log(`   💾 Inserting new track record into "tracks" table...`);
      const { data: inserted, error: insertError } = await supabase
        .from('tracks')
        .insert({
          title: track.title,
          artist_name: track.artist,
          category: track.category,
          tool_used: track.toolUsed,
          description: track.description,
          lyrics: lyricsToSave,
          audio_url: publicAudioUrl,
          cover_art_url: sharedCoverArtUrl,
          status: 'approved',
          family_friendly: true,
          is_explicit: false,
          upvotes_count: track.upvotes,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`   ❌ Failed to insert track: ${insertError.message}`);
        continue;
      }

      trackId = inserted.id;
      console.log(`   ✅ Registered track with ID: ${trackId}`);
    }

    // 3. Index pgvector embedding for semantic vibe search
    console.log(`   🧠 Generating 768-dim pgvector embedding...`);
    try {
      const indexResult = await indexTrackEmbedding(trackId, {
        title: track.title,
        artist_name: track.artist,
        category: track.category,
        description: track.description,
        lyrics: lyricsToSave || undefined,
      });
      if (indexResult.success) {
        console.log(`   ✨ pgvector embedding successfully stored!`);
      } else {
        console.log(`   ℹ️ Embedding indexing note: ${indexResult.error}`);
      }
    } catch (embErr) {
      console.warn(`   ⚠️ Embedding indexing skipped: ${embErr}`);
    }

    console.log(`   🎉 "${track.title}" is now active in rotation!\n`);
  }

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
