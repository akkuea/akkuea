import { AvatarProps } from '@/app/Types/messages';
import Image from 'next/image';

export function Avatar({ name, imageUrl, size = 'md' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0`}>
      <Image
        src={imageUrl || '/placeholder.svg'}
        alt={name}
        className="w-full h-full object-cover"
        width={size === 'sm' ? 24 : size === 'md' ? 32 : 40}
        height={size === 'sm' ? 24 : size === 'md' ? 32 : 40}
      />
    </div>
  );
}
