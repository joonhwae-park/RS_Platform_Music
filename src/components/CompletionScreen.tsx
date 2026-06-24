import React from 'react';
import { Trophy, ThumbsUp, Heart } from 'lucide-react';

interface CompletionScreenProps {
  totalRatings: number;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({ totalRatings }) => {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-teal-500 rounded-full mb-6">
            <Trophy size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Congratulations!
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            You've successfully completed the music rating study!
          </p>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-8">
          <div className="flex items-center justify-center mb-4">
            <ThumbsUp className="text-teal-400 mr-2" size={24} />
            <span className="text-teal-400 font-semibold">Total Songs Rated</span>
          </div>
          <div className="text-3xl font-bold text-white">{totalRatings}</div>
        </div>

        <div className="bg-teal-500 bg-opacity-10 border border-teal-500 rounded-lg p-8">
          <div className="flex items-center justify-center mb-4">
            <Heart className="text-teal-400 mr-2" size={24} />
            <span className="text-teal-400 font-semibold text-lg">Thank You!</span>
          </div>
          <p className="text-white text-lg text-center leading-relaxed">
            Thank you for participating in our study! You can now close the window.
          </p>
        </div>
      </div>
    </div>
  );
};
