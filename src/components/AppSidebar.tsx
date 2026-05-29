import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  MessageSquare,
  Inbox,
  TrendingUp,
  BarChart3,
  GraduationCap,
  Settings as SettingsIcon,
  Flame,
  Linkedin,
  Wrench,
  AlarmClock,
  LogOut,
  BookOpen,
  CheckCircle2,
  Mic,
  Tags,
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
import { getDueFollowUps } from "@/lib/followups";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "Today",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "On Deck", url: "/on-deck", icon: AlarmClock },
      { title: "Inbox", url: "/inbox", icon: Inbox },
      { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
      { title: "GHL Claims", url: "/ghl-claims", icon: CheckCircle2 },
      { title: "Prospects", url: "/prospects", icon: Users },
    ],
  },
  {
    label: "Outreach",
    items: [
      { title: "LinkedIn", url: "/linkedin", icon: Linkedin },
      { title: "Templates", url: "/outreach", icon: MessageSquare },
      { title: "Tools", url: "/tools", icon: Wrench },
      { title: "VN Vault", url: "/vn-vault", icon: Mic },
      { title: "Keyword Bank", url: "/keywords", icon: Tags },
    ],
  },
  {
    label: "Performance",
    items: [
      { title: "KPI Tracker", url: "/kpi", icon: TrendingUp },
      { title: "Analytics", url: "/analytics", icon: BarChart3 },
      { title: "Training", url: "/training", icon: GraduationCap },
      { title: "Playbook", url: "/playbook", icon: BookOpen },
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
  const prospects = useStore((s) => s.prospects);
  const dueCount = useMemo(() => getDueFollowUps(prospects).length, [prospects]);
  const unclaimedGhl = useMemo(
    () => prospects.filter((p) => p.stage === "Call Booked" && !p.ghlClaimed).length,
    [prospects],
  );
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
                        {item.url === "/on-deck" && dueCount > 0 && (
                          <span
                            className={cn(
                              "grid place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground",
                              collapsed ? "h-1.5 w-1.5 p-0" : "h-4 min-w-4",
                            )}
                            title={`${dueCount} follow-up${dueCount > 1 ? "s" : ""} due`}
                          >
                            {!collapsed && dueCount}
                          </span>
                        )}
                        {(item.url === "/pipeline" || item.url === "/ghl-claims") && unclaimedGhl > 0 && (
                          <span
                            className={cn(
                              "grid place-items-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold leading-none text-amber-50",
                              collapsed ? "h-1.5 w-1.5 p-0" : "h-4 min-w-4",
                            )}
                            title={`${unclaimedGhl} unclaimed GHL call${unclaimedGhl > 1 ? "s" : ""}`}
                          >
                            {!collapsed && unclaimedGhl}
                          </span>
                        )}
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
