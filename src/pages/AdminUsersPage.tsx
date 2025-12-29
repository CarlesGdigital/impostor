import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Search, User } from 'lucide-react';
import type { Profile } from '@/types/admin';

interface UserWithEmail extends Profile {
    email: string;
}

const AdminUsersPage = () => {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { isAdmin, loading: roleLoading } = useUserRole();

    const [users, setUsers] = useState<UserWithEmail[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updating, setUpdating] = useState<string | null>(null);

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
            fetchUsers();
        }
    }, [isAdmin]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Fetch profiles with user emails from auth.users via RPC or join
            // Since we can't directly join auth.users, we fetch profiles and get emails separately
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profilesError) throw profilesError;

            // For each profile, we need to get the email from auth
            // We'll use a workaround: store email in profiles or use admin API
            // For now, we'll display without email or use display_name as identifier
            const usersWithData: UserWithEmail[] = (profiles || []).map((p: any) => ({
                id: p.id,
                displayName: p.display_name,
                gender: p.gender,
                avatarKey: p.avatar_key,
                photoUrl: p.photo_url,
                canSubmitWords: p.can_submit_words || false,
                email: p.display_name || p.id.slice(0, 8), // Fallback to partial ID
            }));

            setUsers(usersWithData);
        } catch (err) {
            console.error('Error fetching users:', err);
            toast.error('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePermission = async (userId: string, currentValue: boolean) => {
        setUpdating(userId);
        try {
            // Note: can_submit_words column added via migration - type assertion needed until types regenerated
            const { error } = await supabase
                .from('profiles')
                .update({ can_submit_words: !currentValue } as any)
                .eq('id', userId);

            if (error) throw error;

            setUsers(prev =>
                prev.map(u =>
                    u.id === userId ? { ...u, canSubmitWords: !currentValue } : u
                )
            );

            toast.success(
                !currentValue
                    ? 'Usuario puede aportar palabras'
                    : 'Permiso revocado'
            );
        } catch (err) {
            console.error('Error updating permission:', err);
            toast.error('Error al actualizar permiso');
        } finally {
            setUpdating(null);
        }
    };

    const filteredUsers = users.filter(u => {
        const search = searchTerm.toLowerCase();
        return (
            (u.displayName?.toLowerCase().includes(search)) ||
            (u.email?.toLowerCase().includes(search)) ||
            u.id.toLowerCase().includes(search)
        );
    });

    if (authLoading || roleLoading) {
        return (
            <PageLayout title="Usuarios">
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
        <PageLayout title="Usuarios">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* User list */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredUsers.map((u) => (
                            <div
                                key={u.id}
                                className="flex items-center gap-4 p-4 border-2 border-border bg-card"
                            >
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                    {u.photoUrl ? (
                                        <img src={u.photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-6 h-6 text-muted-foreground" />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold truncate">
                                        {u.displayName || 'Sin nombre'}
                                    </p>
                                    <p className="text-sm text-muted-foreground truncate">
                                        {u.email}
                                    </p>
                                </div>

                                {/* Toggle */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-sm text-muted-foreground hidden sm:inline">
                                        Puede aportar
                                    </span>
                                    <Switch
                                        checked={u.canSubmitWords}
                                        onCheckedChange={() => handleTogglePermission(u.id, u.canSubmitWords)}
                                        disabled={updating === u.id}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Info */}
                <p className="text-sm text-muted-foreground text-center">
                    Los usuarios con permiso pueden añadir palabras desde Administración → Palabras
                </p>
            </div>
        </PageLayout>
    );
};

export default AdminUsersPage;
