import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  MessageSquare,
  TrendingUp,
  GraduationCap,
  Settings as SettingsIcon,
  Flame,
  Linkedin,
  Wrench,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { CommissionStrip } from "./CommissionStrip";
import { useStore } from "@/lib/store";

const groups = [
  {
    label: "Today",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
      { title: "Prospects", url: "/prospects", icon: Users },
      { title: "Conversations", url: "/conversations", icon: MessageSquare },
    ],
  },
  {
    label: "Outreach",
    items: [
      { title: "LinkedIn", url: "/linkedin", icon: Linkedin },
      { title: "Scripts", url: "/outreach", icon: MessageSquare },
      { title: "Tools", url: "/tools", icon: Wrench },
    ],
  },
  {
    label: "Performance",
    items: [
      { title: "KPI Tracker", url: "/kpi", icon: TrendingUp },
      { title: "Training", url: "/training", icon: GraduationCap },
    ],
  },
  {
    label: "Account",
    items: [{ title: "Settings", url: "/settings", icon: SettingsIcon }],
  },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const extConnected = useStore((s) => s.extensionConnected);
  const isActive = (u: string) => (u === "/" ? path === "/" : path.startsWith(u));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5 px-2 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-[0_0_20px_-4px_var(--primary)]">
            <Flame className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-sm font-bold tracking-tight">BTF Setter OS</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Operator console
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {item.url === "/linkedin" && extConnected && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_var(--success)]"
                            title="Extension connected"
                          />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-0">
        {!collapsed && <CommissionStrip />}
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
