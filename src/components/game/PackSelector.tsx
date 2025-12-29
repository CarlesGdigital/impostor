import { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, FolderOpen, Globe, Baby, MapPin, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Pack {
  id: string;
  name: string;
  slug: string;
  master_category?: 'general' | 'ninos' | 'benicolet';
}

interface PackSelectorProps {
  selectedPackIds: string[];
  onSelectionChange: (packIds: string[]) => void;
}

const STORAGE_KEY = 'topo_preferred_master_category';

type MasterCategory = 'general' | 'ninos' | 'benicolet';

export function PackSelector({ selectedPackIds, onSelectionChange }: PackSelectorProps) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaster, setSelectedMaster] = useState<MasterCategory>('general');
  const [useHeuristic, setUseHeuristic] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadPacks();
  }, []);

  // Pre-load preference once packs are loaded
  useEffect(() => {
    if (packs.length > 0 && selectedPackIds.length === 0) {
      const stored = localStorage.getItem(STORAGE_KEY) as MasterCategory;
      if (stored && ['general', 'ninos', 'benicolet'].includes(stored)) {
        selectMasterCategory(stored, packs);
      } else {
        selectMasterCategory('general', packs);
      }
    }
  }, [packs]); // Run only when packs load

  const loadPacks = async () => {
    setLoading(true);
    try {
      // Try to fetch with master_category column
      // We use 'as any' casting to bypass TS check if type gen isn't updated, 
      // but catch block handles runtime error if column missing
      const { data, error } = await supabase
        .from('packs')
        .select('id, name, slug, master_category')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setPacks(data as Pack[]);
    } catch (err) {
      console.warn('[PackSelector] master_category column potentially missing, falling back to heuristics', err);
      // Fallback: fetch without column
      setUseHeuristic(true);
      const { data } = await supabase
        .from('packs')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');
      setPacks((data || []) as Pack[]);
    } finally {
      setLoading(false);
    }
  };

  const getPackCategory = (pack: Pack): MasterCategory => {
    // 1. DB Column (if available and not heuristic fallback)
    if (!useHeuristic && pack.master_category) {
      if (pack.master_category === 'adultos' as any) return 'ninos'; // Handle legacy
      return pack.master_category;
    }

    // 2. Heuristic Fallback
    const s = (pack.slug || '').toLowerCase();
    const n = (pack.name || '').toLowerCase();

    if (s.includes('benicolet') || n.includes('benicolet')) return 'benicolet';
    if (s.includes('nino') || s.includes('infantil') || s.includes('kid') ||
      n.includes('niño') || n.includes('infantil')) {
      return 'ninos';
    }

    // Default
    return 'general';
  };

  // Group packs
  const packsByCategory = useMemo(() => {
    const groups: Record<MasterCategory, Pack[]> = {
      general: [],
      ninos: [],
      benicolet: []
    };

    packs.forEach(p => {
      const cat = getPackCategory(p);
      if (groups[cat]) groups[cat].push(p);
      else groups['general'].push(p); // Fallback safety
    });

    return groups;
  }, [packs, useHeuristic]);

  const selectMasterCategory = (category: MasterCategory, currentPacks = packs) => {
    setSelectedMaster(category);
    localStorage.setItem(STORAGE_KEY, category);

    // Auto-select all packs in this category
    const categoryPacks = currentPacks.filter(p => getPackCategory(p) === category);
    onSelectionChange(categoryPacks.map(p => p.id));
  };

  const handleTogglePack = (packId: string) => {
    const newSelection = selectedPackIds.includes(packId)
      ? selectedPackIds.filter(id => id !== packId)
      : [...selectedPackIds, packId];
    onSelectionChange(newSelection);
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

  const currentCategoryPacks = packsByCategory[selectedMaster] || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <MasterTile
          icon={<Globe className="w-6 h-6" />}
          label="General"
          count={packsByCategory.general.length}
          active={selectedMaster === 'general'}
          onClick={() => selectMasterCategory('general')}
        />
        <MasterTile
          icon={<Baby className="w-6 h-6" />}
          label="Niños"
          count={packsByCategory.ninos.length}
          active={selectedMaster === 'ninos'}
          onClick={() => selectMasterCategory('ninos')}
        />
        <MasterTile
          icon={<MapPin className="w-6 h-6" />}
          label="Benicolet"
          count={packsByCategory.benicolet.length}
          active={selectedMaster === 'benicolet'}
          onClick={() => selectMasterCategory('benicolet')}
        />
      </div>

      <div className="bg-card border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Se usarán <span className="font-bold text-foreground">{selectedPackIds.length}</span> packs de esta sección.
          </p>
          <p className="text-xs text-muted-foreground">
            {currentCategoryPacks.length > 0 && selectedPackIds.length === 0 && 'Ninguno seleccionado'}
          </p>
        </div>

        <Accordion type="single" collapsible>
          <AccordionItem value="details" className="border-0">
            <AccordionTrigger className="py-2 text-sm hover:no-underline hover:bg-muted/50 rounded px-2">
              Ver categorías incluidas
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2">
                {currentCategoryPacks.map((pack) => (
                  <div key={pack.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
                    <Checkbox
                      id={pack.id}
                      checked={selectedPackIds.includes(pack.id)}
                      onCheckedChange={() => handleTogglePack(pack.id)}
                    />
                    <Label htmlFor={pack.id} className="cursor-pointer flex-1 text-sm">
                      {pack.name}
                    </Label>
                  </div>
                ))}
                {currentCategoryPacks.length === 0 && (
                  <div className="col-span-2 text-center py-4 text-muted-foreground text-sm">
                    No hay packs en esta sección.
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}

function MasterTile({ icon, label, count, active, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all relative overflow-hidden h-24",
        active
          ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
          : "border-border bg-card hover:border-primary/50 hover:bg-muted"
      )}
    >
      {active && (
        <div className="absolute top-1 right-1 text-primary">
          <Check className="w-4 h-4" />
        </div>
      )}
      <div className={cn("mb-2", active ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </div>
      <span className={cn("font-bold text-sm", active ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      {/* <span className="text-[10px] text-muted-foreground mt-0.5">{count}</span> */}
    </button>
  )
}
