import { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import UserMenu from './components/UserMenu';
import LoginModal from './components/LoginModal';
import ThemeToggle from './components/ThemeToggle';
import HomePage from './pages/HomePage';
import './App.css';

const RestaurantPage = lazy(() => import('./pages/RestaurantPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const RestaurantRegisterPage = lazy(() => import('./pages/RestaurantRegisterPage'));
const RestaurantDashboardPage = lazy(() => import('./pages/RestaurantDashboardPage'));
const RestaurantSettingsPage = lazy(() => import('./pages/RestaurantSettingsPage'));

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const [showLogin, setShowLogin] = useState(false);
  const { user } = useAuth();
  const { theme } = useTheme();
  // Only the restaurant owner role lands on the dashboard from the logo.
  // Hostesses keep a normal customer experience for the logo + the rest of the
  // site, with the dashboard reachable only via the user-menu dropdown.
  const logoTo = user?.role === 'restaurant' ? '/restaurant/dashboard' : '/';
  const logoSrc = theme === 'light' ? '/logo_light.png' : '/logo_dark.png';

  return (
    <div className="App">
      <header className="app-header">
        <Link to={logoTo} className="logo">
          <img src={logoSrc} alt="TakeASeat logo" className="logo-img" />
          <span className="logo-text">TakeASeat</span>
        </Link>
        <div className="header-right">
          <Link to="/restaurant/register" className="header-restaurant-link">For Restaurants</Link>
          <UserMenu onLoginClick={() => setShowLogin(true)} />
          <ThemeToggle />
        </div>
      </header>
      <main className="app-main">
        <Suspense fallback={<div className="loading">Loading...</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/restaurant/register" element={<RestaurantRegisterPage />} />
            <Route path="/restaurant/dashboard" element={<RestaurantDashboardPage />} />
            <Route path="/restaurant/settings" element={<RestaurantSettingsPage />} />
            <Route path="/restaurant/:id" element={<RestaurantPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </Suspense>
      </main>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={googleClientId}>
        <ThemeProvider>
          <AuthProvider>
            <Router>
              <AppContent />
            </Router>
          </AuthProvider>
        </ThemeProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
