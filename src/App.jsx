import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
const PageNotFound = lazy(() => import('./lib/PageNotFound'));
const Home = lazy(() => import('./pages/Home'));
const Logbook = lazy(() => import('./pages/Logbook'));
const Progress = lazy(() => import('./pages/Progress'));
const Chat = lazy(() => import('./pages/Chat'));
const Notifications = lazy(() => import('./pages/Notifications'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ProfileSetup = lazy(() => import('./pages/ProfileSetup'));
const Profile = lazy(() => import('./pages/Profile'));
const DoctorDirectory = lazy(() => import('./pages/DoctorDirectory'));
const JoinDoctor = lazy(() => import('./pages/JoinDoctor'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, user } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Routes a visitor can reach without an authenticated session.
  const PUBLIC_ROUTES = ['/login', '/signup', '/join', '/privacy-policy', '/terms-and-conditions'];

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to the in-app login page unless we're already on a public route,
      // in which case fall through so <Routes> can render the page itself.
      if (!PUBLIC_ROUTES.includes(location.pathname)) {
        return <Navigate to="/login" replace />;
      }
    }
  }

  // No active session in this browser. Send the visitor to login instead of
  // letting the data-heavy pages render and fail on every API call. Public/legal/join
  // routes are left to render or handle their own auth redirect.
  if (!user && !PUBLIC_ROUTES.includes(location.pathname)) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to setup if profile is not complete (explicitly false, not null —
  // protects existing users who never had profile_complete set from being
  // forced through setup). They are not already on login/signup/setup.
  if (user && user.profile_complete === false &&
      !['/setup', '/login', '/signup'].includes(location.pathname)) {
    return <Navigate to="/setup" replace />;
  }

  // Render the main app
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/setup" element={<ProfileSetup />} />
      <Route path="/join" element={<JoinDoctor />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/logbook" element={<Logbook />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:convId" element={<Chat />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="/patient-detail" element={<PatientDetail />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/find-doctor" element={<DoctorDirectory />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster richColors position="top-center" />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App