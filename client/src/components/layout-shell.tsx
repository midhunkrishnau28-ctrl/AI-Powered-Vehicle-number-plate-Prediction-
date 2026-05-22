import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  ShieldCheck,
  LayoutDashboard,
  PlusCircle,
  History,
  LogOut,
  User,
  Menu,
  X,
  Video
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface LayoutShellProps {
  children: React.ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/new", label: "Image Analysis", icon: PlusCircle },
    { href: "/video", label: "Video Analysis", icon: Video },
    { href: "/history", label: "History", icon: History },
    { href: "/settings", label: "Account Settings", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shadow-lg z-20">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg shadow-lg shadow-primary/30">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">KERALA POLICE</h1>
            <p className="text-xs text-muted-foreground font-mono">INTELLIGENCE WING</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border overflow-hidden">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.username || "Officer"}
              </p>
              <p className="text-xs text-muted-foreground truncate">ID: {user?.username || "Unknown"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Link href="/settings">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 border-border hover:bg-muted"
              >
                <User className="w-4 h-4" />
                Settings
              </Button>
            </Link>

            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => logout()}
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <span className="font-bold">KERALA POLICE</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-card border-b border-border overflow-hidden"
          >
            <nav className="p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="w-5 h-5 text-primary" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
              <div className="pt-2 border-t border-border mt-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-destructive"
                  onClick={() => logout()}
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background/50 relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
        <div className="max-w-7xl mx-auto p-4 md:p-8 relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
