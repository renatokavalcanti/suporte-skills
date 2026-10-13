import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Palette, Save } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { LoadingState } from '@/components/feedback';
import { useToast } from '@/components/toast';
import { extractApiError } from '@/services/api';
import { settingsService } from '@/services/settings.service';

export function BrandingSettingsCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    companyName: '',
    primaryColor: '#1d4ed8',
    secondaryColor: '#f3f4f6',
    contactLine: '',
    website: '',
  });
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'branding'],
    queryFn: () => settingsService.getBranding(),
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      companyName: data.companyName,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      contactLine: data.contactLine,
      website: data.website,
    });
    setLogoDataUrl(data.logoDataUrl);
  }, [data]);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['settings', 'branding'] });

  const save = useMutation({
    mutationFn: () =>
      settingsService.updateBranding({
        ...form,
        ...(logoDataUrl ? { logoDataUrl } : {}),
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Identidade visual salva', variant: 'success' });
    },
    onError: (error) =>
      toast({ title: 'Não foi possível salvar', description: extractApiError(error), variant: 'error' }),
  });

  const clearLogo = useMutation({
    mutationFn: () => settingsService.updateBranding({ clearLogo: true }),
    onSuccess: () => {
      setLogoDataUrl(null);
      invalidate();
      toast({ title: 'Logo removida', variant: 'success' });
    },
  });

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-blue-600" />
          Identidade Visual
        </CardTitle>
        <CardDescription>
          Logo e cores usadas no Relatório do Cliente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <LoadingState label="Carregando identidade visual..." />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="b-name">Nome da empresa</Label>
                <Input
                  id="b-name"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-primary">Cor primária</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="b-primary"
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    className="h-9 w-12 rounded border border-slate-300"
                  />
                  <Input
                    value={form.primaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-secondary">Cor secundária</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="b-secondary"
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                    className="h-9 w-12 rounded border border-slate-300"
                  />
                  <Input
                    value={form.secondaryColor}
                    onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-contact">Contatos (rodapé)</Label>
                <Input
                  id="b-contact"
                  value={form.contactLine}
                  onChange={(e) => setForm((f) => ({ ...f, contactLine: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="b-web">Site</Label>
                <Input
                  id="b-web"
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="b-logo">Logo (PNG/JPG/SVG)</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="b-logo"
                    type="file"
                    accept="image/*"
                    onChange={(e) => onFile(e.target.files?.[0])}
                    className="text-sm"
                  />
                  {logoDataUrl && (
                    <>
                      <img src={logoDataUrl} alt="logo" className="max-h-10 max-w-[160px]" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => clearLogo.mutate()}
                      >
                        Remover
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
