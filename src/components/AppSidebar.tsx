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
import { useStore } from "@/lib/store";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Prospects", url: "/prospects", icon: Users },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Outreach", url: "/outreach", icon: MessageSquare },
  { title: "LinkedIn", url: "/linkedin", icon: Linkedin },
  { title: "Tools", url: "/tools", icon: Wrench },
  { title: "KPI Tracker", url: "/kpi", icon: TrendingUp },
  { title: "Training", url: "/training", icon: GraduationCap },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
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
        <Link to="/" className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Flame className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-sm font-bold tracking-tight">BTF Setter OS</div>
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
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {item.url === "/linkedin" && extConnected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-success" title="Extension connected" />
                      )}
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
