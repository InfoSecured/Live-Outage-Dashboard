import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
const indicatorVariants = cva("size-2.5 rounded-full flex-shrink-0", {
  variants: {
    status: {
      // Vendor Status
      Operational: "bg-green-500",
      Degraded: "bg-yellow-500",
      // Outage Impact
      Outage: "bg-red-600",
      Degradation: "bg-yellow-500",
      // Alert Severity
      Critical: "bg-red-500",
      Warning: "bg-yellow-500",
      Info: "bg-blue-500",
    },
  },
  defaultVariants: {
    status: "Operational",
  },
});
export interface StatusIndicatorProps extends VariantProps<typeof indicatorVariants> {
  children?: React.ReactNode;
  className?: string;
}
export function StatusIndicator({ status, children, className }: StatusIndicatorProps) {
  const statusKey = status || 'Operational';
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(indicatorVariants({ status: statusKey as any }))} />
      {children && <span className="text-sm text-muted-foreground">{children}</span>}
    </div>
  );
}