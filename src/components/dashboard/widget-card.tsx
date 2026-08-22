import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type WidgetCardProps = {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  delta?: string;
  deltaPositive?: boolean | null;
  className?: string;
};

export function WidgetCard({
  label,
  value,
  icon,
  delta,
  deltaPositive,
  className,
}: WidgetCardProps) {
  return (
    <Card className={cn("py-3", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {icon ? (
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {delta ? (
          <p
            className={cn(
              "mt-1 text-xs",
              deltaPositive === true && "text-emerald-600",
              deltaPositive === false && "text-destructive",
              deltaPositive == null && "text-muted-foreground"
            )}
          >
            {delta}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function WidgetCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("py-3", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="size-4 rounded" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}
