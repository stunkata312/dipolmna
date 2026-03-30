import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import UserMenu from './components/UserMenu';
import LoginModal from './components/LoginModal';
import HomePage from './pages/HomePage';
import RestaurantPage from './pages/RestaurantPage';
import ProfilePage from './pages/ProfilePage';
import './App.css';

const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

function AppContent() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="App">
      <header className="app-header">
        <a href="/" className="logo">RestaurantBook</a>
        <UserMenu onLoginClick={() => setShowLogin(true)} />
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/restaurant/:id" element={<RestaurantPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
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
