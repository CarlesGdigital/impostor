import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CardFlipProps {
  word: string;
  clue: string;
  isTopo: boolean;
  isRevealed: boolean;
  onRevealComplete?: () => void;
  revealDuration?: number;
  className?: string;
  extraNote?: string | null;
}

export function CardFlip({
  word,
  clue,
  isTopo,
  isRevealed: initialRevealed,
  onRevealComplete,
  revealDuration = 1000,
  className,
  extraNote,
}: CardFlipProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(initialRevealed);
  const [isFlipping, setIsFlipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef(false);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const startReveal = useCallback(() => {
    if (hasRevealed || completedRef.current) return;

    setIsPressed(true);
    startTimeRef.current = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / revealDuration) * 100, 100);
      setProgress(newProgress);

      if (elapsed >= revealDuration && !completedRef.current) {
        completedRef.current = true;
        
        // Start flip animation
        if (!prefersReducedMotion) {
          setIsFlipping(true);
          setTimeout(() => {
            setHasRevealed(true);
            setIsFlipping(false);
            onRevealComplete?.();
          }, 300); // Half of flip animation
        } else {
          // No animation for reduced motion
          setHasRevealed(true);
          onRevealComplete?.();
        }
      } else if (elapsed < revealDuration) {
        timerRef.current = setTimeout(updateProgress, 50);
      }
    };

    timerRef.current = setTimeout(updateProgress, 50);
  }, [revealDuration, onRevealComplete, hasRevealed, prefersReducedMotion]);

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

  // Card back (hidden state)
  const CardBack = () => (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center p-8 border-4 border-foreground bg-card min-h-[300px]",
        "backface-hidden",
        isPressed && "bg-secondary scale-95",
        className
      )}
      style={{ transform: 'rotateY(0deg)' }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-8xl opacity-20">🔒</span>
      </div>

      <span className="relative z-10 text-2xl font-bold text-center">
        {isPressed ? "Mantenga pulsado..." : "Mantenga pulsado para revelar"}
      </span>

      {isPressed && (
        <div className="relative z-10 w-full max-w-xs mt-6 h-4 border-2 border-foreground bg-background overflow-hidden">
          <div 
            className="h-full bg-foreground transition-all duration-100" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      )}
    </div>
  );

  // Card front (revealed state)
  const CardFront = () => (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center p-8 border-4 border-foreground bg-card min-h-[300px]",
        "backface-hidden",
        className
      )}
      style={{ transform: 'rotateY(180deg)' }}
    >
      {isTopo ? (
        <>
          <span className="text-6xl font-bold text-destructive mb-4">🕵️ TOPO</span>
          <span className="text-lg text-muted-foreground">Pista:</span>
          <span className="text-3xl font-bold text-center break-words mt-2">{clue || "Sin pista"}</span>
        </>
      ) : (
        <span className="text-5xl font-bold text-center break-words">{word || "Cargando"}</span>
      )}
      {extraNote && (
        <p className="mt-4 text-lg font-bold text-amber-500 text-center">{extraNote}</p>
      )}
      <span className="mt-4 text-muted-foreground">Carta revelada</span>
    </div>
  );

  // Already revealed - show static card
  if (hasRevealed && !isFlipping) {
    return (
      <div className={cn("flex flex-col items-center gap-6", className)}>
        <div
          className={cn(
            "relative flex flex-col items-center justify-center p-8 border-4 border-foreground bg-card min-h-[300px] w-full",
            "animate-scale-in"
          )}
        >
          {isTopo ? (
            <>
              <span className="text-6xl font-bold text-destructive mb-4">🕵️ TOPO</span>
              <span className="text-lg text-muted-foreground">Pista:</span>
              <span className="text-3xl font-bold text-center break-words mt-2">{clue || "Sin pista"}</span>
            </>
          ) : (
            <span className="text-5xl font-bold text-center break-words">{word || "Cargando"}</span>
          )}
          {extraNote && (
            <p className="mt-4 text-lg font-bold text-amber-500 text-center">{extraNote}</p>
          )}
          <span className="mt-4 text-muted-foreground">Carta revelada</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      <button
        onMouseDown={startReveal}
        onMouseUp={stopReveal}
        onMouseLeave={stopReveal}
        onTouchStart={startReveal}
        onTouchEnd={stopReveal}
        className={cn(
          "relative w-full min-h-[300px] perspective-1000",
          "select-none touch-none"
        )}
        style={{ perspective: '1000px' }}
      >
        <div
          className={cn(
            "relative w-full h-full transition-transform duration-600 transform-style-3d",
            isFlipping && "animate-flip"
          )}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipping ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: prefersReducedMotion ? 'none' : 'transform 0.6s ease-in-out'
          }}
        >
          {/* Back of card (locked) */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center p-8 border-4 border-foreground min-h-[300px] w-full",
              "transition-all",
              isPressed ? "bg-secondary scale-95" : "bg-card hover:bg-secondary/50",
            )}
            style={{ 
              backfaceVisibility: 'hidden',
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-8xl opacity-20">🔒</span>
            </div>

            <span className="relative z-10 text-2xl font-bold text-center">
              {isPressed ? "Mantenga pulsado..." : "Mantenga pulsado para revelar"}
            </span>

            {isPressed && (
              <div className="relative z-10 w-full max-w-xs mt-6 h-4 border-2 border-foreground bg-background overflow-hidden">
                <div 
                  className="h-full bg-foreground transition-all duration-100" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            )}
          </div>

          {/* Front of card (revealed) */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center p-8 border-4 border-foreground bg-card min-h-[300px] w-full",
            )}
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            {isTopo ? (
              <>
                <span className="text-6xl font-bold text-destructive mb-4">🕵️ TOPO</span>
                <span className="text-lg text-muted-foreground">Pista:</span>
                <span className="text-3xl font-bold text-center break-words mt-2">{clue || "Sin pista"}</span>
              </>
            ) : (
              <span className="text-5xl font-bold text-center break-words">{word || "Cargando"}</span>
            )}
            {extraNote && (
              <p className="mt-4 text-lg font-bold text-amber-500 text-center">{extraNote}</p>
            )}
            <span className="mt-4 text-muted-foreground">Carta revelada</span>
          </div>
        </div>
      </button>

      <p className="text-sm text-muted-foreground text-center">
        Mantén pulsado durante {revealDuration / 1000} segundos para ver tu carta
      </p>
    </div>
  );
}
