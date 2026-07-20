import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Song } from '../types';
import { Play, Pause, ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react';
import { requestPlayback, releasePlayback } from '../lib/audioManager';

interface SongCardProps {
  song: Song;
  rating: number;
  onRatingChange: (rating: number, listenedDuration: number) => void;
  showAdditionalQuestions?: boolean;
  diversityRating?: number;
  noveltyRating?: number;
  serendipityRating?: number;
  onDiversityChange?: (value: number) => void;
  onNoveltyChange?: (value: number) => void;
  onSerendipityChange?: (value: number) => void;
  isIncomplete?: boolean;
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  rating,
  onRatingChange,
  showAdditionalQuestions = false,
  diversityRating = -1,
  noveltyRating = -1,
  serendipityRating = -1,
  onDiversityChange,
  onNoveltyChange,
  onSerendipityChange,
  isIncomplete = false,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasListened15s, setHasListened15s] = useState(false);
  const [totalListened, setTotalListened] = useState(0);
  const listenedRef = useRef(0);
  const lastTimeRef = useRef(0);

  const MINIMUM_LISTEN_TIME = 15;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const ct = audio.currentTime;
      setCurrentTime(ct);
      const delta = ct - lastTimeRef.current;
      if (delta > 0 && delta < 1) {
        listenedRef.current += delta;
        setTotalListened(listenedRef.current);
        if (listenedRef.current >= MINIMUM_LISTEN_TIME) {
          setHasListened15s(true);
        }
      }
      lastTimeRef.current = ct;
    };

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      releasePlayback(audio);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      releasePlayback(audio);
    };
  }, []);

  const handleExternalStop = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      releasePlayback(audio);
      setIsPlaying(false);
    } else {
      lastTimeRef.current = audio.currentTime;
      requestPlayback(audio, handleExternalStop);
      setIsPlaying(true);
    }
  };

  const handleLike = () => {
    if (!hasListened15s) return;
    onRatingChange(1, listenedRef.current);
  };

  const handleDislike = () => {
    if (!hasListened15s) return;
    onRatingChange(0, listenedRef.current);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-gray-900 rounded-xl overflow-hidden shadow-2xl border transition-all duration-300 flex flex-col h-full ${
      isIncomplete ? 'border-red-500 ring-2 ring-red-500' : 'border-gray-800 hover:border-gray-700'
    }`}>
      {song.is_attention_check && (
        <div className="bg-yellow-600 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={16} className="text-black" />
          <span className="text-black font-medium text-sm">Please do not indicate any preference for this song.</span>
        </div>
      )}

      <div className="flex items-center gap-4 p-4">
        <img
          src={song.imageUrl}
          alt={song.song}
          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-lg truncate">{song.song}</h3>
          <p className="text-gray-400 text-sm truncate">{song.artist}</p>
        </div>
      </div>

      <div className="px-4 pb-4 flex-grow flex flex-col">
        {/* Audio Player */}
        <div className="bg-gray-800 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-10 h-10 flex items-center justify-center bg-teal-500 hover:bg-teal-600 rounded-full transition-colors flex-shrink-0"
            >
              {isPlaying ? <Pause size={18} className="text-white" /> : <Play size={18} className="text-white ml-0.5" />}
            </button>

            <div className="flex-1">
              <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
                <div
                  className="bg-teal-400 h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Listen progress indicator */}
          {!hasListened15s && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Listen at least 15s to rate</span>
                <span>{Math.floor(totalListened)}s / {MINIMUM_LISTEN_TIME}s</span>
              </div>
            </div>
          )}
        </div>

        {/* Like / Dislike Buttons */}
        <div className="flex items-center justify-center gap-6 mb-4">
          <button
            onClick={handleLike}
            disabled={!hasListened15s}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              rating === 1
                ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
                : hasListened15s
                  ? 'bg-gray-800 text-gray-300 hover:bg-teal-500/20 hover:text-teal-400'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            <ThumbsUp size={20} />
            <span>Like</span>
          </button>

          <button
            onClick={handleDislike}
            disabled={!hasListened15s}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              rating === 0
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : hasListened15s
                  ? 'bg-gray-800 text-gray-300 hover:bg-red-500/20 hover:text-red-400'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
            }`}
          >
            <ThumbsDown size={20} />
            <span>Dislike</span>
          </button>
        </div>

        {/* Beyond-accuracy measures (Phase 2 only) */}
        {showAdditionalQuestions && (
          <div className="space-y-3 border-t border-gray-800 pt-4">
            <BinaryQuestion
              label="Do you find this song recommendation diverse?"
              value={diversityRating}
              onChange={onDiversityChange!}
              disabled={!hasListened15s}
            />
            <BinaryQuestion
              label="Do you find this song recommendation novel?"
              value={noveltyRating}
              onChange={onNoveltyChange!}
              disabled={!hasListened15s}
            />
            <BinaryQuestion
              label="Do you find this song recommendation serendipitous?"
              value={serendipityRating}
              onChange={onSerendipityChange!}
              disabled={!hasListened15s}
            />
          </div>
        )}
      </div>

      <audio ref={audioRef} src={song.audioUrl} preload="metadata" />
    </div>
  );
};

interface BinaryQuestionProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

const BinaryQuestion: React.FC<BinaryQuestionProps> = ({ label, value, onChange, disabled }) => (
  <div>
    <p className="text-gray-300 text-sm mb-2">{label}</p>
    <div className="flex gap-3">
      <button
        onClick={() => !disabled && onChange(1)}
        disabled={disabled}
        className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
          value === 1
            ? 'bg-teal-500 text-white'
            : disabled
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-gray-800 text-gray-300 hover:bg-teal-500/20'
        }`}
      >
        Yes
      </button>
      <button
        onClick={() => !disabled && onChange(0)}
        disabled={disabled}
        className={`px-4 py-1.5 rounded text-sm font-medium transition-all ${
          value === 0
            ? 'bg-red-500 text-white'
            : disabled
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-gray-800 text-gray-300 hover:bg-red-500/20'
        }`}
      >
        No
      </button>
    </div>
  </div>
);
