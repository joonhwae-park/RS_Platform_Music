import React from 'react';
import { Music, Headphones, Target, Award, ArrowRight } from 'lucide-react';

interface IntroScreenProps {
  onStart: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-teal-500 rounded-full mb-6">
            <Music size={48} className="text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Welcome to MusicRate
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Please follow the steps below to help us understand your music preferences.
          </p>

          <div className="bg-teal-500 bg-opacity-10 border border-teal-500 rounded-xl p-6 mb-8 max-w-3xl mx-auto">
            <h3 className="text-teal-400 font-semibold text-lg mb-3">Important Notice</h3>
            <p className="text-gray-300 leading-relaxed">
              You will listen to 30-second previews of songs and indicate whether you like or dislike them.
              You must listen to at least <span className="font-bold text-teal-200">15 seconds</span> before rating.
              Providing honest ratings will lead to more accurate recommendations.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-center w-16 h-16 bg-teal-500 bg-opacity-20 rounded-full mb-4 mx-auto">
              <Headphones className="text-teal-400" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Step 1.<br /> Rate Songs</h3>
            <p className="text-gray-400">
              Listen to 30-second previews and rate songs with like or dislike to help us understand your taste.
            </p>
          </div>

          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-center w-16 h-16 bg-teal-500 bg-opacity-20 rounded-full mb-4 mx-auto">
              <Target className="text-teal-400" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Step 2.<br /> Get Recommendations</h3>
            <p className="text-gray-400">
              Receive personalized song recommendations based on your ratings and preferences.
            </p>
          </div>

          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="flex items-center justify-center w-16 h-16 bg-teal-500 bg-opacity-20 rounded-full mb-4 mx-auto">
              <Award className="text-teal-400" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Step 3.<br /> Evaluate Quality</h3>
            <p className="text-gray-400">
              Rate the recommended songs and answer questions about diversity, novelty, and serendipity.
            </p>
          </div>
        </div>

        <div className="bg-teal-500 bg-opacity-10 border border-teal-500 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div>
              <h4 className="text-teal-400 font-semibold mb-2">Phase 1: Initial Ratings</h4>
              <p className="text-gray-300 text-sm">
                Rate 20 songs by listening to their previews and indicating like or dislike.
                You must listen at least 15 seconds before you can rate.
              </p>
            </div>
            <div>
              <h4 className="text-teal-400 font-semibold mb-2">Phase 2: Personalized Recommendations</h4>
              <p className="text-gray-300 text-sm">
                Based on your ratings, we will show you 20 personalized recommendations.
                Rate each one and answer additional questions about diversity, novelty, and serendipity.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onStart}
            className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl inline-flex items-center gap-3 text-lg"
          >
            Start Listening
            <ArrowRight size={24} />
          </button>
          <p className="text-gray-400 text-sm mt-4">
            This study takes approximately 30 minutes to complete
          </p>
        </div>
      </div>
    </div>
  );
};
