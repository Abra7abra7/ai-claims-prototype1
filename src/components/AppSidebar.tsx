import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { 
  Home, 
  FileText, 
  Shield, 
  Settings, 
  Database, 
  BarChart3,
  LogOut,
  ChevronDown,
  Users
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);

  const collapsed = state === "collapsed";

  // Keep admin section open if user is on admin page
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) {
      setAdminOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    checkRole();
  }, []);

  const checkRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || "");
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Chyba pri odhlásení",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground";

  const mainItems = [
    { title: "Dashboard", url: "/", icon: Home },
    { title: "Nastavenia", url: "/settings", icon: Settings },
  ];

  const adminItems = [
    { title: "Admin Dashboard", url: "/admin", icon: BarChart3 },
    { title: "Typy analýz", url: "/admin/analysis-types", icon: FileText },
    { title: "Znalostná báza", url: "/admin/knowledge-base", icon: Database },
  ];

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-sidebar-border">
          <Shield className="h-6 w-6 text-sidebar-primary" />
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-foreground">
              Claims System
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 font-semibold">
            Hlavné menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClass}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="w-full flex items-center justify-between hover:bg-sidebar-accent rounded-md px-2 py-1 text-sidebar-foreground/70 font-semibold">
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {!collapsed && "Administrácia"}
                  </span>
                  {!collapsed && (
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        adminOpen ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink to={item.url} className={getNavClass}>
                            <item.icon className="h-4 w-4" />
                            {!collapsed && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                  {userEmail.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate text-sidebar-foreground">{userEmail}</p>
                  <p className="text-xs text-sidebar-foreground/60">
                    {isAdmin ? "Administrátor" : "Likvidátor"}
                  </p>
                </div>
              )}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-sidebar-foreground hover:bg-sidebar-accent">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Odhlásiť sa</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
