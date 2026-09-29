import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({ routeTree, defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: () => <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center"><p className="text-xs uppercase tracking-widest text-primary">404</p><h1 className="display text-3xl font-semibold">Page not found</h1><p className="text-muted-foreground">This page may have moved. Your next session is waiting.</p><a className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground" href="/today">Back to Today</a></main>,
  });
}
