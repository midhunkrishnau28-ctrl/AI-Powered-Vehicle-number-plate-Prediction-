import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import NewAnalysis from "@/pages/new-analysis";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import ReportDetails from "@/pages/report-details";
import Landing from "@/pages/landing";
import VideoAnalysis from "@/pages/video-analysis";
import NotFound from "@/pages/not-found";

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new" component={NewAnalysis} />
      <Route path="/history" component={History} />
      <Route path="/settings" component={Settings} />
      <Route path="/report/:id" component={ReportDetails} />
      <Route path="/video" component={VideoAnalysis} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
