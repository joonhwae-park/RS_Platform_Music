import React, { useState } from 'react';
import { QuestionnaireData } from '../types';
import { CheckCircle, User, MessageSquare, Mail } from 'lucide-react';

interface QuestionnaireScreenProps {
  onComplete: (data: QuestionnaireData) => void;
}

export const QuestionnaireScreen: React.FC<QuestionnaireScreenProps> = ({ onComplete }) => {
  const [formData, setFormData] = useState<QuestionnaireData>({
    musicListeningFrequency: '',
    musicGenrePreference: '',
    musicExpertise: '',
    attentionCheck: '',
    diversityAttitude: '',
    diversityAttitude2: '',
    noveltyAttitude: '',
    noveltyAttitude2: '',
    serendipityAttitude: '',
    serendipityAttitude2: '',
    gender: '',
    ageRange: '',
    additionalComments: '',
    email: ''
  });

  const [errors, setErrors] = useState<string[]>([]);

  const frequencyOptions = ['1', '2', '3', '4', '5', '6', '7'];

  const genreOptions = [
    'Pop', 'Rock', 'Hip-Hop/Rap', 'R&B/Soul', 'Electronic/Dance',
    'Classical', 'Jazz', 'Country', 'Metal', 'Indie/Alternative'
  ];

  const ageRangeOptions = ['18-24', '25-34', '35-44', '45-54', '55-64', '65 or older'];
  const likertOptions = ['1', '2', '3', '4', '5', '6', '7'];

  const validateForm = () => {
    const newErrors: string[] = [];
    if (!formData.musicListeningFrequency) newErrors.push('Music listening frequency is required');
    if (!formData.musicGenrePreference) newErrors.push('Favorite music genre is required');
    if (!formData.musicExpertise) newErrors.push('Music expertise question is required');
    if (!formData.attentionCheck) newErrors.push('Please answer the attention check question');
    if (!formData.diversityAttitude) newErrors.push('Diversity attitude question is required');
    if (!formData.diversityAttitude2) newErrors.push('Second diversity question is required');
    if (!formData.noveltyAttitude) newErrors.push('Novelty attitude question is required');
    if (!formData.noveltyAttitude2) newErrors.push('Second novelty question is required');
    if (!formData.serendipityAttitude) newErrors.push('Serendipity attitude question is required');
    if (!formData.serendipityAttitude2) newErrors.push('Second serendipity question is required');
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onComplete(formData);
    }
  };

  const LikertScale = ({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) => (
    <div className="grid grid-cols-7 gap-2">
      {likertOptions.map(option => (
        <label key={option} className="flex flex-col items-center">
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="mb-1 text-teal-500 focus:ring-teal-500"
          />
          <span className="text-gray-300 text-sm">{option}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-500 rounded-full mb-4">
            <CheckCircle size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Final Questionnaire</h1>
          <p className="text-gray-300">
            Please answer a few questions about your music preferences and background
          </p>
        </div>

        {errors.length > 0 && (
          <div className="bg-red-900 border border-red-500 rounded-lg p-4 mb-6">
            <h3 className="text-red-400 font-semibold mb-2">Please complete the following required fields:</h3>
            <ul className="text-red-300 text-sm space-y-1">
              {errors.map((error, index) => (
                <li key={index}>- {error}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold text-white mb-6">Required Information</h2>

            {/* Music Listening Frequency */}
            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">
                How many days per week do you listen to music? (1 = rarely, 7 = every day) *
              </label>
              <LikertScale
                name="musicFrequency"
                value={formData.musicListeningFrequency}
                onChange={(v) => setFormData(prev => ({ ...prev, musicListeningFrequency: v }))}
              />
            </div>

            {/* Favorite Genre */}
            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">
                What is your most favorite music genre? (Select one) *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {genreOptions.map(genre => (
                  <label key={genre} className="flex items-center">
                    <input
                      type="radio"
                      name="musicGenre"
                      value={genre}
                      checked={formData.musicGenrePreference === genre}
                      onChange={() => setFormData(prev => ({ ...prev, musicGenrePreference: genre }))}
                      className="mr-3 text-teal-500 focus:ring-teal-500"
                    />
                    <span className="text-gray-300">{genre}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Music Expertise */}
            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">
                How knowledgeable are you about music in general? (1 = Not at all, 7 = Extremely) *
              </label>
              <LikertScale
                name="musicExpertise"
                value={formData.musicExpertise}
                onChange={(v) => setFormData(prev => ({ ...prev, musicExpertise: v }))}
              />
            </div>

            {/* Attention Check */}
            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">
                To help us with the survey, please select "4" for this question. *
              </label>
              <LikertScale
                name="attentionCheck"
                value={formData.attentionCheck}
                onChange={(v) => setFormData(prev => ({ ...prev, attentionCheck: v }))}
              />
            </div>

            {/* Diversity Attitude */}
            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">
                I often prefer listening to similar types of music. (1 = Strongly disagree, 7 = Strongly agree) *
              </label>
              <LikertScale
                name="diversityAttitude"
                value={formData.diversityAttitude}
                onChange={(v) => setFormData(prev => ({ ...prev, diversityAttitude: v }))}
              />
            </div>

            {/* Diversity Attitude 2 */}
            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">
                Compared to my peers, I listen to more diverse music. (1 = Strongly disagree, 7 = Strongly agree) *
              </label>
              <LikertScale
                name="diversityAttitude2"
                value={formData.diversityAttitude2}
                onChange={(v) => setFormData(prev => ({ ...prev, diversityAttitude2: v }))}
              />
            </div>

            {/* Novelty Attitude */}
            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">
                I often prefer listening to new music. (1 = Strongly disagree, 7 = Strongly agree) *
              </label>
              <LikertScale
                name="noveltyAttitude"
                value={formData.noveltyAttitude}
                onChange={(v) => setFormData(prev => ({ ...prev, noveltyAttitude: v }))}
              />
            </div>

            {/* Novelty Attitude 2 */}
            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">
                Compared to my peers, I often listen to more conventional music. (1 = Strongly disagree, 7 = Strongly agree) *
              </label>
              <LikertScale
                name="noveltyAttitude2"
                value={formData.noveltyAttitude2}
                onChange={(v) => setFormData(prev => ({ ...prev, noveltyAttitude2: v }))}
              />
            </div>

            {/* Serendipity Attitude */}
            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">
                I often prefer listening to music that surprises me. (1 = Strongly disagree, 7 = Strongly agree) *
              </label>
              <LikertScale
                name="serendipityAttitude"
                value={formData.serendipityAttitude}
                onChange={(v) => setFormData(prev => ({ ...prev, serendipityAttitude: v }))}
              />
            </div>

            {/* Serendipity Attitude 2 */}
            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">
                Compared to my peers, I often listen to music that are easier to discover. (1 = Strongly disagree, 7 = Strongly agree) *
              </label>
              <LikertScale
                name="serendipityAttitude2"
                value={formData.serendipityAttitude2}
                onChange={(v) => setFormData(prev => ({ ...prev, serendipityAttitude2: v }))}
              />
            </div>
          </div>

          {/* Optional Information */}
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
              <User className="mr-2" size={24} />
              Optional Information
            </h2>

            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">Gender (Optional)</label>
              <select
                value={formData.gender || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3">Age Range (Optional)</label>
              <select
                value={formData.ageRange || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, ageRange: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select age range</option>
                {ageRangeOptions.map(range => (
                  <option key={range} value={range}>{range}</option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3 flex items-center">
                <Mail className="mr-2" size={20} />
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter your email address"
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-teal-400 font-medium mb-3 flex items-center">
                <MessageSquare className="mr-2" size={20} />
                Additional Comments (Optional)
              </label>
              <textarea
                value={formData.additionalComments || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, additionalComments: e.target.value }))}
                placeholder="Any additional thoughts about the study..."
                rows={4}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-vertical"
              />
            </div>
          </div>

          <div className="text-center">
            <button
              type="submit"
              className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg text-lg"
            >
              Complete Study
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
