import { supabase } from '../lib/supabase';
import { recommendationAPI } from './recommendationAPI';

export class RecommenderService {
  async triggerRecommendationGeneration(sessionId: string): Promise<string[] | null> {
    try {
      const result = await recommendationAPI.generateRecommendations(sessionId);
      if (result && result.display_sequence) {
        const trackIds = result.display_sequence
          .sort((a: [string, string, number], b: [string, string, number]) => a[2] - b[2])
          .map((item: [string, string, number]) => item[1]);
        return trackIds;
      }
      return null;
    } catch (error) {
      console.error('Error triggering recommendation generation:', error);
      return null;
    }
  }

  async getRecommendationsFromDB(sessionId: string): Promise<string[]> {
    const maxRetries = 5;
    const retryDelay = 1500;

    await new Promise(resolve => setTimeout(resolve, 1500));

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { data, error } = await supabase
        .from('music_recommendations')
        .select('spotify_track_id, display_order')
        .eq('session_id', sessionId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error(`Attempt ${attempt}: Error fetching recommendations:`, error);
        if (attempt === maxRetries) return [];
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      if (data && data.length > 0) {
        return data.map(r => r.spotify_track_id);
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    return [];
  }

  async checkHealth(): Promise<boolean> {
    return await recommendationAPI.checkHealth();
  }
}

export const recommenderService = new RecommenderService();
