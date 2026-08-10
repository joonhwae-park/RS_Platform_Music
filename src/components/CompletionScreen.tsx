import React, { useEffect, useState } from 'react';
import { Trophy, ThumbsUp, Heart } from 'lucide-react';

interface CompletionScreenProps {
  totalRatings: number;
  prolificPid: string | null;
}

const PROLIFIC_COMPLETION_URL = 'https://app.prolific.com/submissions/complete?cc=C1F8YAHH';
const REDIRECT_DELAY_SECONDS = 5;

export const CompletionScreen: React.FC<CompletionScreenProps> = ({ totalRatings, prolificPid }) => {
  const [countdown, setCountdown] = useState(REDIRECT_DELAY_SECONDS);

  useEffect(() => {
    if (!prolificPid) return;

    if (countdown <= 0) {
      window.location.href = PROLIFIC_COMPLETION_URL;
      return;
    }

    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [prolificPid, countdown]);

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
          {prolificPid ? (
            <p className="text-white text-lg text-center leading-relaxed">
              Thank you for participating in our study! You will be redirected to Prolific in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          ) : (
            <p className="text-white text-lg text-center leading-relaxed">
              Thank you for participating in our study! You can now close the window.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
