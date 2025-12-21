import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageLayoutProps {
  title?: string;
  showBack?: boolean;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export function PageLayout({ 
  title, 
  showBack = true, 
  children, 
  className,
  footer 
}: PageLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {(title || (showBack && !isHome)) && (
        <header className="sticky top-0 z-50 bg-background border-b-2 border-foreground">
          <div className="flex items-center gap-4 p-4">
            {showBack && !isHome && (
              <button
                onClick={() => navigate(-1)}
                className="p-2 border-2 border-foreground hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            {title && (
              <h1 className="text-2xl font-bold truncate">{title}</h1>
            )}
          </div>
        </header>
      )}
      
      <main className={cn('flex-1 p-4', className)}>
        {children}
      </main>

      {footer && (
        <footer className="sticky bottom-0 bg-background border-t-2 border-foreground p-4">
          {footer}
        </footer>
      )}
    </div>
  );
}
