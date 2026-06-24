import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  label: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, label }) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="w-full mb-2">
      <div className="flex justify-between items-center mb-2">
        <span className="text-teal-400 font-medium">{label}</span>
        <span className="text-white">{current}/{total}</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-teal-400 transition-all duration-500 ease-out"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};
