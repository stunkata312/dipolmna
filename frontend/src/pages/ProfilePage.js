import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import TimeInput from '../components/TimeInput';
import DatePicker from '../components/DatePicker';

const EMPTY_RESERVATIONS = { active: [], past: [], cancelled: [] };

const STATUS_META = {
  pending:   { label: 'Pending',   cls: 'tl-status-pending' },
  confirmed: { label: 'Confirmed', cls: 'tl-status-confirmed' },
  arrived:   { label: 'Arrived',   cls: 'tl-status-arrived' },
  completed: { label: 'Completed', cls: 'tl-status-completed' },
  cancelled: { label: 'Cancelled', cls: 'tl-status-cancelled' },
  no_show:   { label: 'No-show',   cls: 'tl-status-noshow' },
};

function EditPanelBody({ editData, setEditData, handleEditChange, today, editRestaurant, editAvailability, currentPreferredTable }) {
  // Parse restaurant config (closed days / closures / tables)
  let closedDays = [];
  let specialClosures = [];
  let allTables = [];
  if (editRestaurant) {
    try { closedDays = JSON.parse(editRestaurant.closed_days || '[]'); } catch {}
    try { specialClosures = JSON.parse(editRestaurant.special_closures || '[]'); } catch {}
    try { allTables = JSON.parse(editRestaurant.tables || '[]'); } catch {}
  }
  // Available tables from latest fetch (may be more recent than editRestaurant)
  if (editAvailability?.tables?.length) allTables = editAvailability.tables;

  // Tables free at the chosen time + fitting party size, with current selection allowed even if "taken"
  const partySize = parseInt(editData.num_people, 10) || 1;
  const takenAtSlot = (editAvailability?.taken_tables || {})[editData.time] || [];
  const takenSet = new Set(takenAtSlot);
  const recommendedTables = (allTables || [])
    .filter(t => t.seats >= partySize && (!takenSet.has(t.id) || t.id === currentPreferredTable))
    .sort((a, b) => a.seats - b.seats || a.id - b.id);

  return (
    <>
      <div className="edit-fields edit-fields-customer">
        <div className="form-group edit-field-date">
          <label>Date</label>
          <DatePicker
            value={editData.date}
            onChange={(d) => setEditData({ ...editData, date: d, preferred_table: null })}
            closedDays={closedDays}
            specialClosures={specialClosures}
            minDate={today}
          />
        </div>
        <div className="form-group edit-field-time">
          <label>Time</label>
          <TimeInput
            value={editData.time}
            onChange={(v) => setEditData({ ...editData, time: v, preferred_table: null })}
          />
        </div>
        <div className="form-group edit-field-people">
          <label>People</label>
          <input
            type="number"
            name="num_people"
            value={editData.num_people}
            onChange={handleEditChange}
            min="1"
          />
        </div>
      </div>

      {editData.date && editData.time && allTables.length > 0 && (
        <div className="form-group edit-field-table">
          <label>
            Table <span className="label-optional">*optional</span>
          </label>
          {recommendedTables.length === 0 ? (
            <p className="picker-hint">No tables fit your party of {partySize} at this time.</p>
          ) : (
            <div className="customer-table-grid edit-table-grid">
              {recommendedTables.map(t => {
                const isSelected = editData.preferred_table === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`customer-table-cell${isSelected ? ' is-selected' : ''}`}
                    onClick={() => setEditData({
                      ...editData,
                      preferred_table: isSelected ? null : t.id,
                    })}
                    title={`Table ${t.id} · ${t.seats} seats`}
                  >
                    <span className="customer-table-num">{t.id}</span>
                    <span className="customer-table-seats">{t.seats} seats</span>
                  </button>
                );
              })}
            </div>
          )}
          {editData.preferred_table && (
            <div className="picker-clear-row">
              <button
                type="button"
                className="picker-clear-btn"
                onClick={() => setEditData({ ...editData, preferred_table: null })}
              >
                Clear preference
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function groupByMonth(reservations) {
  const groups = new Map();
  for (const r of reservations) {
    const k = monthKey(r.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: monthLabel(key),
    items,
  }));
}

function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('upcoming');
  const [expandedId, setExpandedId] = useState(null);
  const [editData, setEditData] = useState({ date: '', time: '', num_people: '', preferred_table: null });
  const [editRestaurantId, setEditRestaurantId] = useState(null);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'reservations'] });
      setExpandedId(null);
      setActionError(null);
    },
    onError: (err) => setActionError(err.message),
  });

  // Pull restaurant info for the currently-editing reservation (for closed days/calendar/tables)
  const { data: editRestaurant } = useQuery({
    queryKey: ['restaurant', editRestaurantId],
    queryFn: () => apiFetch(`/restaurants/${editRestaurantId}`),
    enabled: !!editRestaurantId,
    staleTime: 60_000,
  });

  // Availability for the chosen date — to know which tables are free at the chosen time
  const { data: editAvailability } = useQuery({
    queryKey: ['restaurant', editRestaurantId, 'availability', editData.date],
    queryFn: () => apiFetch(`/restaurants/${editRestaurantId}/availability?date=${editData.date}`),
    enabled: !!editRestaurantId && !!editData.date,
    staleTime: 30_000,
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

  // Sort upcoming ascending, past+cancelled descending
  const upcomingGroups = useMemo(() => {
    const sorted = [...reservations.active].sort((a, b) =>
      a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    return groupByMonth(sorted);
  }, [reservations.active]);

  const historyGroups = useMemo(() => {
    const all = [...reservations.past, ...reservations.cancelled].sort((a, b) =>
      b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
    return groupByMonth(all);
  }, [reservations.past, reservations.cancelled]);

  // Summary stats
  const summary = useMemo(() => {
    const total = reservations.active.length + reservations.past.length + reservations.cancelled.length;
    const completed = reservations.past.filter(r => r.status === 'arrived' || r.status === 'completed').length;
    const completionRate = total > 0 ? Math.round((completed / Math.max(1, completed + reservations.cancelled.length)) * 100) : 0;
    return {
      total,
      upcoming: reservations.active.length,
      completed,
      completionRate,
    };
  }, [reservations]);

  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];

  const formatDay = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return {
      day: d.getDate(),
      month: d.toLocaleDateString('en-GB', { month: 'short' }),
      weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    };
  };

  const handleExpand = (reservation) => {
    if (expandedId === reservation.id) {
      setExpandedId(null);
      setEditRestaurantId(null);
      setActionError(null);
      return;
    }
    setExpandedId(reservation.id);
    setEditRestaurantId(reservation.restaurant_id);
    setEditData({
      date: reservation.date,
      time: reservation.time,
      num_people: String(reservation.num_people),
      preferred_table: reservation.preferred_table || null,
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
        preferred_table: editData.preferred_table || null,
      },
    });
  };

  const handleCancel = (id) => {
    setActionError(null);
    cancelReservation.mutate(id);
  };

  const renderTimelineNode = (reservation, isPast) => {
    const isExpanded = expandedId === reservation.id;
    const isConfirming = confirmCancelId === reservation.id;
    const meta = STATUS_META[reservation.status] || STATUS_META.confirmed;
    const day = formatDay(reservation.date);

    return (
      <div key={reservation.id} className={`timeline-node${isExpanded ? ' timeline-node-expanded' : ''}`}>
        <div className="timeline-date">
          <span className="timeline-date-day">{day.day}</span>
          <span className="timeline-date-month">{day.month}</span>
          <span className="timeline-date-weekday">{day.weekday}</span>
        </div>

        <div className={`timeline-dot ${meta.cls}`} aria-hidden="true" />

        <div
          className={`timeline-card${!isPast ? ' timeline-card-clickable' : ''}`}
          onClick={!isPast ? () => handleExpand(reservation) : undefined}
        >
          <div className="timeline-card-top">
            <div className="timeline-restaurant">
              {reservation.restaurant_image ? (
                <img src={reservation.restaurant_image} alt={reservation.restaurant_name} className="timeline-restaurant-img" />
              ) : (
                <div className="timeline-restaurant-img timeline-restaurant-placeholder">
                  {reservation.restaurant_name?.charAt(0) || '?'}
                </div>
              )}
              <div>
                <h3 className="timeline-restaurant-name">{reservation.restaurant_name}</h3>
                <div className="timeline-meta-row">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    {reservation.time}
                  </span>
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    </svg>
                    {reservation.num_people} {reservation.num_people === 1 ? 'guest' : 'guests'}
                  </span>
                  {reservation.assigned_table && (
                    <span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" />
                      </svg>
                      Table {reservation.assigned_table}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className={`timeline-status-badge ${meta.cls}`}>{meta.label}</span>
          </div>

          {isExpanded && !isPast && (
            <div className="timeline-edit-panel" onClick={(e) => e.stopPropagation()}>
              {actionError && <div className="error-message">{actionError}</div>}
              <EditPanelBody
                editData={editData}
                setEditData={setEditData}
                handleEditChange={handleEditChange}
                today={today}
                editRestaurant={editRestaurant}
                editAvailability={editAvailability}
                currentPreferredTable={reservation.preferred_table}
              />
              <div className="edit-actions">
                <button className="save-btn" onClick={() => handleSave(reservation.id)} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                {!isConfirming ? (
                  <button
                    className="cancel-reservation-btn"
                    onClick={(e) => { e.stopPropagation(); setConfirmCancelId(reservation.id); }}
                    disabled={saving}
                  >
                    Cancel Reservation
                  </button>
                ) : (
                  <div className="confirm-cancel">
                    <span>Are you sure?</span>
                    <button className="confirm-yes" onClick={() => handleCancel(reservation.id)} disabled={saving}>
                      {saving ? 'Cancelling...' : 'Yes, cancel it'}
                    </button>
                    <button className="confirm-no" onClick={() => setConfirmCancelId(null)} disabled={saving}>
                      No, keep it
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const activeGroups = tab === 'upcoming' ? upcomingGroups : historyGroups;
  const activeIsPast = tab !== 'upcoming';

  // Owner-style compact card used for History tab
  const renderHistoryCard = (reservation) => {
    const meta = STATUS_META[reservation.status] || STATUS_META.completed;
    const dateLabel = new Date(reservation.date + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    });

    return (
      <div key={reservation.id} className={`history-card history-card-${reservation.status}`}>
        <div className="history-card-header">
          <div className="history-card-restaurant">
            {reservation.restaurant_image ? (
              <img src={reservation.restaurant_image} alt="" className="history-card-img" />
            ) : (
              <div className="history-card-img history-card-placeholder">
                {reservation.restaurant_name?.charAt(0) || '?'}
              </div>
            )}
            <div className="history-card-headings">
              <strong>{reservation.restaurant_name}</strong>
            </div>
          </div>
          <span className={`res-status-badge ${meta.cls}`}>{meta.label}</span>
        </div>

        <div className="history-card-info">
          <span className="info-chip">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {dateLabel} at {reservation.time}
          </span>
          <span className="info-chip">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
            {reservation.num_people} {reservation.num_people === 1 ? 'person' : 'people'}
          </span>
          {reservation.assigned_table && (
            <span className="info-chip info-chip-table">Table {reservation.assigned_table}</span>
          )}
        </div>

        {reservation.notes && (
          <div className="history-card-notes">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <em>{reservation.notes}</em>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <Link to="/" className="back-link">&larr; Back to restaurants</Link>

      <div className="profile-container">
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

        {/* Summary */}
        <div className="profile-summary">
          <div className="summary-stat">
            <span className="summary-value">{summary.total}</span>
            <span className="summary-label">Total bookings</span>
          </div>
          <div className="summary-stat">
            <span className="summary-value">{summary.upcoming}</span>
            <span className="summary-label">Upcoming</span>
          </div>
          <div className="summary-stat">
            <span className="summary-value">{summary.completed}</span>
            <span className="summary-label">Completed</span>
          </div>
          <div className="summary-stat">
            <span className="summary-value">{summary.completionRate}%</span>
            <span className="summary-label">Show-up rate</span>
          </div>
        </div>

        {loading && <div className="loading">Loading reservations...</div>}
        {error && <div className="error-message">{error.message || 'Failed to load reservations'}</div>}

        {!loading && !error && (
          <>
            {/* Tabs */}
            <div className="profile-tabs">
              <button
                className={`profile-tab${tab === 'upcoming' ? ' active' : ''}`}
                onClick={() => setTab('upcoming')}
              >
                Upcoming
                <span className="profile-tab-count">{reservations.active.length}</span>
              </button>
              <button
                className={`profile-tab${tab === 'history' ? ' active' : ''}`}
                onClick={() => setTab('history')}
              >
                History
                <span className="profile-tab-count">{reservations.past.length + reservations.cancelled.length}</span>
              </button>
            </div>

            {/* Timeline */}
            {activeGroups.length === 0 ? (
              <div className="empty-reservations">
                {tab === 'upcoming' ? (
                  <>
                    <p>No upcoming reservations.</p>
                    <Link
                      to="/"
                      className="submit-btn"
                      style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center', maxWidth: '250px' }}
                    >
                      Browse Restaurants
                    </Link>
                  </>
                ) : (
                  <p>No past reservations yet.</p>
                )}
              </div>
            ) : tab === 'upcoming' ? (
              <div className="timeline">
                {activeGroups.map(group => (
                  <div key={group.key} className="timeline-month">
                    <div className="timeline-month-header">
                      <span>{group.label}</span>
                      <span className="timeline-month-count">{group.items.length}</span>
                    </div>
                    {group.items.map(r => renderTimelineNode(r, activeIsPast))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="history-list">
                {activeGroups.map(group => (
                  <div key={group.key} className="history-month">
                    <div className="history-month-header">
                      <span>{group.label}</span>
                      <span className="history-month-count">{group.items.length}</span>
                    </div>
                    <div className="history-cards">
                      {group.items.map(r => renderHistoryCard(r))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
