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
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api-client';
import type { ServiceNowConfig } from '@shared/types';
import { toast } from '@/components/ui/sonner';
import { Save, PlusCircle, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const configSchema = z.object({
  enabled: z.boolean(),
  instanceUrl: z.string().url({ message: 'Please enter a valid URL.' }).or(z.literal('')),
  usernameVar: z.string().min(1, { message: 'Required' }),
  passwordVar: z.string().min(1, { message: 'Required' }),
  outageTable: z.string().min(1, { message: 'Required' }),
  fieldMapping: z.object({
    systemName: z.string().min(1, { message: 'Required' }),
    impactLevel: z.string().min(1, { message: 'Required' }),
    startTime: z.string().min(1, { message: 'Required' }),
    eta: z.string().min(1, { message: 'Required' }),
    description: z.string().min(1, { message: 'Required' }),
    teamsBridgeUrl: z.string(),
  }),
  impactLevelMapping: z.array(z.object({
    servicenowValue: z.string().min(1, { message: 'Required' }),
    dashboardValue: z.enum(['Outage', 'Degradation']),
  })),
  ticketTable: z.string().min(1, { message: 'Required' }),
  ticketFieldMapping: z.object({
    id: z.string().min(1, { message: 'Required' }),
    summary: z.string().min(1, { message: 'Required' }),
    affectedCI: z.string().min(1, { message: 'Required' }),
    status: z.string().min(1, { message: 'Required' }),
    assignedTeam: z.string().min(1, { message: 'Required' }),
    priority: z.string().min(1, { message: 'Required' }),
  }),
}).refine(data => !data.enabled || (data.enabled && data.instanceUrl), {
  message: 'Instance URL is required when enabled.',
  path: ['instanceUrl'],
});
type ConfigFormData = z.infer<typeof configSchema>;
interface ManageServiceNowSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfigUpdate: () => void;
}
export function ManageServiceNowSheet({ isOpen, onOpenChange, onConfigUpdate }: ManageServiceNowSheetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting }, control } = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      impactLevelMapping: [],
    }
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "impactLevelMapping",
  });
  useEffect(() => {
    if (isOpen) {
      const fetchConfig = async () => {
        try {
          setIsLoading(true);
          const config = await api<ServiceNowConfig>('/api/servicenow/config');
          reset(config);
        } catch (error) {
          toast.error('Failed to load ServiceNow configuration.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchConfig();
    }
  }, [isOpen, reset]);
  const onSubmit = async (data: ConfigFormData) => {
    try {
      const config = await api<ServiceNowConfig>('/api/servicenow/config', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      reset(config);
      toast.success('ServiceNow configuration saved.');
      onConfigUpdate();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save configuration.');
    }
  };
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Manage ServiceNow Integration</SheetTitle>
          <SheetDescription>Configure the connection to your ServiceNow instance to pull live outage and ticket data.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="-mx-6 flex-1 px-6 py-4">
            {isLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
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
                  <p className="text-sm text-muted-foreground">Toggle to enable or disable fetching data from ServiceNow.</p>
                </div>
                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="font-semibold">Connection Details</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="instanceUrl">Instance URL</Label>
                      <Input id="instanceUrl" {...register('instanceUrl')} placeholder="https://your-instance.service-now.com" />
                      {errors.instanceUrl && <p className="text-red-500 text-sm mt-1">{errors.instanceUrl.message}</p>}
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
                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="font-semibold">Outage Field Mappings</h4>
                  <p className="text-sm text-muted-foreground">Map dashboard fields to your ServiceNow outage table columns.</p>
                  <div>
                    <Label htmlFor="outageTable">Outage Table Name</Label>
                    <Input id="outageTable" {...register('outageTable')} />
                    {errors.outageTable && <p className="text-red-500 text-sm mt-1">{errors.outageTable.message}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="map.systemName">System Name</Label>
                      <Input id="map.systemName" {...register('fieldMapping.systemName')} />
                      {errors.fieldMapping?.systemName && <p className="text-red-500 text-sm mt-1">{errors.fieldMapping.systemName.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="map.impactLevel">Impact Level (Type Field)</Label>
                      <Input id="map.impactLevel" {...register('fieldMapping.impactLevel')} />
                      {errors.fieldMapping?.impactLevel && <p className="text-red-500 text-sm mt-1">{errors.fieldMapping.impactLevel.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="map.startTime">Start Time</Label>
                      <Input id="map.startTime" {...register('fieldMapping.startTime')} />
                      {errors.fieldMapping?.startTime && <p className="text-red-500 text-sm mt-1">{errors.fieldMapping.startTime.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="map.eta">End Time (ETA)</Label>
                      <Input id="map.eta" {...register('fieldMapping.eta')} />
                      {errors.fieldMapping?.eta && <p className="text-red-500 text-sm mt-1">{errors.fieldMapping.eta.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="map.description">Description</Label>
                      <Input id="map.description" {...register('fieldMapping.description')} />
                      {errors.fieldMapping?.description && <p className="text-red-500 text-sm mt-1">{errors.fieldMapping.description.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="map.teamsBridgeUrl">Teams Bridge URL</Label>
                      <Input id="map.teamsBridgeUrl" {...register('fieldMapping.teamsBridgeUrl')} />
                      {errors.fieldMapping?.teamsBridgeUrl && <p className="text-red-500 text-sm mt-1">{errors.fieldMapping.teamsBridgeUrl.message}</p>}
                    </div>
                  </div>
                </div>
                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="font-semibold">Impact Level Mappings</h4>
                  <p className="text-sm text-muted-foreground">Map ServiceNow 'type' field values to dashboard impact levels.</p>
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label>ServiceNow Value</Label>
                          <Input {...register(`impactLevelMapping.${index}.servicenowValue`)} placeholder="e.g., outage" />
                        </div>
                        <div className="flex-1">
                          <Label>Dashboard Value</Label>
                          <Controller
                            control={control}
                            name={`impactLevelMapping.${index}.dashboardValue`}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Outage">Outage</SelectItem>
                                  <SelectItem value="Degradation">Degradation</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-500 hover:text-red-600">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ servicenowValue: '', dashboardValue: 'Degradation' })} className="gap-2">
                    <PlusCircle className="size-4" /> Add Mapping
                  </Button>
                </div>
                <div className="space-y-4 p-4 border rounded-md">
                  <h4 className="font-semibold">Ticket Field Mappings</h4>
                  <p className="text-sm text-muted-foreground">Map dashboard fields to your ServiceNow ticket table columns (e.g., `incident`).</p>
                  <div>
                    <Label htmlFor="ticketTable">Ticket Table Name</Label>
                    <Input id="ticketTable" {...register('ticketTable')} />
                    {errors.ticketTable && <p className="text-red-500 text-sm mt-1">{errors.ticketTable.message}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ticketMap.id">Ticket ID</Label>
                      <Input id="ticketMap.id" {...register('ticketFieldMapping.id')} />
                      {errors.ticketFieldMapping?.id && <p className="text-red-500 text-sm mt-1">{errors.ticketFieldMapping.id.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="ticketMap.summary">Summary</Label>
                      <Input id="ticketMap.summary" {...register('ticketFieldMapping.summary')} />
                      {errors.ticketFieldMapping?.summary && <p className="text-red-500 text-sm mt-1">{errors.ticketFieldMapping.summary.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="ticketMap.affectedCI">Affected CI</Label>
                      <Input id="ticketMap.affectedCI" {...register('ticketFieldMapping.affectedCI')} />
                      {errors.ticketFieldMapping?.affectedCI && <p className="text-red-500 text-sm mt-1">{errors.ticketFieldMapping.affectedCI.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="ticketMap.status">Status</Label>
                      <Input id="ticketMap.status" {...register('ticketFieldMapping.status')} />
                      {errors.ticketFieldMapping?.status && <p className="text-red-500 text-sm mt-1">{errors.ticketFieldMapping.status.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="ticketMap.assignedTeam">Assigned Team</Label>
                      <Input id="ticketMap.assignedTeam" {...register('ticketFieldMapping.assignedTeam')} />
                      {errors.ticketFieldMapping?.assignedTeam && <p className="text-red-500 text-sm mt-1">{errors.ticketFieldMapping.assignedTeam.message}</p>}
                    </div>
                    <div>
                      <Label htmlFor="ticketMap.priority">Priority</Label>
                      <Input id="ticketMap.priority" {...register('ticketFieldMapping.priority')} />
                      {errors.ticketFieldMapping?.priority && <p className="text-red-500 text-sm mt-1">{errors.ticketFieldMapping.priority.message}</p>}
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