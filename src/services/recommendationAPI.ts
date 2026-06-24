const RECOMMENDATION_API_URL = import.meta.env.VITE_RECOMMENDATION_API_URL;

export interface RecommendationResponse {
  session_id: string;
  display_sequence: Array<[string, string, number]>; // [model, spotify_track_id, display_order]
}

class RecommendationAPI {
  async generateRecommendations(sessionId: string): Promise<RecommendationResponse | null> {
    try {
      if (!RECOMMENDATION_API_URL) {
        console.warn('VITE_RECOMMENDATION_API_URL is not configured');
        return null;
      }

      const response = await fetch(`${RECOMMENDATION_API_URL}/recommend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(import.meta.env.VITE_WEBHOOK_SECRET && {
            'X-Webhook-Secret': import.meta.env.VITE_WEBHOOK_SECRET
          })
        },
        body: JSON.stringify({ session_id: sessionId }),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        console.error('Recommendation API error:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Error calling recommendation API:', error);
      return null;
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!RECOMMENDATION_API_URL) return false;
    try {
      const response = await fetch(`${RECOMMENDATION_API_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const recommendationAPI = new RecommendationAPI();
