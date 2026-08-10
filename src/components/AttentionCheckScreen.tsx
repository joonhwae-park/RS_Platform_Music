import React, { useState } from 'react';
import { ClipboardCheck, ArrowRight } from 'lucide-react';

interface AttentionCheckScreenProps {
  onComplete: (durability: number, price: number, design: number) => void;
}

const SCALE_LABELS: Record<number, string> = {
  1: 'Very bad',
  4: 'Neither bad nor good',
  7: 'Very good',
};

const ITEMS = [
  { key: 'durability', label: 'Durability' },
  { key: 'price', label: 'Competitive purchase price' },
  { key: 'design', label: 'Design' },
] as const;

export const AttentionCheckScreen: React.FC<AttentionCheckScreenProps> = ({ onComplete }) => {
  const [ratings, setRatings] = useState({ durability: 1, price: 1, design: 1 });
  const [error, setError] = useState(false);

  const handleChange = (key: keyof typeof ratings, value: number) => {
    setRatings(prev => ({ ...prev, [key]: value }));
    setError(false);
  };

  const handleSubmit = () => {
    if (ratings.durability < 1 || ratings.price < 1 || ratings.design < 1) {
      setError(true);
      return;
    }
    onComplete(ratings.durability, ratings.price, ratings.design);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-500 rounded-full mb-4">
            <ClipboardCheck size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Before We Begin</h1>
        </div>

        <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 mb-8">
          <p className="text-gray-300 leading-relaxed text-lg mb-8">
            Thank you for participating in this study. This question aims to assess your sincerity in responding. Various factors influence decision-making. Among them, carefully reading and understanding the context before making a decision is crucial. To demonstrate that you have read the guidelines thoroughly, please assign 7 points specifically to the Durability item below. Leave the other two items at their initial value of 1 point each.
          </p>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-white font-semibold text-lg mb-6">
              Based on the text you read above, how would you rate the performance of Apple iPhone on the following aspects?
            </p>

            <div className="space-y-8">
              {ITEMS.map(({ key, label }) => (
                <div key={key}>
                  <p className="text-teal-400 font-medium mb-3">{label}</p>
                  <div className="flex items-center gap-0">
                    {[1, 2, 3, 4, 5, 6, 7].map(value => (
                      <label
                        key={value}
                        className="flex flex-col items-center flex-1 cursor-pointer group"
                      >
                        <button
                          type="button"
                          onClick={() => handleChange(key as keyof typeof ratings, value)}
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                            ratings[key as keyof typeof ratings] === value
                              ? 'bg-teal-500 border-teal-500 text-white scale-110'
                              : 'border-gray-600 text-gray-400 hover:border-teal-400 hover:text-teal-400'
                          }`}
                        >
                          {value}
                        </button>
                        <span className="text-gray-500 text-xs mt-2 text-center leading-tight h-6">
                          {SCALE_LABELS[value] ?? '\u00A0'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-500 rounded-lg p-4 mb-6 text-center">
            <p className="text-red-300">Please rate all three items before proceeding.</p>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleSubmit}
            className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl inline-flex items-center gap-3 text-lg"
          >
            Continue
            <ArrowRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
