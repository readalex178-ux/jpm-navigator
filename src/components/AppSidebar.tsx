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
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { CommissionStrip } from "./CommissionStrip";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Prospects", url: "/prospects", icon: Users },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Outreach", url: "/outreach", icon: MessageSquare },
  { title: "KPI Tracker", url: "/kpi", icon: TrendingUp },
  { title: "Training", url: "/training", icon: GraduationCap },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (u: string) => (u === "/" ? path === "/" : path.startsWith(u));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Flame className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-sm font-bold tracking-tight">BTF Setter OS</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                JPM Media
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-0">
        {!collapsed && <CommissionStrip />}
      </SidebarFooter>
    </Sidebar>
  );
}
