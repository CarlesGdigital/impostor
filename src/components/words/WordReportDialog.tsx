import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

interface WordReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardWord: string;
  onSubmit: (reason: string) => Promise<boolean>;
}

const REPORT_REASONS = [
  { value: 'inappropriate', label: 'Contenido inapropiado u ofensivo' },
  { value: 'incorrect', label: 'Información incorrecta o error' },
  { value: 'duplicate', label: 'Palabra duplicada' },
  { value: 'other', label: 'Otro motivo' },
];

export function WordReportDialog({ 
  open, 
  onOpenChange, 
  cardWord,
  onSubmit 
}: WordReportDialogProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const reason = selectedReason === 'other' 
      ? customReason.trim() 
      : REPORT_REASONS.find(r => r.value === selectedReason)?.label || '';
    
    if (!reason) return;
    
    setSubmitting(true);
    const success = await onSubmit(reason);
    setSubmitting(false);
    
    if (success) {
      onOpenChange(false);
      setSelectedReason('');
      setCustomReason('');
    }
  };

  const canSubmit = selectedReason && (selectedReason !== 'other' || customReason.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar: {cardWord}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
            {REPORT_REASONS.map((reason) => (
              <div key={reason.value} className="flex items-center space-x-2">
                <RadioGroupItem value={reason.value} id={reason.value} />
                <Label htmlFor={reason.value} className="cursor-pointer">
                  {reason.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          
          {selectedReason === 'other' && (
            <div className="space-y-2">
              <Label>Describe el problema</Label>
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Explica por qué esta palabra debería revisarse..."
                rows={3}
              />
            </div>
          )}
          
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || submitting}
            className="w-full"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar reporte'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
