import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Library, FolderOpen, Users, Loader2, Flag } from 'lucide-react';

const AdminPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        navigate('/');
      }
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  if (authLoading || roleLoading) {
    return (
      <PageLayout title="Administración">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <PageLayout title="Administración">
      <div className="space-y-4 max-w-md mx-auto">
        <Button
          onClick={() => navigate('/admin/words')}
          variant="outline"
          className="w-full h-16 text-lg justify-start gap-4 border-2"
        >
          <Library className="w-6 h-6" />
          Palabras
        </Button>

        <Button
          onClick={() => navigate('/admin/packs')}
          variant="outline"
          className="w-full h-16 text-lg justify-start gap-4 border-2"
        >
          <FolderOpen className="w-6 h-6" />
          Categorías
        </Button>

        <Button
          onClick={() => navigate('/admin/users')}
          variant="outline"
          className="w-full h-16 text-lg justify-start gap-4 border-2"
        >
          <Users className="w-6 h-6" />
          Usuarios
        </Button>

        <Button
          onClick={() => navigate('/admin/reports')}
          variant="outline"
          className="w-full h-16 text-lg justify-start gap-4 border-2"
        >
          <Flag className="w-6 h-6" />
          Reportes
        </Button>
      </div>
    </PageLayout>
  );
};

export default AdminPage;
