import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import PatientDashboard from './pages/PatientDashboard';
import Logbook from './pages/Logbook';
import Progress from './pages/Progress';
import Chat from './pages/Chat';
import Notifications from './pages/Notifications';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientDetail from './pages/PatientDetail';
import AdminPanel from './pages/AdminPanel';
import ProfileSetup from './pages/ProfileSetup';
import Profile from './pages/Profile';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/setup" element={<ProfileSetup />} />
      <Route path="/profile" element={<Profile />} />
      <Route element={<Layout />}>
        <Route path="/" element={<PatientDashboard />} />
        <Route path="/logbook" element={<Logbook />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="/patient-detail" element={<PatientDetail />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
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
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App