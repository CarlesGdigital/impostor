import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AuthFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function AuthForm({ onSuccess, onCancel, className }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!displayName.trim()) {
          toast.error('Por favor, introduce un nombre');
          return;
        }
        const { error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('Este email ya está registrado');
          } else {
            toast.error(error.message);
          }
          return;
        }
        toast.success('¡Cuenta creada! Ya puedes jugar');
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error('Email o contraseña incorrectos');
          return;
        }
        toast.success('¡Bienvenido de nuevo!');
      }
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      <div className="flex border-2 border-foreground">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={cn(
            'flex-1 p-4 text-lg font-bold transition-colors',
            mode === 'login' 
              ? 'bg-foreground text-background' 
              : 'bg-card hover:bg-secondary'
          )}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={cn(
            'flex-1 p-4 text-lg font-bold transition-colors border-l-2 border-foreground',
            mode === 'signup' 
              ? 'bg-foreground text-background' 
              : 'bg-card hover:bg-secondary'
          )}
        >
          Crear cuenta
        </button>
      </div>

      {mode === 'signup' && (
        <div className="space-y-2">
          <Label htmlFor="display-name" className="text-lg font-bold">
            Nombre
          </Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tu nombre para jugar"
            className="text-xl h-14 border-2"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-lg font-bold">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="text-xl h-14 border-2"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-lg font-bold">
          Contraseña
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="text-xl h-14 border-2"
        />
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-14 text-lg font-bold border-2"
            disabled={loading}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1 h-14 text-lg font-bold"
          disabled={loading}
        >
          {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </Button>
      </div>
    </form>
  );
}
