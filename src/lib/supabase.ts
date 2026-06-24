import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'public' },
  auth: { autoRefreshToken: true, persistSession: false },
  global: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }
});

export const getAudioUrl = (spotifyTrackId: string) =>
  `${supabaseUrl}/storage/v1/object/public/audio_preview/${spotifyTrackId}.mp3`;

export const getAlbumImageUrl = (spotifyTrackId: string) =>
  `${supabaseUrl}/storage/v1/object/public/album_image/${spotifyTrackId}.jpg`;
