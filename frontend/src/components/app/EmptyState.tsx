import React from "react";
import { Card } from "@/components/ui/card";

export default function EmptyState({ icon: Icon, title, description, action, testId }) {
  return (
    <Card
      data-testid={testId}
      className="flex h-full flex-col items-center justify-center gap-3 border-dashed bg-card/60 p-8 text-center"
    >
      {Icon && (
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="font-display text-base font-semibold">{title}</p>
      {description && (
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action}
    </Card>
  );
}
