import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGameSession } from '@/hooks/useGameSession';
import { toast } from 'sonner';

export default function JoinGamePage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleJoin = async () => {
    const cleanCode = code.toUpperCase().trim();
    if (cleanCode.length !== 4) {
      toast.error('El código debe tener 4 caracteres');
      return;
    }

    setLoading(true);
    
    // Just navigate to the join flow with the code
    navigate(`/join/${cleanCode}`);
  };

  return (
    <PageLayout title="Unirse a partida">
      <div className="max-w-md mx-auto space-y-8">
        <div className="text-center">
          <p className="text-muted-foreground">
            Introduce el código de 4 letras que te ha dado el anfitrión
          </p>
        </div>

        <div className="space-y-4">
          <Label htmlFor="code" className="text-lg font-bold">
            Código de sala
          </Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="ABCD"
            className="text-center text-4xl h-20 border-2 font-mono tracking-[0.5em]"
            maxLength={4}
            autoComplete="off"
          />
        </div>

        <Button
          onClick={handleJoin}
          disabled={code.length !== 4 || loading}
          className="w-full h-16 text-xl font-bold"
        >
          {loading ? 'Buscando...' : 'Unirse'}
        </Button>
      </div>
    </PageLayout>
  );
}
