import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface CardRevealProps {
  word: string;
  isRevealed: boolean;
  onRevealComplete?: () => void;
  revealDuration?: number;
  className?: string;
}

export function CardReveal({ 
  word, 
  isRevealed: initialRevealed,
  onRevealComplete,
  revealDuration = 4000,
  className 
}: CardRevealProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(initialRevealed);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startReveal = useCallback(() => {
    setIsPressed(true);
    startTimeRef.current = Date.now();
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / revealDuration) * 100, 100);
      setProgress(newProgress);
      
      if (elapsed >= revealDuration) {
        setHasRevealed(true);
        onRevealComplete?.();
      } else {
        timerRef.current = setTimeout(updateProgress, 50);
      }
    };
    
    timerRef.current = setTimeout(updateProgress, 50);
  }, [revealDuration, onRevealComplete]);

  const stopReveal = useCallback(() => {
    setIsPressed(false);
    setProgress(0);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (hasRevealed) {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center p-8 border-4 border-foreground bg-card min-h-[300px]',
        className
      )}>
        <span className="text-5xl font-bold text-center break-words">
          {word}
        </span>
        <span className="mt-4 text-muted-foreground">Carta revelada</span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center gap-6', className)}>
      <button
        onMouseDown={startReveal}
        onMouseUp={stopReveal}
        onMouseLeave={stopReveal}
        onTouchStart={startReveal}
        onTouchEnd={stopReveal}
        className={cn(
          'relative flex flex-col items-center justify-center p-8 border-4 border-foreground min-h-[300px] w-full',
          'transition-all select-none touch-none',
          isPressed ? 'bg-secondary scale-95' : 'bg-card hover:bg-secondary/50'
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-8xl opacity-20">🔒</span>
        </div>
        
        <span className="relative z-10 text-2xl font-bold text-center">
          {isPressed ? 'Mantenga pulsado...' : 'Mantenga pulsado para revelar'}
        </span>
        
        {isPressed && (
          <div className="relative z-10 w-full max-w-xs mt-6 h-4 border-2 border-foreground bg-background">
            <div 
              className="h-full bg-foreground transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </button>
      
      <p className="text-sm text-muted-foreground text-center">
        Mantén pulsado durante {revealDuration / 1000} segundos para ver tu carta
      </p>
    </div>
  );
}
