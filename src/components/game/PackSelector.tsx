import { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Globe, Baby, MapPin, Check, Flame, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Pack {
  id: string;
  name: string;
  slug: string;
  master_category?: 'general' | 'ninos' | 'benicolet' | 'picantes';
}

interface PackSelectorProps {
  selectedPackIds: string[];
  onSelectionChange: (packIds: string[]) => void;
}

const STORAGE_KEY = 'topo_preferred_master_category';
const ADULT_CONFIRMED_KEY = 'topo_adult_content_confirmed';

type MasterCategory = 'general' | 'ninos' | 'benicolet' | 'picantes';

export function PackSelector({ selectedPackIds, onSelectionChange }: PackSelectorProps) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaster, setSelectedMaster] = useState<MasterCategory>('general');
  const [showAdultWarning, setShowAdultWarning] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(() => {
    return localStorage.getItem(ADULT_CONFIRMED_KEY) === 'true';
  });
  const { user } = useAuth();

  useEffect(() => {
    loadPacks();
  }, []);

  // Pre-load preference once packs are loaded
  useEffect(() => {
    if (packs.length > 0 && selectedPackIds.length === 0) {
      const stored = localStorage.getItem(STORAGE_KEY) as MasterCategory;
      if (stored && ['general', 'ninos', 'benicolet', 'picantes'].includes(stored)) {
        // Don't auto-select picantes unless confirmed
        if (stored === 'picantes' && !adultConfirmed) {
          selectMasterCategory('general', packs);
        } else {
          selectMasterCategory(stored, packs);
        }
      } else {
        selectMasterCategory('general', packs);
      }
    }
  }, [packs]);

  const loadPacks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('packs')
        .select('id, name, slug, master_category')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setPacks(data as Pack[]);
    } catch (err) {
      console.warn('[PackSelector] Error loading packs', err);
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
    // 1. DB Column
    const explicitCat = pack.master_category;
    if (explicitCat && ['general', 'ninos', 'benicolet', 'picantes'].includes(explicitCat)) {
      return explicitCat as MasterCategory;
    }

    // 2. Heuristic Fallback
    const s = (pack.slug || '').toLowerCase();
    const n = (pack.name || '').toLowerCase();

    if (s.includes('picante') || n.includes('picante') || s.includes('adulto') || n.includes('adulto') || 
        s.includes('spicy') || n.includes('+18')) return 'picantes';
    if (s.includes('benicolet') || n.includes('benicolet')) return 'benicolet';
    if (s.includes('nino') || s.includes('infantil') || s.includes('kid') ||
      n.includes('niño') || n.includes('infantil')) {
      return 'ninos';
    }

    return 'general';
  };

  // Group packs
  const packsByCategory = useMemo(() => {
    const groups: Record<MasterCategory, Pack[]> = {
      general: [],
      ninos: [],
      benicolet: [],
      picantes: []
    };

    packs.forEach(p => {
      const cat = getPackCategory(p);
      if (groups[cat]) groups[cat].push(p);
      else groups['general'].push(p);
    });

    return groups;
  }, [packs]);

  const selectMasterCategory = (category: MasterCategory, currentPacks = packs) => {
    // If selecting picantes and not confirmed, show warning
    if (category === 'picantes' && !adultConfirmed) {
      setShowAdultWarning(true);
      return;
    }

    setSelectedMaster(category);
    localStorage.setItem(STORAGE_KEY, category);

    // Auto-select all packs in this category
    const categoryPacks = currentPacks.filter(p => getPackCategory(p) === category);
    onSelectionChange(categoryPacks.map(p => p.id));
  };

  const handleAdultConfirm = () => {
    setAdultConfirmed(true);
    localStorage.setItem(ADULT_CONFIRMED_KEY, 'true');
    setShowAdultWarning(false);
    
    // Now actually select picantes
    setSelectedMaster('picantes');
    localStorage.setItem(STORAGE_KEY, 'picantes');
    const categoryPacks = packs.filter(p => getPackCategory(p) === 'picantes');
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
      {/* Adult content warning dialog */}
      <AlertDialog open={showAdultWarning} onOpenChange={setShowAdultWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Contenido +18
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>
                La sección <strong>"Picantes"</strong> contiene palabras con humor adulto, 
                doble sentido y contenido que puede no ser apropiado para menores.
              </p>
              <p className="font-medium">
                Al continuar, confirmas que todos los jugadores son mayores de 18 años.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAdultConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Soy mayor de 18
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        <MasterTile
          icon={<Flame className="w-6 h-6" />}
          label="Picantes"
          count={packsByCategory.picantes.length}
          active={selectedMaster === 'picantes'}
          onClick={() => selectMasterCategory('picantes')}
          variant="spicy"
          badge="+18"
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

interface MasterTileProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  variant?: 'default' | 'spicy';
  badge?: string;
}

function MasterTile({ icon, label, count, active, onClick, variant = 'default', badge }: MasterTileProps) {
  const isSpicy = variant === 'spicy';
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all relative overflow-hidden h-24",
        active
          ? isSpicy 
            ? "border-destructive bg-destructive/10 shadow-md scale-[1.02]"
            : "border-primary bg-primary/5 shadow-md scale-[1.02]"
          : isSpicy
            ? "border-destructive/30 bg-card hover:border-destructive/50 hover:bg-destructive/5"
            : "border-border bg-card hover:border-primary/50 hover:bg-muted"
      )}
    >
      {active && (
        <div className={cn("absolute top-1 right-1", isSpicy ? "text-destructive" : "text-primary")}>
          <Check className="w-4 h-4" />
        </div>
      )}
      {badge && (
        <div className="absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">
          {badge}
        </div>
      )}
      <div className={cn("mb-2", active ? (isSpicy ? "text-destructive" : "text-primary") : "text-muted-foreground")}>
        {icon}
      </div>
      <span className={cn("font-bold text-sm", active ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </button>
  );
}