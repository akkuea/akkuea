'use client';
import { useState } from 'react';
import { Star } from 'lucide-react';

interface RatingProps {
  initialRating?: number;
  totalRatings?: number;
  onRate?: (value: number) => void;
}

export default function ResourceRating({
  initialRating = 0,
  totalRatings = 0,
  onRate,
}: RatingProps) {
  const [rating, setRating] = useState(initialRating);
  const [hovered, setHovered] = useState<number | null>(null);

  const handleClick = (value: number) => {
    setRating(value);
    if (onRate) onRate(value);
  };

  return (
    <div className="flex flex-col space-y-2">
      {/* Stars */}
      <div className="flex items-center space-x-2" role="radiogroup" aria-label="Rate resource">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = hovered ? star <= hovered : star <= rating;

          return (
            <button
              key={star}
              onClick={() => handleClick(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              className="focus:outline-none transition-transform duration-200 hover:scale-110"
              role="radio"
              aria-checked={rating === star}
            >
              <Star
                className={`w-7 h-7 drop-shadow-sm transition-colors duration-200 ${
                  active
                    ? 'fill-yellow-400 stroke-yellow-400 hover:drop-shadow-[0_0_8px_#facc15]'
                    : 'stroke-gray-400 hover:stroke-yellow-300'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Average + Count */}
      <span className="text-sm text-gray-700 font-medium">
        ⭐ {initialRating.toFixed(1)} / 5{' '}
        <span className="text-gray-500">({totalRatings} ratings)</span>
      </span>
    </div>
  );
}
