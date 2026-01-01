import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Check, X, Eye } from 'lucide-react';

interface Report {
  id: string;
  cardId: string;
  cardWord: string;
  reporterName: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function AdminReportsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        navigate('/');
      }
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchReports();
    }
  }, [isAdmin]);

  const fetchReports = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('card_reports')
      .select(`
        id,
        card_id,
        reason,
        status,
        created_at,
        cards(word),
        profiles!card_reports_reporter_id_fkey(display_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
    } else {
      setReports((data || []).map(r => ({
        id: r.id,
        cardId: r.card_id,
        cardWord: (r.cards as any)?.word || 'Eliminada',
        reporterName: (r.profiles as any)?.display_name || 'Usuario',
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
      })));
    }
    setLoading(false);
  };

  const handleAction = async (reportId: string, newStatus: 'reviewed' | 'dismissed') => {
    setActioning(reportId);
    
    const { error } = await supabase
      .from('card_reports')
      .update({ 
        status: newStatus,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (error) {
      toast.error('Error al actualizar el reporte');
    } else {
      toast.success(newStatus === 'reviewed' ? 'Reporte marcado como revisado' : 'Reporte descartado');
      fetchReports();
    }
    setActioning(null);
  };

  const deactivateCard = async (cardId: string) => {
    const { error } = await supabase
      .from('cards')
      .update({ is_active: false })
      .eq('id', cardId);

    if (error) {
      toast.error('Error al archivar la palabra');
    } else {
      toast.success('Palabra archivada');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500">Pendiente</Badge>;
      case 'reviewed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500">Revisado</Badge>;
      case 'dismissed':
        return <Badge variant="outline" className="bg-muted text-muted-foreground">Descartado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || roleLoading || loading) {
    return (
      <PageLayout title="Reportes">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const pendingReports = reports.filter(r => r.status === 'pending');

  return (
    <PageLayout title="Reportes">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            {pendingReports.length} reportes pendientes de revisión
          </p>
          <Button variant="outline" onClick={() => navigate('/admin')}>
            Volver a Admin
          </Button>
        </div>

        <div className="border-2 border-border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Palabra</TableHead>
                <TableHead>Reportado por</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-40">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay reportes.
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-bold">{report.cardWord}</TableCell>
                    <TableCell>{report.reporterName}</TableCell>
                    <TableCell className="max-w-xs truncate">{report.reason}</TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(report.createdAt)}
                    </TableCell>
                    <TableCell>
                      {report.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => navigate(`/admin/words?search=${encodeURIComponent(report.cardWord)}`)}
                            title="Ver palabra"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={async () => {
                              await deactivateCard(report.cardId);
                              await handleAction(report.id, 'reviewed');
                            }}
                            disabled={actioning === report.id}
                            title="Archivar palabra y marcar revisado"
                            className="text-yellow-600 hover:text-yellow-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleAction(report.id, 'reviewed')}
                            disabled={actioning === report.id}
                            title="Marcar revisado (sin cambios)"
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleAction(report.id, 'dismissed')}
                            disabled={actioning === report.id}
                            title="Descartar reporte"
                          >
                            {actioning === report.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageLayout>
  );
}
