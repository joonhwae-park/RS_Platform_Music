export interface Song {
  spotify_track_id: string;
  song: string;
  artist: string;
  album_name: string;
  is_attention_check: boolean;
  audioUrl: string;
  imageUrl: string;
}

export interface Rating {
  trackId: string;
  rating: number; // 1 = like, 0 = dislike, -1 = unrated
  diversity?: number; // 1 = yes, 0 = no, -1 = unanswered
  novelty?: number;
  serendipity?: number;
  listenedDuration?: number;
}

export interface QuestionnaireData {
  gender?: string;
  ageRange?: string;
  musicListeningFrequency: string;
  musicGenrePreference: string;
  musicExpertise: string;
  attentionCheck: string;
  diversityAttitude: string;
  diversityAttitude2: string;
  noveltyAttitude: string;
  noveltyAttitude2: string;
  serendipityAttitude: string;
  serendipityAttitude2: string;
  additionalComments?: string;
  email?: string;
}

export interface Phase2Song extends Song {
  model: string;
  rank: number;
  batch: number;
  displayOrder: number;
}

export type AppPhase = 'intro' | 'initial' | 'choice' | 'recommendation' | 'questionnaire' | 'complete';
