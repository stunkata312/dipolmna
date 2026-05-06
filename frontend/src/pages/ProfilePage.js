import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';

const EMPTY_RESERVATIONS = { active: [], past: [], cancelled: [] };

function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Expand / edit state
  const [expandedId, setExpandedId] = useState(null);
  const [editData, setEditData] = useState({ date: '', time: '', num_people: '' });
  const [actionError, setActionError] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  const {
    data: reservations = EMPTY_RESERVATIONS,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ['user', 'reservations'],
    queryFn: () => apiFetch('/user/reservations'),
    enabled: !!user,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const updateReservation = useMutation({
    mutationFn: ({ id, body }) => apiFetch(`/reservations/${id}`, { method: 'PUT', body }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['user', 'reservations'] });
      setExpandedId(null);
      setActionError(null);
      void vars;
    },
    onError: (err) => setActionError(err.message),
  });

  const cancelReservation = useMutation({
    mutationFn: (id) => apiFetch(`/reservations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'reservations'] });
      setExpandedId(null);
      setConfirmCancelId(null);
      setActionError(null);
    },
    onError: (err) => setActionError(err.message),
  });

  const saving = updateReservation.isPending || cancelReservation.isPending;

  if (!user) return null;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const today = new Date().toISOString().split('T')[0];

  const handleExpand = (reservation) => {
    if (expandedId === reservation.id) {
      setExpandedId(null);
      setActionError(null);
      return;
    }
    setExpandedId(reservation.id);
    setEditData({
      date: reservation.date,
      time: reservation.time,
      num_people: String(reservation.num_people)
    });
    setActionError(null);
    setConfirmCancelId(null);
  };

  const handleEditChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleSave = (id) => {
    setActionError(null);
    updateReservation.mutate({
      id,
      body: {
        date: editData.date,
        time: editData.time,
        num_people: parseInt(editData.num_people, 10),
      },
    });
  };

  const handleCancel = (id) => {
    setActionError(null);
    cancelReservation.mutate(id);
  };

  const ReservationCard = ({ reservation, isPast }) => {
    const isExpanded = expandedId === reservation.id;
    const isConfirming = confirmCancelId === reservation.id;

    return (
      <div className={`reservation-item ${isPast ? 'past' : 'clickable'} ${isExpanded ? 'expanded' : ''}`}>
        <div className="reservation-item-main" onClick={!isPast ? () => handleExpand(reservation) : undefined}>
          <div className="reservation-item-image">
            <img src={reservation.restaurant_image} alt={reservation.restaurant_name} />
          </div>
          <div className="reservation-item-details">
            <h3>{reservation.restaurant_name}</h3>
            <div className="reservation-item-info">
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {formatDate(reservation.date)}
              </span>
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {reservation.time}
              </span>
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {reservation.num_people} {reservation.num_people === 1 ? 'person' : 'people'}
              </span>
              {reservation.assigned_table && (
                <span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                  </svg>
                  Table {reservation.assigned_table}
                </span>
              )}
            </div>
            <div className="reservation-badge-row">
              {reservation.status === 'cancelled' && <span className="reservation-badge cancelled-badge">Cancelled</span>}
              {isPast && reservation.status === 'arrived' && <span className="reservation-badge complete-badge">Complete</span>}
              {isPast && reservation.status !== 'cancelled' && reservation.status !== 'arrived' && <span className="reservation-badge past-badge">Completed</span>}
              {!isPast && reservation.status !== 'cancelled' && <span className="reservation-badge active-badge">Upcoming</span>}
              {!isPast && (
                <span className="expand-hint">
                  {isExpanded ? 'Click to collapse' : 'Click to edit'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expanded edit panel */}
        {isExpanded && !isPast && (
          <div className="reservation-edit-panel">
            {actionError && <div className="error-message">{actionError}</div>}

            <div className="edit-fields">
              <div className="form-group">
                <label>Date</label>
                <input type="date" name="date" value={editData.date} onChange={handleEditChange} min={today} />
              </div>
              <div className="form-group">
                <label>Time</label>
                <input type="time" name="time" value={editData.time} onChange={handleEditChange} />
              </div>
              <div className="form-group">
                <label>People</label>
                <input type="number" name="num_people" value={editData.num_people} onChange={handleEditChange} min="1" />
              </div>
            </div>

            <div className="edit-actions">
              <button className="save-btn" onClick={() => handleSave(reservation.id)} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>

              {!isConfirming ? (
                <button className="cancel-reservation-btn" onClick={(e) => { e.stopPropagation(); setConfirmCancelId(reservation.id); }} disabled={saving}>
                  Cancel Reservation
                </button>
              ) : (
                <div className="confirm-cancel">
                  <span>Are you sure?</span>
                  <button className="confirm-yes" onClick={() => handleCancel(reservation.id)} disabled={saving}>
                    {saving ? 'Cancelling...' : 'Yes, cancel it'}
                  </button>
                  <button className="confirm-no" onClick={(e) => { e.stopPropagation(); setConfirmCancelId(null); }} disabled={saving}>
                    No, keep it
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <Link to="/" className="back-link">&larr; Back to restaurants</Link>

      <div className="profile-container">
        {/* User Info Card */}
        <div className="profile-card">
          <div className="profile-header">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="profile-avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="profile-avatar-initials">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="profile-info">
              <h1>{user.name}</h1>
              <p>{user.email}</p>
              {user.phone && <p>{user.phone}</p>}
            </div>
          </div>
          <button className="logout-btn" onClick={() => { logout(); navigate('/'); }}>
            Sign Out
          </button>
        </div>

        {loading && <div className="loading">Loading reservations...</div>}
        {error && <div className="error-message">{error.message || 'Failed to load reservations'}</div>}

        {!loading && !error && (
          <>
            {/* Active Reservations */}
            <div className="reservations-section">
              <h2>Active Reservations ({reservations.active.length})</h2>
              {reservations.active.length === 0 ? (
                <div className="empty-reservations">
                  <p>No upcoming reservations.</p>
                  <Link to="/" className="submit-btn" style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center', maxWidth: '250px' }}>
                    Browse Restaurants
                  </Link>
                </div>
              ) : (
                <div className="reservations-list">
                  {reservations.active.map(r => (
                    <ReservationCard key={r.id} reservation={r} isPast={false} />
                  ))}
                </div>
              )}
            </div>

            {/* Past Reservations */}
            <div className="reservations-section">
              <h2>Past Reservations ({reservations.past.length})</h2>
              {reservations.past.length === 0 ? (
                <div className="empty-reservations">
                  <p>No past reservations yet.</p>
                </div>
              ) : (
                <div className="reservations-list">
                  {reservations.past.map(r => (
                    <ReservationCard key={r.id} reservation={r} isPast={true} />
                  ))}
                </div>
              )}
            </div>

            {/* Cancelled Reservations */}
            <div className="reservations-section">
              <h2>Cancelled Reservations ({reservations.cancelled.length})</h2>
              {reservations.cancelled.length === 0 ? (
                <div className="empty-reservations">
                  <p>No cancelled reservations.</p>
                </div>
              ) : (
                <div className="reservations-list">
                  {reservations.cancelled.map(r => (
                    <ReservationCard key={r.id} reservation={r} isPast={true} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
