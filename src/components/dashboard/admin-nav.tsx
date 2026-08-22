"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  FileText,
  Wallet,
  Calendar,
  Bell,
  Eye,
  Search,
} from "lucide-react";

import type { Role } from "@/lib/auth/rbac";
import { canAccessDashboard } from "@/lib/auth/rbac";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const overviewGroup: { label: string; items: NavItem[] } = {
  label: "Overview",
  items: [{ title: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard }],
};

const academicsGroup: { label: string; items: NavItem[] } = {
  label: "Academics",
  items: [
    { title: "Students", href: "/dashboard/admin/students", icon: Users },
    { title: "Teachers", href: "/dashboard/admin/teachers", icon: GraduationCap },
    { title: "Courses", href: "/dashboard/admin/courses", icon: BookOpen },
    { title: "Attendance", href: "/dashboard/admin/attendance", icon: ClipboardCheck },
    { title: "Exams", href: "/dashboard/admin/exams", icon: FileText },
  ],
};

const operationsGroup: { label: string; items: NavItem[] } = {
  label: "Operations",
  items: [
    { title: "Fees", href: "/dashboard/admin/fees", icon: Wallet },
    { title: "Timetable", href: "/dashboard/admin/timetable", icon: Calendar },
    { title: "Notifications", href: "/dashboard/admin/notifications", icon: Bell },
  ],
};

const viewerItems: NavItem[] = [
  { title: "Viewer", href: "/dashboard/viewer", icon: Eye },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function DashboardSidebar({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const canAdmin = canAccessDashboard(role, "admin");

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex h-10 items-center gap-2 px-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LayoutDashboard className="size-4" />
          </div>
          <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
            University ERP
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Viewer */}
        <SidebarGroup>
          <SidebarGroupLabel>Viewer</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {viewerItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(pathname, item.href)}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/search" />}
                  tooltip="Search"
                >
                  <Search />
                  <span>Search</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin groups — only render if role can access admin; still render disabled state for viewer to hint */}
        {canAdmin ? (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>{overviewGroup.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {overviewGroup.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive(pathname, item.href)}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>{academicsGroup.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {academicsGroup.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive(pathname, item.href)}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>{operationsGroup.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {operationsGroup.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive(pathname, item.href)}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                Admin access requires <code>admin</code> role. You are viewing as{" "}
                <span className="font-medium">{role ?? "viewer"}</span>.
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-2 text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">
          base-nova · dashboard-01
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// Re-export as AdminNav for plan compatibility
export const AdminNav = DashboardSidebar;
