import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import PageTransition from "@/components/PageTransition";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  MessageCircle,
  Users,
  Bell,
  LogOut,
  Menu,
  X,
  Heart,
  Shield,
  UserCircle } from
"lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const patientNav = [
{ path: "/", label: "Dashboard", icon: LayoutDashboard },
{ path: "/logbook", label: "Logbook", icon: BookOpen },
{ path: "/progress", label: "Progress", icon: TrendingUp },
{ path: "/chat", label: "Chat", icon: MessageCircle },
{ path: "/notifications", label: "Alerts", icon: Bell },
{ path: "/profile", label: "Profile", icon: UserCircle }];


const doctorNav = [
{ path: "/doctor", label: "Patients", icon: Users },
{ path: "/chat", label: "Messages", icon: MessageCircle },
{ path: "/notifications", label: "Alerts", icon: Bell },
{ path: "/profile", label: "Profile", icon: UserCircle }];


const adminNav = [
{ path: "/admin", label: "Admin", icon: Shield },
{ path: "/doctor", label: "Patients", icon: Users },
{ path: "/notifications", label: "Alerts", icon: Bell },
{ path: "/profile", label: "Profile", icon: UserCircle }];


export default function Layout() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const scrollPositions = useRef({});

  // Save scroll position when leaving, restore when returning
  useEffect(() => {
    const mainEl = document.getElementById("main-scroll");
    if (!mainEl) return;
    // Restore saved position for new route
    const saved = scrollPositions.current[location.pathname] ?? 0;
    mainEl.scrollTop = saved;
    // Save scroll on scroll events
    const handleScroll = () => {
      scrollPositions.current[location.pathname] = mainEl.scrollTop;
    };
    mainEl.addEventListener("scroll", handleScroll, { passive: true });
    return () => mainEl.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) loadNotifications();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = base44.entities.Notification.subscribe((event) => {
      if (event.type === "create" && event.data?.user_email === user.email) {
        const n = event.data;
        toast(n.title, { description: n.message });
        setUnreadCount((c) => c + 1);
      }
    });
    return unsubscribe;
  }, [user]);

  const loadUser = async () => {
    const me = await base44.auth.me();
    setUser(me);
  };

  const loadNotifications = async () => {
    try {
      const notifs = await base44.entities.Notification.filter({ user_email: user.email, is_read: false });
      setUnreadCount(notifs.length);
    } catch {setUnreadCount(0);}
  };

  const ADMIN_EMAIL = "sujith@guduchiayurveda";

  const getNavItems = () => {
    if (!user) return patientNav;
    if (user.email?.includes(ADMIN_EMAIL)) return adminNav;
    if (user.role === "doctor") return doctorNav;
    return patientNav;
  };

  const navItems = getNavItems();

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'calc(0.75rem + var(--safe-top))' }}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}>
            
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center hidden">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-lg hidden sm:block">Guduchi DRP</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user &&
          <div className="text-right mr-2 hidden sm:block">
              <p className="text-sm font-medium">{user.full_name || "User"}</p>
              <p className="text-xs text-muted-foreground capitalize">{user.role || "patient"}</p>
            </div>
          }
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card/50 p-4 gap-1 select-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all select-none ${
                active ?
                "bg-primary text-primary-foreground shadow-sm" :
                "text-muted-foreground hover:text-foreground hover:bg-muted"}`
                }>
                
                <Icon className="h-4 w-4" />
                {item.label}
                {item.path === "/notifications" && unreadCount > 0 &&
                <Badge variant="destructive" className="ml-auto text-xs h-5 w-5 p-0 flex items-center justify-center">
                    {unreadCount}
                  </Badge>
                }
              </Link>);

          })}
        </aside>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen &&
        <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card p-4 pt-20 flex flex-col gap-1 shadow-xl">
              {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ?
                  "bg-primary text-primary-foreground shadow-sm" :
                  "text-muted-foreground hover:text-foreground hover:bg-muted"}`
                  }>
                  
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {item.path === "/notifications" && unreadCount > 0 &&
                  <Badge variant="destructive" className="ml-auto text-xs h-5 w-5 p-0 flex items-center justify-center">
                        {unreadCount}
                      </Badge>
                  }
                  </Link>);

            })}
            </aside>
          </div>
        }

        {/* Main Content */}
        <main className="flex-1 overflow-auto" id="main-scroll">
          <div className="max-w-5xl mx-auto p-4 md:p-6 pb-24 md:pb-6">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border px-2 pt-1 z-30 select-none" style={{ paddingBottom: 'calc(0.25rem + var(--safe-bottom))' }}>
        <div className="flex justify-around">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  if (active) {
                    // Reset scroll to top when tapping the active tab
                    const mainEl = document.getElementById("main-scroll");
                    if (mainEl) mainEl.scrollTop = 0;
                  } else {
                    navigate(item.path);
                  }
                }}
                className={`flex flex-col items-center py-1.5 px-2 min-h-[44px] justify-center rounded-lg text-xs transition-all select-none ${
                active ? "text-primary" : "text-muted-foreground"}`
                }>
                
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.path === "/notifications" && unreadCount > 0 &&
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full" />
                  }
                </div>
                <span className="mt-0.5">{item.label}</span>
              </button>);

          })}
        </div>
      </nav>
    </div>);

}