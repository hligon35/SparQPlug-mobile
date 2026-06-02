import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/providers/auth-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { useAuthStore } from '@/stores/auth-store';

// Layouts
import { AppLayout } from '@/layouts/app-layout';
import { AuthLayout } from '@/layouts/auth-layout';

// Auth screens
import { LoginPage } from '@/pages/auth/login';
import { RegisterPage } from '@/pages/auth/register';

// App screens
import { DashboardPage } from '@/pages/dashboard';
import { ContactsPage } from '@/pages/crm/contacts';
import { ContactDetailPage } from '@/pages/crm/contact-detail';
import { CompaniesPage } from '@/pages/crm/companies';
import { CompanyDetailPage } from '@/pages/crm/company-detail';
import { OpportunitiesPage } from '@/pages/crm/opportunities';
import { ActivitiesPage } from '@/pages/crm/activities';
import { PasswordLockersPage } from '@/pages/crm/password-lockers';
import { AnalyticsPage } from '@/pages/analytics';
import { BillingCustomersPage } from '@/pages/billing/customers';
import { BillingInvoicesPage } from '@/pages/billing/invoices';
import { BillingSubscriptionsPage } from '@/pages/billing/subscriptions';
import { DocumentsPage } from '@/pages/documents';
import { SettingsPage } from '@/pages/settings';
import { NetworkOpsPage } from '@/pages/network-ops/index';
import { NetworkOpsGuidePage } from '@/pages/network-ops/guide';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading SparQPlug…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading SparQPlug…</p>
        </div>
      </div>
    );
  }

  return <Navigate to={user ? '/dashboard' : '/auth/login'} replace />;
}

export default function App() {
  const useHashRouter = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const Router = useHashRouter ? HashRouter : BrowserRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="sparqplug-theme">
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<RootRedirect />} />

              {/* Auth */}
              <Route element={<AuthLayout />}>
                <Route path="/auth/login" element={<LoginPage />} />
                <Route path="/auth/register" element={<RegisterPage />} />
              </Route>

              {/* App */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* CRM */}
                <Route path="/crm/contacts" element={<ContactsPage />} />
                <Route path="/crm/contacts/:id" element={<ContactDetailPage />} />
                <Route path="/crm/companies" element={<CompaniesPage />} />
                <Route path="/crm/companies/:id" element={<CompanyDetailPage />} />
                <Route path="/crm/opportunities" element={<OpportunitiesPage />} />
                <Route path="/crm/activities" element={<ActivitiesPage />} />
                <Route path="/crm/password-lockers" element={<PasswordLockersPage />} />

                {/* Analytics */}
                <Route path="/analytics" element={<AnalyticsPage />} />

                {/* Billing */}
                <Route path="/billing/customers" element={<BillingCustomersPage />} />
                <Route path="/billing/invoices" element={<BillingInvoicesPage />} />
                <Route path="/billing/subscriptions" element={<BillingSubscriptionsPage />} />

                {/* Documents */}
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/documents/:folderId" element={<DocumentsPage />} />

                {/* Network Ops */}
                <Route path="/network-ops" element={<NetworkOpsPage />} />
                <Route path="/network-ops/guide" element={<NetworkOpsGuidePage />} />

                {/* Settings */}
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/:section" element={<SettingsPage />} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <Toaster />
          </AuthProvider>
        </Router>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
