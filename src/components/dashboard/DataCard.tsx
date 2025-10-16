import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from '@/lib/utils';
interface DataCardProps {
  title: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}
export function DataCard({ title, icon: Icon, actions, children, className, contentClassName }: DataCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="size-5 text-muted-foreground" />}
          <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
        </div>
        {actions && <div>{actions}</div>}
      </CardHeader>
      <CardContent className={cn("flex-1", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}