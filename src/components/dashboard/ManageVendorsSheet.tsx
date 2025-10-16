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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api-client';
import type { Vendor, VendorStatusType } from '@shared/types';
import { toast } from '@/components/ui/sonner';
import { Trash2, Edit, PlusCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const vendorSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  url: z.string().url({ message: 'Please enter a valid URL.' }),
  statusType: z.enum(['API_JSON', 'MANUAL']),
  apiUrl: z.string().url().optional().or(z.literal('')),
  jsonPath: z.string().optional(),
  expectedValue: z.string().optional(),
}).refine(data => {
  if (data.statusType === 'API_JSON') {
    return !!data.apiUrl && !!data.jsonPath && !!data.expectedValue;
  }
  return true;
}, {
  message: 'API URL, JSON Path, and Expected Value are required for API_JSON type.',
  path: ['apiUrl'], // You can associate the error with a specific field
});
type VendorFormData = z.infer<typeof vendorSchema>;
interface ManageVendorsSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onVendorsUpdate: () => void;
}
export function ManageVendorsSheet({ isOpen, onOpenChange, onVendorsUpdate }: ManageVendorsSheetProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting }, control, watch } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      statusType: 'MANUAL',
      apiUrl: '',
      jsonPath: '',
      expectedValue: '',
    }
  });
  const statusType = watch('statusType');
  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      const data = await api<Vendor[]>('/api/vendors');
      setVendors(data);
    } catch (error) {
      toast.error('Failed to load vendors.');
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    if (isOpen) {
      fetchVendors();
    }
  }, [isOpen]);
  const handleSheetClose = () => {
    reset({ name: '', url: '', statusType: 'MANUAL', apiUrl: '', jsonPath: '', expectedValue: '' });
    setEditingVendor(null);
    onOpenChange(false);
  };
  const onSubmit = async (data: VendorFormData) => {
    try {
      const payload = {
        ...data,
        apiUrl: data.statusType === 'API_JSON' ? data.apiUrl : null,
        jsonPath: data.statusType === 'API_JSON' ? data.jsonPath : null,
        expectedValue: data.statusType === 'API_JSON' ? data.expectedValue : null,
      };
      if (editingVendor) {
        await api<Vendor>(`/api/vendors/${editingVendor.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success(`Vendor "${data.name}" updated.`);
      } else {
        await api<Vendor>('/api/vendors', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success(`Vendor "${data.name}" added.`);
      }
      reset({ name: '', url: '', statusType: 'MANUAL', apiUrl: '', jsonPath: '', expectedValue: '' });
      setEditingVendor(null);
      onVendorsUpdate();
      fetchVendors();
    } catch (error) {
      toast.error('An error occurred.');
    }
  };
  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    reset({
      name: vendor.name,
      url: vendor.url,
      statusType: vendor.statusType,
      apiUrl: vendor.apiUrl || '',
      jsonPath: vendor.jsonPath || '',
      expectedValue: vendor.expectedValue || '',
    });
  };
  const handleCancelEdit = () => {
    setEditingVendor(null);
    reset({ name: '', url: '', statusType: 'MANUAL', apiUrl: '', jsonPath: '', expectedValue: '' });
  };
  const handleDelete = async (vendor: Vendor) => {
    if (window.confirm(`Are you sure you want to delete "${vendor.name}"?`)) {
      try {
        await api(`/api/vendors/${vendor.id}`, { method: 'DELETE' });
        toast.success(`Vendor "${vendor.name}" deleted.`);
        onVendorsUpdate();
        fetchVendors();
      } catch (error) {
        toast.error('Failed to delete vendor.');
      }
    }
  };
  return (
    <Sheet open={isOpen} onOpenChange={handleSheetClose}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Manage Vendors</SheetTitle>
          <SheetDescription>Add, edit, or remove vendor status pages.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="-mx-6 flex-1 px-6">
          <div className="py-4">
            <h3 className="text-lg font-semibold mb-4">{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Vendor Name</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="url">Status Page URL</Label>
                <Input id="url" {...register('url')} placeholder="https://status.example.com" />
                {errors.url && <p className="text-red-500 text-sm mt-1">{errors.url.message}</p>}
              </div>
              <div>
                <Label htmlFor="statusType">Status Check Type</Label>
                <Select onValueChange={(value: VendorStatusType) => reset({ ...watch(), statusType: value })} value={statusType}>
                  <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manual</SelectItem>
                    <SelectItem value="API_JSON">API (JSON)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {statusType === 'API_JSON' && (
                <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                  <div>
                    <Label htmlFor="apiUrl">API URL</Label>
                    <Input id="apiUrl" {...register('apiUrl')} placeholder="https://api.example.com/status.json" />
                    {errors.apiUrl && <p className="text-red-500 text-sm mt-1">{errors.apiUrl.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="jsonPath">JSON Path</Label>
                    <Input id="jsonPath" {...register('jsonPath')} placeholder="status.indicator" />
                    {errors.jsonPath && <p className="text-red-500 text-sm mt-1">{errors.jsonPath.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="expectedValue">Expected Value (Operational)</Label>
                    <Input id="expectedValue" {...register('expectedValue')} placeholder="none" />
                    {errors.expectedValue && <p className="text-red-500 text-sm mt-1">{errors.expectedValue.message}</p>}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  <PlusCircle className="size-4" />
                  {isSubmitting ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Add Vendor'}
                </Button>
                {editingVendor && <Button type="button" variant="outline" onClick={handleCancelEdit}>Cancel</Button>}
              </div>
            </form>
          </div>
          <div className="border-t my-4"></div>
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="text-lg font-semibold mb-4">Existing Vendors</h3>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
              ) : (
                vendors.map((vendor) => (
                  <div key={vendor.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
                    <div>
                      <p className="font-medium">{vendor.name}</p>
                      <a href={vendor.url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:underline truncate max-w-[200px] sm:max-w-xs block">{vendor.url}</a>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(vendor)}><Edit className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(vendor)}><Trash2 className="size-4" /></Button>
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