import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function UserMenu({ onLoginClick }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <button className="user-menu-btn" onClick={onLoginClick}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>Sign In</span>
      </button>
    );
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button className="user-menu-btn user-menu-logged" onClick={() => setOpen(!open)}>
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="user-avatar" referrerPolicy="no-referrer" />
        ) : (
          <span className="user-avatar-initials">
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="user-menu-name">{user.name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
            {user.role === 'restaurant' && (
              <span className="user-role-badge">Restaurant</span>
            )}
          </div>
          <div className="user-dropdown-divider" />
          {user.role === 'restaurant' ? (
            <button onClick={() => { setOpen(false); navigate('/restaurant/dashboard'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Dashboard
            </button>
          ) : (
            <button onClick={() => { setOpen(false); navigate('/profile'); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              My Profile
            </button>
          )}
          <button onClick={() => { setOpen(false); logout(); navigate('/'); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
