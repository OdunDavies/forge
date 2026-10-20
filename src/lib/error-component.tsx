import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
export function AppErrorComponent({ reset }: ErrorComponentProps) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
    <TriangleAlert className="size-10 text-primary" aria-hidden="true" />
    <h1 className="display text-2xl font-semibold">Something went wrong</h1>
    <p className="max-w-md text-sm text-muted-foreground">We couldn't load this page. Please try again.</p>
    <div className="flex gap-3"><Button onClick={reset}>Try again</Button><Button variant="outline" asChild><a href="/today">Back to Today</a></Button></div>
  </main>;
}
