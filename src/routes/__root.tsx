import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { useHydrate } from "@/lib/useHydrate";
import { useSupabaseSync } from "@/lib/sync/useSupabaseSync";
import { useAuth } from "@/lib/auth/useAuth";
import { listenFromExtension, generatePairingCode } from "@/lib/extension/bridge";
import { useStore } from "@/lib/store";
import { LoginPage } from "@/components/auth/LoginPage";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-primary">404</h1>
        <p className="mt-4 text-muted-foreground">No route here.</p>
        <Link to="/" className="mt-6 inline-block text-primary underline">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Something broke</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BTF Setter OS" },
      { name: "description", content: "CRM and AI co-pilot for Behind the Funnel setters." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
      <Toaster theme="dark" />
    </QueryClientProvider>
  );
}

function AuthGate() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const auth = useAuth();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  useHydrate();

  if (auth.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (auth.status === "unauthed") {
    return <LoginPage />;
  }

  return <AuthedShell />;
}

function AuthedShell() {
  useSupabaseSync();
  useExtensionBridge();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur sm:h-16">
            <SidebarTrigger />
            <div className="font-display text-sm font-semibold tracking-tight">
              BTF Setter OS
            </div>
          </header>
          <main className="flex-1 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function useExtensionBridge() {
  const pairingCode = useStore((s) => s.pairingCode);
  const setPairingCode = useStore((s) => s.setPairingCode);
  const setExtensionConnected = useStore((s) => s.setExtensionConnected);
  const upsertThread = useStore((s) => s.upsertLinkedinThread);
  const upsertProfile = useStore((s) => s.upsertLinkedinProfile);
  const setPendingProfileQualification = useStore((s) => s.setPendingProfileQualification);

  useEffect(() => {
    if (!pairingCode) setPairingCode(generatePairingCode());
  }, [pairingCode, setPairingCode]);

  useEffect(() => {
    const off = listenFromExtension((e) => {
      if (e.kind === "ext:hello") {
        if (!e.pairingCode || e.pairingCode === pairingCode) {
          setExtensionConnected(true);
        }
        return;
      }

      if (e.pairingCode && e.pairingCode !== pairingCode) return;

      if (e.kind === "ext:thread") {
        setExtensionConnected(true);
        upsertThread(e.thread);
        return;
      }

      if (e.kind === "ext:profile") {
        setExtensionConnected(true);
        upsertProfile(e.profile);
        const text = [
          e.profile.name,
          e.profile.headline,
          e.profile.currentRole,
          e.profile.location,
          e.profile.about,
          ...(e.profile.recentActivity ?? []),
        ]
          .filter(Boolean)
          .join("\n");

        setPendingProfileQualification({
          text,
          profileUrl: e.profile.profileUrl,
          name: e.profile.name,
          capturedAt: new Date().toISOString(),
        });
        toast.success(`LinkedIn profile captured: ${e.profile.name}`);
      }
    });

    return off;
  }, [pairingCode, setExtensionConnected, setPendingProfileQualification, upsertProfile, upsertThread]);
}
