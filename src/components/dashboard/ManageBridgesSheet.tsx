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
import type { CollaborationBridge } from '@shared/types';
import { toast } from '@/components/ui/sonner';
import { Trash2, Edit, PlusCircle } from 'lucide-react';
const bridgeSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  participants: z.coerce.number().min(0, { message: 'Participants must be a non-negative number.' }),
  duration: z.string().min(1, { message: 'Duration is required.' }),
  teamsCallUrl: z.string().url({ message: 'Please enter a valid URL.' }),
  isHighSeverity: z.boolean(),
});
type BridgeFormData = z.infer<typeof bridgeSchema>;
interface ManageBridgesSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onBridgesUpdate: () => void;
}
export function ManageBridgesSheet({ isOpen, onOpenChange, onBridgesUpdate }: ManageBridgesSheetProps) {
  const [bridges, setBridges] = useState<CollaborationBridge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBridge, setEditingBridge] = useState<CollaborationBridge | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting }, control } = useForm<BridgeFormData>({
    resolver: zodResolver(bridgeSchema),
    defaultValues: {
      title: '',
      participants: 0,
      duration: '0m',
      teamsCallUrl: '',
      isHighSeverity: false,
    }
  });
  const fetchBridges = async () => {
    try {
      setIsLoading(true);
      const data = await api<CollaborationBridge[]>('/api/collaboration/bridges');
      setBridges(data);
    } catch (error) {
      toast.error('Failed to load collaboration bridges.');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (isOpen) {
      fetchBridges();
    }
  }, [isOpen]);
  const handleSheetClose = () => {
    reset({ title: '', participants: 0, duration: '0m', teamsCallUrl: '', isHighSeverity: false });
    setEditingBridge(null);
    onOpenChange(false);
  };
  const onSubmit = async (data: BridgeFormData) => {
    try {
      if (editingBridge) {
        await api<CollaborationBridge>(`/api/collaboration/bridges/${editingBridge.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        toast.success(`Bridge "${data.title}" updated.`);
      } else {
        await api<CollaborationBridge>('/api/collaboration/bridges', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        toast.success(`Bridge "${data.title}" added.`);
      }
      handleCancelEdit();
      onBridgesUpdate();
      fetchBridges();
    } catch (error) {
      toast.error('An error occurred while saving the bridge.');
    }
  };
  const handleEdit = (bridge: CollaborationBridge) => {
    setEditingBridge(bridge);
    reset(bridge);
  };
  const handleCancelEdit = () => {
    setEditingBridge(null);
    reset({ title: '', participants: 0, duration: '0m', teamsCallUrl: '', isHighSeverity: false });
  };
  const handleDelete = async (bridge: CollaborationBridge) => {
    if (window.confirm(`Are you sure you want to delete "${bridge.title}"?`)) {
      try {
        await api(`/api/collaboration/bridges/${bridge.id}`, { method: 'DELETE' });
        toast.success(`Bridge "${bridge.title}" deleted.`);
        onBridgesUpdate();
        fetchBridges();
      } catch (error) {
        toast.error('Failed to delete bridge.');
      }
    }
  };
  return (
    <Sheet open={isOpen} onOpenChange={handleSheetClose}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Manage Collaboration Bridges</SheetTitle>
          <SheetDescription>Add, edit, or remove active incident collaboration bridges.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="-mx-6 flex-1 px-6">
          <div className="py-4">
            <h3 className="text-lg font-semibold mb-4">{editingBridge ? 'Edit Bridge' : 'Add New Bridge'}</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" {...register('title')} />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="participants">Participants</Label>
                  <Input id="participants" type="number" {...register('participants')} />
                  {errors.participants && <p className="text-red-500 text-sm mt-1">{errors.participants.message}</p>}
                </div>
                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <Input id="duration" {...register('duration')} placeholder="e.g., 45m" />
                  {errors.duration && <p className="text-red-500 text-sm mt-1">{errors.duration.message}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="teamsCallUrl">Teams Call URL</Label>
                <Input id="teamsCallUrl" {...register('teamsCallUrl')} />
                {errors.teamsCallUrl && <p className="text-red-500 text-sm mt-1">{errors.teamsCallUrl.message}</p>}
              </div>
              <div className="flex items-center space-x-2">
                <Controller
                  name="isHighSeverity"
                  control={control}
                  render={({ field }) => <Switch id="isHighSeverity" checked={field.value} onCheckedChange={field.onChange} />}
                />
                <Label htmlFor="isHighSeverity">High Severity Incident</Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  <PlusCircle className="size-4" />
                  {isSubmitting ? 'Saving...' : editingBridge ? 'Update Bridge' : 'Add Bridge'}
                </Button>
                {editingBridge && <Button type="button" variant="outline" onClick={handleCancelEdit}>Cancel</Button>}
              </div>
            </form>
          </div>
          <div className="border-t my-4"></div>
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="text-lg font-semibold mb-4">Existing Bridges</h3>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : (
                bridges.map((bridge) => (
                  <div key={bridge.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
                    <div>
                      <p className="font-medium">{bridge.title}</p>
                      <p className="text-sm text-muted-foreground">{bridge.participants} participants - {bridge.duration}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(bridge)}><Edit className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(bridge)}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </ScrollArea>
        <SheetFooter className="mt-auto pt-4">
          <Button variant="outline" onClick={handleSheetClose}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}