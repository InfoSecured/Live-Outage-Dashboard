import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api-client';
import type { SolarWindsConfig } from '@shared/types';
import { toast } from '@/components/ui/sonner';
import { Save } from 'lucide-react';
const configSchema = z.object({
  enabled: z.boolean(),
  apiUrl: z.string().url({ message: 'Please enter a valid API URL.' }).or(z.literal('')),
  usernameVar: z.string().min(1, { message: 'Required' }),
  passwordVar: z.string().min(1, { message: 'Required' }),
}).refine(data => !data.enabled || (data.enabled && data.apiUrl), {
  message: 'API URL is required when enabled.',
  path: ['apiUrl'],
});
type ConfigFormData = z.infer<typeof configSchema>;
interface ManageSolarWindsSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfigUpdate: () => void;
}
export function ManageSolarWindsSheet({ isOpen, onOpenChange, onConfigUpdate }: ManageSolarWindsSheetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting }, control } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
  });
  useEffect(() => {
    if (isOpen) {
      const fetchConfig = async () => {
        try {
          setIsLoading(true);
          const config = await api<SolarWindsConfig>('/api/solarwinds/config');
          reset(config);
        } catch (error) {
          toast.error('Failed to load SolarWinds configuration.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchConfig();
    }
  }, [isOpen, reset]);
  const onSubmit = async (data: ConfigFormData) => {
    try {
      const config = await api<SolarWindsConfig>('/api/solarwinds/config', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      reset(config);
      toast.success('SolarWinds configuration saved.');
      onConfigUpdate();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save configuration.');
    }
  };
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Manage SolarWinds Integration</SheetTitle>
          <SheetDescription>Configure the connection to your SolarWinds instance to pull live monitoring alerts.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="-mx-6 flex-1 px-6 py-4">
            {isLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Controller
                      name="enabled"
                      control={control}
                      render={({ field }) => <Switch id="enabled" checked={field.value} onCheckedChange={field.onChange} />}
                    />
                    <Label htmlFor="enabled" className="text-base">Enable Integration</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">Toggle to enable or disable fetching data from SolarWinds.</p>
                </div>
                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="font-semibold">Connection Details</h4>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="apiUrl">API URL</Label>
                      <Input id="apiUrl" {...register('apiUrl')} placeholder="https://your-solarwinds-server:17778" />
                      {errors.apiUrl && <p className="text-red-500 text-sm mt-1">{errors.apiUrl.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="usernameVar">Username Variable Name</Label>
                      <Input id="usernameVar" {...register('usernameVar')} />
                      {errors.usernameVar && <p className="text-red-500 text-sm mt-1">{errors.usernameVar.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="passwordVar">Password Variable Name</Label>
                      <Input id="passwordVar" {...register('passwordVar')} />
                      {errors.passwordVar && <p className="text-red-500 text-sm mt-1">{errors.passwordVar.message}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          <SheetFooter className="mt-auto pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="size-4" />
              {isSubmitting ? 'Saving...' : 'Save Configuration'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}