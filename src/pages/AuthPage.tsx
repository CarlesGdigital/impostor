import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { AuthForm } from '@/components/auth/AuthForm';

export default function AuthPage() {
  const navigate = useNavigate();

  return (
    <PageLayout title="Cuenta">
      <div className="max-w-md mx-auto">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold">¡Bienvenido!</h2>
          <p className="text-muted-foreground mt-2">
            Crea una cuenta para guardar tu avatar y perfil
          </p>
        </div>

        <AuthForm 
          onSuccess={() => navigate('/')}
          onCancel={() => navigate('/')}
        />

        <p className="mt-6 text-center text-sm text-muted-foreground">
          También puedes jugar sin cuenta como invitado
        </p>
      </div>
    </PageLayout>
  );
}
