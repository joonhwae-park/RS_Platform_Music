import React from 'react';
import { Lightbulb, Music, Loader2 } from 'lucide-react';

interface ChoiceScreenProps {
  ratingsCount: number;
  onGetRecommendations: () => void;
  isGeneratingRecommendations?: boolean;
}

export const ChoiceScreen: React.FC<ChoiceScreenProps> = ({
  ratingsCount,
  onGetRecommendations,
  isGeneratingRecommendations = false
}) => {
  if (isGeneratingRecommendations) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <Loader2 className="animate-spin text-teal-500 mx-auto mb-6" size={64} />
            <h2 className="text-3xl font-bold text-white mb-4">
              Generating Your Personalized Recommendations
            </h2>
            <p className="text-xl text-gray-400 mb-2">
              Analyzing your ratings and preferences...
            </p>
            <p className="text-lg text-gray-500">
              This may take a few moments
            </p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
            <h3 className="text-xl font-bold text-teal-400 mb-3">Understanding Recommendation Qualities</h3>

            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="text-lg font-semibold text-white mb-2">Diversity</h4>
              <p className="text-gray-300">
                How different is this recommended song from other songs in the list?
              </p>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="text-lg font-semibold text-white mb-2">Novelty</h4>
              <p className="text-gray-300">
                How new or fresh is this song to you?
              </p>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg">
              <h4 className="text-lg font-semibold text-white mb-2">Serendipity</h4>
              <p className="text-gray-300">
                How pleasantly surprising or unexpected is this recommended song for you?
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-500 rounded-full mb-6">
            <Music size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Great Job!
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            You've rated {ratingsCount} songs. Ready for your personalized recommendations?
          </p>
        </div>

        <div className="bg-teal-500 bg-opacity-10 border border-teal-500 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-center mb-4">
            <Lightbulb className="text-teal-400 mr-2" size={24} />
            <span className="text-teal-400 font-semibold">What Happens Next</span>
          </div>
          <p className="text-white text-lg">
            We will generate 20 song recommendations for you. You will rate each one and answer questions about diversity, novelty, and serendipity.
          </p>
        </div>

        <button
          onClick={onGetRecommendations}
          className="bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-8 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl text-xl"
        >
          Get My Recommendations
        </button>
      </div>
    </div>
  );
};
