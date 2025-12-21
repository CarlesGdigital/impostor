import { cn } from '@/lib/utils';
import { getAvatarEmoji } from '@/lib/avatars';

interface PlayerAvatarProps {
  avatarKey?: string;
  photoUrl?: string;
  displayName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-10 h-10 text-xl',
  md: 'w-14 h-14 text-2xl',
  lg: 'w-20 h-20 text-4xl',
  xl: 'w-28 h-28 text-6xl',
};

export function PlayerAvatar({ 
  avatarKey, 
  photoUrl, 
  displayName, 
  size = 'md',
  className 
}: PlayerAvatarProps) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={displayName}
        className={cn(
          'rounded-none border-2 border-foreground object-cover',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-secondary border-2 border-foreground',
        sizeClasses[size],
        className
      )}
    >
      {getAvatarEmoji(avatarKey)}
    </div>
  );
}
