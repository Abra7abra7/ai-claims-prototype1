import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ClaimDetail from "./pages/ClaimDetail";
import DocumentProcessor from "./pages/DocumentProcessor";
import ReportView from "./pages/ReportView";
import BatchProcess from "./pages/BatchProcess";
import FinalReport from "./pages/FinalReport";
import AdminAnalysisTypes from "./pages/AdminAnalysisTypes";
import AdminDashboard from "./pages/AdminDashboard";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Načítavam...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/claim/:id"
            element={
              <ProtectedRoute>
                <ClaimDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/claim/:id/document/:docId"
            element={
              <ProtectedRoute>
                <DocumentProcessor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/claim/:id/document/:docId/report"
            element={
              <ProtectedRoute>
                <ReportView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/claim/:id/batch-process"
            element={
              <ProtectedRoute>
                <BatchProcess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/claim/:id/final-report"
            element={
              <ProtectedRoute>
                <FinalReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analysis-types"
            element={
              <ProtectedRoute>
                <AdminAnalysisTypes />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
