import { cn } from '@/lib/utils';
import { Player } from '@/types/game';
import { PlayerAvatar } from './PlayerAvatar';
import { Check, Clock } from 'lucide-react';

interface PlayerListProps {
  players: Player[];
  showRevealStatus?: boolean;
  currentPlayerId?: string;
  className?: string;
}

export function PlayerList({ 
  players, 
  showRevealStatus = false,
  currentPlayerId,
  className 
}: PlayerListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {players.map((player) => (
        <div
          key={player.id}
          className={cn(
            'flex items-center gap-4 p-3 border-2 border-foreground bg-card',
            currentPlayerId === player.id && 'border-4 bg-secondary'
          )}
        >
          <PlayerAvatar
            avatarKey={player.avatarKey}
            photoUrl={player.photoUrl}
            displayName={player.displayName}
            size="sm"
          />
          <span className="flex-1 text-lg font-bold truncate">
            {player.displayName}
          </span>
          {showRevealStatus && (
            <div className="flex items-center">
              {player.hasRevealed ? (
                <Check className="w-6 h-6 text-foreground" />
              ) : (
                <Clock className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
