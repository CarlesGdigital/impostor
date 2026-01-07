import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CardRevealProps {
  word: string;
  clue: string;
  isTopo: boolean;
  isRevealed: boolean;
  onRevealComplete?: () => void;
  revealDuration?: number; // Kept for compatibility, but flip animation is ~600ms
  className?: string;
  extraNote?: string | null;
}

export function CardReveal({
  word,
  clue,
  isTopo,
  isRevealed: initialRevealed,
  onRevealComplete,
  className,
  extraNote,
}: CardRevealProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(initialRevealed);

  // Check for reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleFlip = () => {
    if (hasRevealed) return;

    if (prefersReducedMotion) {
      // Instant reveal for accessibility
      setHasRevealed(true);
      onRevealComplete?.();
    } else {
      // Start flip animation
      setIsFlipped(true);
      // Complete reveal after animation
      setTimeout(() => {
        setHasRevealed(true);
        onRevealComplete?.();
      }, 600);
    }
  };

  // Flip animation styles
  const flipContainerStyle = {
    perspective: '1000px',
  };

  const flipInnerStyle = {
    position: 'relative' as const,
    width: '100%',
    minHeight: '300px',
    transformStyle: 'preserve-3d' as const,
    transition: prefersReducedMotion ? 'none' : 'transform 0.6s ease-out',
    transform: isFlipped || hasRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
  };

  const faceStyle = {
    position: 'absolute' as const,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const frontStyle = {
    ...faceStyle,
    transform: 'rotateY(0deg)',
  };

  const backStyle = {
    ...faceStyle,
    transform: 'rotateY(180deg)',
  };

  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      <div style={flipContainerStyle} className="w-full">
        <div style={flipInnerStyle}>
          {/* Front of card (hidden/lock state) */}
          <button
            onClick={handleFlip}
            disabled={hasRevealed || isFlipped}
            style={frontStyle}
            className={cn(
              "p-8 border-4 border-foreground bg-card hover:bg-secondary/50 transition-colors",
              "select-none cursor-pointer"
            )}
          >
            <div className="flex flex-col items-center justify-center gap-4">
              <span className="text-8xl opacity-30">🔒</span>
              <span className="text-2xl font-bold text-center">
                Toca para revelar tu carta
              </span>
              <span className="text-sm text-muted-foreground">
                Un toque para ver
              </span>
            </div>
          </button>

          {/* Back of card (revealed content) */}
          <div
            style={backStyle}
            className="p-8 border-4 border-foreground bg-card"
          >
            {isTopo ? (
              <div className="flex flex-col items-center justify-center">
                <span className="text-6xl font-bold text-destructive mb-4">🕵️ TOPO</span>
                <span className="text-lg text-muted-foreground">Pista:</span>
                <span className="text-3xl font-bold text-center break-words mt-2">{clue || "Sin pista"}</span>
              </div>
            ) : (
              <span className="text-5xl font-bold text-center break-words">{word || "Cargando"}</span>
            )}
            {extraNote && (
              <p className="mt-4 text-lg font-bold text-amber-500 text-center">{extraNote}</p>
            )}
            {hasRevealed && (
              <span className="mt-4 text-muted-foreground">Carta revelada</span>
            )}
          </div>
        </div>
      </div>

      {!hasRevealed && !isFlipped && (
        <p className="text-sm text-muted-foreground text-center">
          Toca la carta para revelarla
        </p>
      )}
    </div>
  );
}
