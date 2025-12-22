import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, FolderOpen } from 'lucide-react';

interface Pack {
  id: string;
  name: string;
  slug: string;
}

interface PackSelectorProps {
  selectedPackIds: string[];
  onSelectionChange: (packIds: string[]) => void;
}

const STORAGE_KEY = 'topo_preferred_packs';

export function PackSelector({ selectedPackIds, onSelectionChange }: PackSelectorProps) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadPacks();
  }, []);

  useEffect(() => {
    if (packs.length > 0 && selectedPackIds.length === 0) {
      loadPreferences();
    }
  }, [packs, user]);

  const loadPacks = async () => {
    const { data } = await supabase
      .from('packs')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name');

    setPacks(data || []);
    setLoading(false);
  };

  const loadPreferences = async () => {
    const activePackIds = packs.map(p => p.id);
    
    if (user) {
      // Load from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_pack_ids')
        .eq('id', user.id)
        .single();

      if (profile?.preferred_pack_ids && profile.preferred_pack_ids.length > 0) {
        // Filter by active packs
        const validIds = profile.preferred_pack_ids.filter((id: string) => activePackIds.includes(id));
        onSelectionChange(validIds.length > 0 ? validIds : activePackIds);
        return;
      }
    } else {
      // Load from localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const storedIds = JSON.parse(stored);
          const validIds = storedIds.filter((id: string) => activePackIds.includes(id));
          onSelectionChange(validIds.length > 0 ? validIds : activePackIds);
          return;
        } catch {
          // Invalid JSON
        }
      }
    }

    // Default: select all
    onSelectionChange(activePackIds);
  };

  const savePreferences = async (packIds: string[]) => {
    if (user) {
      await supabase
        .from('profiles')
        .update({ preferred_pack_ids: packIds })
        .eq('id', user.id);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packIds));
    }
  };

  const handleToggle = (packId: string) => {
    const newSelection = selectedPackIds.includes(packId)
      ? selectedPackIds.filter(id => id !== packId)
      : [...selectedPackIds, packId];
    
    onSelectionChange(newSelection);
    savePreferences(newSelection);
  };

  const handleSelectAll = () => {
    const allIds = packs.map(p => p.id);
    onSelectionChange(allIds);
    savePreferences(allIds);
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
    savePreferences([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <div className="p-4 border-2 border-border bg-secondary text-center text-muted-foreground">
        No hay categorías disponibles
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-lg font-bold flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          Categorías
        </Label>
        <span className="text-sm text-muted-foreground">
          {selectedPackIds.length} de {packs.length}
        </span>
      </div>

      <div className="flex gap-2">
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={handleSelectAll}
          className="text-xs"
        >
          Todas
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={handleDeselectAll}
          className="text-xs"
        >
          Ninguna
        </Button>
      </div>

      <div className="border-2 border-border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
        {packs.map((pack) => (
          <div key={pack.id} className="flex items-center gap-3">
            <Checkbox
              id={pack.id}
              checked={selectedPackIds.includes(pack.id)}
              onCheckedChange={() => handleToggle(pack.id)}
            />
            <Label htmlFor={pack.id} className="cursor-pointer flex-1">
              {pack.name}
            </Label>
          </div>
        ))}
      </div>

      {selectedPackIds.length === 0 && (
        <p className="text-sm text-destructive">
          Selecciona al menos una categoría
        </p>
      )}
    </div>
  );
}
