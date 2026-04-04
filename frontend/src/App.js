import { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import UserMenu from './components/UserMenu';
import LoginModal from './components/LoginModal';
import HomePage from './pages/HomePage';
import './App.css';

const RestaurantPage = lazy(() => import('./pages/RestaurantPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const RestaurantRegisterPage = lazy(() => import('./pages/RestaurantRegisterPage'));
const RestaurantDashboardPage = lazy(() => import('./pages/RestaurantDashboardPage'));
const RestaurantSettingsPage = lazy(() => import('./pages/RestaurantSettingsPage'));

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

function AppContent() {
  const [showLogin, setShowLogin] = useState(false);
  const { user } = useAuth();
  const logoTo = user?.role === 'restaurant' ? '/restaurant/dashboard' : '/';

  return (
    <div className="App">
      <header className="app-header">
        <Link to={logoTo} className="logo">RestaurantBook</Link>
        <div className="header-right">
          <Link to="/restaurant/register" className="header-restaurant-link">For Restaurants</Link>
          <UserMenu onLoginClick={() => setShowLogin(true)} />
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
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
