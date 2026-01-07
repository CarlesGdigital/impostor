import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Globe, MapPin, Flame, CheckCircle, XCircle } from 'lucide-react';
import type { MasterCategory } from '@/types/admin';

interface BulkWordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (words: string[], category: MasterCategory) => Promise<{
        success: number;
        failed: { word: string; reason: string }[];
    }>;
}

export function BulkWordDialog({
    open,
    onOpenChange,
    onSave
}: BulkWordDialogProps) {
    const [rawInput, setRawInput] = useState('');
    const [masterCategory, setMasterCategory] = useState<MasterCategory>('general');
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<{
        success: number;
        failed: { word: string; reason: string }[];
    } | null>(null);

    const resetForm = () => {
        setRawInput('');
        setMasterCategory('general');
        setResult(null);
    };

    const parseWords = (input: string): string[] => {
        // Split by comma, trim whitespace, filter empty
        return input
            .split(',')
            .map(w => w.trim())
            .filter(w => w.length > 0);
    };

    const handleSave = async () => {
        const words = parseWords(rawInput);

        if (words.length === 0) {
            setResult({
                success: 0,
                failed: [{ word: '', reason: 'No se han introducido palabras válidas' }]
            });
            return;
        }

        setSaving(true);
        setResult(null);

        try {
            const result = await onSave(words, masterCategory);
            setResult(result);

            // If all succeeded, close after a brief delay
            if (result.failed.length === 0 && result.success > 0) {
                setTimeout(() => {
                    onOpenChange(false);
                    resetForm();
                }, 1500);
            }
        } catch (error) {
            setResult({
                success: 0,
                failed: [{ word: '', reason: 'Error inesperado al guardar' }]
            });
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        resetForm();
    };

    const wordCount = parseWords(rawInput).length;

    const getCategoryIcon = (cat: MasterCategory) => {
        switch (cat) {
            case 'benicolet': return <MapPin className="w-4 h-4" />;
            case 'picantes': return <Flame className="w-4 h-4" />;
            default: return <Globe className="w-4 h-4" />;
        }
    };

    const getCategoryLabel = (cat: MasterCategory) => {
        switch (cat) {
            case 'benicolet': return 'Benicolet';
            case 'picantes': return '🔥 Picantes (+18)';
            default: return 'General';
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Creación masiva de palabras</DialogTitle>
                    <DialogDescription>
                        Introduce las palabras separadas por comas. Ejemplo: casa, perro, montaña
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Palabras (separadas por comas)</Label>
                        <Textarea
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                            placeholder="palabra1, palabra2, palabra3, ..."
                            rows={5}
                            disabled={saving}
                        />
                        <p className="text-sm text-muted-foreground">
                            {wordCount} palabra{wordCount !== 1 ? 's' : ''} detectada{wordCount !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Categoría (para todas las palabras)</Label>
                        <Select
                            value={masterCategory}
                            onValueChange={(v) => setMasterCategory(v as MasterCategory)}
                            disabled={saving}
                        >
                            <SelectTrigger>
                                <SelectValue>
                                    <span className="flex items-center gap-2">
                                        {getCategoryIcon(masterCategory)}
                                        {getCategoryLabel(masterCategory)}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="general">
                                    <span className="flex items-center gap-2">
                                        <Globe className="w-4 h-4" />
                                        General
                                    </span>
                                </SelectItem>
                                <SelectItem value="benicolet">
                                    <span className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4" />
                                        Benicolet
                                    </span>
                                </SelectItem>
                                <SelectItem value="picantes">
                                    <span className="flex items-center gap-2">
                                        <Flame className="w-4 h-4" />
                                        🔥 Picantes (+18)
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Result feedback */}
                    {result && (
                        <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                            {result.success > 0 && (
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="w-5 h-5" />
                                    <span className="font-medium">
                                        {result.success} palabra{result.success !== 1 ? 's' : ''} añadida{result.success !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            )}
                            {result.failed.length > 0 && (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-destructive">
                                        <XCircle className="w-5 h-5" />
                                        <span className="font-medium">
                                            {result.failed.length} error{result.failed.length !== 1 ? 'es' : ''}
                                        </span>
                                    </div>
                                    <ul className="text-sm text-muted-foreground pl-7 space-y-1">
                                        {result.failed.slice(0, 5).map((f, i) => (
                                            <li key={i}>
                                                {f.word ? <strong>"{f.word}"</strong> : ''} {f.reason}
                                            </li>
                                        ))}
                                        {result.failed.length > 5 && (
                                            <li className="text-muted-foreground/70">
                                                ...y {result.failed.length - 5} más
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            onClick={handleSave}
                            disabled={saving || wordCount === 0}
                            className="flex-1"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                `Añadir ${wordCount} palabra${wordCount !== 1 ? 's' : ''}`
                            )}
                        </Button>
                        <Button variant="outline" onClick={handleClose} disabled={saving}>
                            Cerrar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
