import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import RedirectToLogin from '@/components/RedirectToLogin';
import Layout from './components/Layout';
import Home from './pages/Home';
import Logbook from './pages/Logbook';
import Progress from './pages/Progress';
import Chat from './pages/Chat';
import Notifications from './pages/Notifications';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientDetail from './pages/PatientDetail';
import AdminPanel from './pages/AdminPanel';
import ProfileSetup from './pages/ProfileSetup';
import Profile from './pages/Profile';
import JoinDoctor from './pages/JoinDoctor';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            {/* Public auth routes */}
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* All other routes require authentication */}
            <Route element={<ProtectedRoute unauthenticatedElement={<RedirectToLogin />} />}>
              <Route path="/setup" element={<ProfileSetup />} />
              <Route path="/join" element={<JoinDoctor />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
              <Route path="/profile" element={<Profile />} />
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
                <Route path="*" element={<PageNotFound />} />
              </Route>
            </Route>
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App