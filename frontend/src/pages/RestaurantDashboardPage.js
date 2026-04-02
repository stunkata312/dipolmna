import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:3001/api';

function RestaurantDashboardPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchDashboard = useCallback(() => {
    fetch(`${API_URL}/restaurant/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [token]);

  useEffect(() => {
    if (!user || user.role !== 'restaurant') {
      navigate('/');
      return;
    }
    fetchDashboard();

    // Re-fetch every 60 seconds so date labels and data stay current
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, [user, navigate, fetchDashboard]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getDateLabel = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const d = new Date(dateStr + 'T00:00:00');
    const formatted = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    if (d.getTime() === today.getTime()) return `Today — ${formatted}`;
    if (d.getTime() === tomorrow.getTime()) return `Tomorrow — ${formatted}`;
    return formatted;
  };

  const groupByDate = (reservations) => {
    const groups = {};
    for (const r of reservations) {
      const key = r.date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).map(([date, items]) => ({
      date,
      label: getDateLabel(date),
      items
    }));
  };

  const formatDateTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const apiCall = async (url, method, body) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Action failed');
    return d;
  };

  const handleApprove = async (id, assigned_table) => {
    setActionLoading(id + '-approve');
    setActionError(null);
    try {
      await apiCall(`${API_URL}/restaurant/reservations/${id}/approve`, 'PUT', { assigned_table });
      fetchDashboard();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id) => {
    setActionLoading(id + '-decline');
    setActionError(null);
    try {
      await apiCall(`${API_URL}/restaurant/reservations/${id}/decline`, 'PUT', {});
      fetchDashboard();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    setActionLoading(id + '-' + status);
    setActionError(null);
    try {
      await apiCall(`${API_URL}/restaurant/reservations/${id}/status`, 'PUT', { status });
      fetchDashboard();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!user || user.role !== 'restaurant') return null;
  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error-message">{error}</div>;

  const { restaurant, pending = [], upcoming = [], completed = [], cancelled = [], stats = {} } = data || {};
  const noShowRate = stats.completed_total > 0
    ? Math.round((stats.no_show / stats.completed_total) * 100)
    : 0;
  if (!restaurant) return <div className="loading">Loading dashboard...</div>;
  const occupancyRate = restaurant.max_guests > 0 && upcoming.length > 0
    ? Math.min(100, Math.round((upcoming.reduce((s, r) => s + r.num_people, 0) / restaurant.max_guests) * 100))
    : 0;

  return (
    <div className="dashboard-container">
      {/* Header row */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">{restaurant.name}</h1>
          <p className="dashboard-subtitle">{restaurant.address}</p>
        </div>
        <button
          className="dashboard-settings-btn"
          onClick={() => navigate('/restaurant/settings')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </div>

      {/* Stats row */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value pending-color">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value upcoming-color">{stats.upcoming}</div>
          <div className="stat-label">Upcoming</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.arrived}</div>
          <div className="stat-label">Arrived Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{noShowRate}%</div>
          <div className="stat-label">No-show Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{occupancyRate}%</div>
          <div className="stat-label">Occupancy</div>
        </div>
      </div>

      {actionError && <div className="error-message">{actionError}</div>}

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`dashboard-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Approvals
          {pending.length > 0 && <span className="tab-badge">{pending.length}</span>}
        </button>
        <button
          className={`dashboard-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming Reservations
          {upcoming.length > 0 && <span className="tab-badge tab-badge-blue">{upcoming.length}</span>}
        </button>
        <button
          className={`dashboard-tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Complete
          {completed.length > 0 && <span className="tab-badge tab-badge-green">{completed.length}</span>}
        </button>
        <button
          className={`dashboard-tab ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          Cancelled
          {cancelled.length > 0 && <span className="tab-badge tab-badge-red">{cancelled.length}</span>}
        </button>
      </div>

      {/* Pending tab */}
      {activeTab === 'pending' && (
        <div className="dashboard-section">
          {pending.length === 0 ? (
            <div className="dashboard-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p>No pending requests</p>
            </div>
          ) : (
            <div className="dashboard-list">
              {groupByDate(pending).map(group => (
                <div key={group.date}>
                  <div className="date-group-header">{group.label}</div>
                  {group.items.map(r => (
                    <PendingCard
                      key={r.id}
                      reservation={r}
                      restaurant={restaurant}
                      onApprove={handleApprove}
                      onDecline={handleDecline}
                      actionLoading={actionLoading}
                      formatDate={formatDate}
                      formatDateTime={formatDateTime}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming tab */}
      {activeTab === 'upcoming' && (
        <div className="dashboard-section">
          {upcoming.length === 0 ? (
            <div className="dashboard-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <p>No upcoming reservations</p>
            </div>
          ) : (
            <div className="dashboard-list">
              {groupByDate(upcoming).map(group => (
                <div key={group.date}>
                  <div className="date-group-header">{group.label}</div>
                  {group.items.map(r => (
                    <UpcomingCard
                      key={r.id}
                      reservation={r}
                      restaurant={restaurant}
                      onStatusUpdate={handleStatusUpdate}
                      actionLoading={actionLoading}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Complete tab */}
      {activeTab === 'completed' && (
        <div className="dashboard-section">
          {completed.length === 0 ? (
            <div className="dashboard-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p>No completed reservations yet</p>
            </div>
          ) : (
            <div className="dashboard-list">
              {groupByDate(completed).map(group => (
                <div key={group.date}>
                  <div className="date-group-header">{group.label}</div>
                  {group.items.map(r => (
                    <CompletedCard key={r.id} reservation={r} formatDate={formatDate} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cancelled tab */}
      {activeTab === 'cancelled' && (
        <div className="dashboard-section">
          {cancelled.length === 0 ? (
            <div className="dashboard-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p>No cancelled reservations</p>
            </div>
          ) : (
            <>
              <p className="cancelled-notice">Cancelled reservations are automatically deleted after 15 days.</p>
              <div className="dashboard-list">
                {groupByDate(cancelled).map(group => (
                  <div key={group.date}>
                    <div className="date-group-header">{group.label}</div>
                    {group.items.map(r => (
                      <CancelledCard key={r.id} reservation={r} formatDate={formatDate} />
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CompletedCard({ reservation: r, formatDate }) {
  return (
    <div className="dashboard-card completed-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-guest">
          <div className="guest-avatar guest-avatar-green">{r.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{r.name}</strong>
            <span className="guest-contact">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span>
          </div>
        </div>
        <span className="res-status-badge status-arrived">Arrived</span>
      </div>

      <div className="dashboard-card-info">
        <span className="info-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {formatDate(r.date)} at {r.time}
        </span>
        <span className="info-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          </svg>
          {r.num_people} {r.num_people === 1 ? 'person' : 'people'}
        </span>
        {r.assigned_table && (
          <span className="info-chip info-chip-table">Table {r.assigned_table}</span>
        )}
      </div>

      {r.notes && (
        <div className="dashboard-card-notes">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <em>{r.notes}</em>
        </div>
      )}
    </div>
  );
}

function CancelledCard({ reservation: r, formatDate }) {
  const cancelledDate = r.cancelled_at
    ? new Date(r.cancelled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="dashboard-card cancelled-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-guest">
          <div className="guest-avatar guest-avatar-red">{r.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{r.name}</strong>
            <span className="guest-contact">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span>
          </div>
        </div>
        <span className="res-status-badge status-cancelled">Cancelled</span>
      </div>

      <div className="dashboard-card-info">
        <span className="info-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {formatDate(r.date)} at {r.time}
        </span>
        <span className="info-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          </svg>
          {r.num_people} {r.num_people === 1 ? 'person' : 'people'}
        </span>
        {cancelledDate && (
          <span className="info-chip info-chip-muted">Cancelled on {cancelledDate}</span>
        )}
      </div>

      {r.notes && (
        <div className="dashboard-card-notes">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <em>{r.notes}</em>
        </div>
      )}
    </div>
  );
}

function PendingCard({ reservation: r, restaurant, onApprove, onDecline, actionLoading, formatDate, formatDateTime }) {
  const [tableInput, setTableInput] = useState('');
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const isApproving = actionLoading === r.id + '-approve';
  const isDeclining = actionLoading === r.id + '-decline';

  const createdAt = formatDateTime(r.created_at);

  return (
    <div className="dashboard-card pending-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-guest">
          <div className="guest-avatar">{r.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{r.name}</strong>
            <span className="guest-contact">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span>
          </div>
        </div>
        <span className="res-status-badge status-pending">Pending</span>
      </div>

      <div className="dashboard-card-info">
        <span className="info-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {formatDate(r.date)} at {r.time}
        </span>
        <span className="info-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {r.num_people} {r.num_people === 1 ? 'person' : 'people'}
        </span>
        <span className="info-chip info-chip-muted">Received {createdAt}</span>
      </div>

      {r.notes && (
        <div className="dashboard-card-notes">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <em>{r.notes}</em>
        </div>
      )}

      <div className="dashboard-card-actions">
        <div className="table-assign-row">
          <input
            type="number"
            className="table-input"
            placeholder="Table #"
            min="1"
            max={restaurant.num_tables}
            value={tableInput}
            onChange={e => setTableInput(e.target.value)}
          />
          <button
            className="approve-btn"
            onClick={() => onApprove(r.id, tableInput ? parseInt(tableInput, 10) : null)}
            disabled={isApproving || isDeclining}
          >
            {isApproving ? 'Approving...' : '✓ Approve'}
          </button>
        </div>

        {!showDeclineConfirm ? (
          <button
            className="decline-btn"
            onClick={() => setShowDeclineConfirm(true)}
            disabled={isApproving || isDeclining}
          >
            ✗ Decline
          </button>
        ) : (
          <div className="confirm-cancel">
            <span>Decline this booking?</span>
            <button className="confirm-yes" onClick={() => onDecline(r.id)} disabled={isDeclining}>
              {isDeclining ? 'Declining...' : 'Yes'}
            </button>
            <button className="confirm-no" onClick={() => setShowDeclineConfirm(false)} disabled={isDeclining}>
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function UpcomingCard({ reservation: r, onStatusUpdate, actionLoading, formatDate }) {
  const [showModify, setShowModify] = useState(false);

  const isArriving = actionLoading === r.id + '-arrived';
  const isNoShow = actionLoading === r.id + '-no_show';
  const isCancelling = actionLoading === r.id + '-cancelled';

  return (
    <div className="dashboard-card upcoming-card">
      <div className="dashboard-card-header">
        <div className="dashboard-card-guest">
          <div className="guest-avatar guest-avatar-blue">{r.name.charAt(0).toUpperCase()}</div>
          <div>
            <strong>{r.name}</strong>
            <span className="guest-contact">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span>
          </div>
        </div>
        <span className="res-status-badge status-confirmed">Confirmed</span>
      </div>

      <div className="dashboard-card-info">
        <span className="info-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {formatDate(r.date)} at {r.time}
        </span>
        <span className="info-chip">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          </svg>
          {r.num_people} {r.num_people === 1 ? 'person' : 'people'}
        </span>
        {r.assigned_table && (
          <span className="info-chip info-chip-table">Table {r.assigned_table}</span>
        )}
      </div>

      {r.notes && (
        <div className="dashboard-card-notes">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <em>{r.notes}</em>
        </div>
      )}

      <div className="dashboard-card-actions">
          <button
            className="arrived-btn"
            onClick={() => onStatusUpdate(r.id, 'arrived')}
            disabled={isArriving || isNoShow || isCancelling}
          >
            {isArriving ? '...' : '✓ Arrived'}
          </button>
          <button
            className="noshow-btn"
            onClick={() => onStatusUpdate(r.id, 'no_show')}
            disabled={isArriving || isNoShow || isCancelling}
          >
            {isNoShow ? '...' : 'No-show'}
          </button>
          <button
            className="modify-toggle-btn"
            onClick={() => setShowModify(s => !s)}
          >
            {showModify ? 'Hide' : 'Modify'}
          </button>
          <button
            className="decline-btn"
            onClick={() => onStatusUpdate(r.id, 'cancelled')}
            disabled={isArriving || isNoShow || isCancelling}
          >
            {isCancelling ? '...' : 'Cancel'}
          </button>
        </div>

      {showModify && (
        <ModifyForm reservationId={r.id} current={r} onDone={() => setShowModify(false)} />
      )}
    </div>
  );
}

function ModifyForm({ reservationId, current, onDone }) {
  const { token } = useAuth();
  const [form, setForm] = useState({
    date: current.date,
    time: current.time,
    num_people: String(current.num_people),
    assigned_table: current.assigned_table ? String(current.assigned_table) : ''
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const today = new Date().toISOString().split('T')[0];

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/restaurant/reservations/${reservationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          date: form.date,
          time: form.time,
          num_people: parseInt(form.num_people, 10),
          assigned_table: form.assigned_table ? parseInt(form.assigned_table, 10) : null
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      onDone();
      window.location.reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modify-form">
      {err && <div className="error-message" style={{ marginBottom: 8 }}>{err}</div>}
      <div className="edit-fields">
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={form.date} min={today} onChange={e => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Time</label>
          <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
        </div>
        <div className="form-group">
          <label>People</label>
          <input type="number" value={form.num_people} min="1" onChange={e => setForm({ ...form, num_people: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Table #</label>
          <input type="number" value={form.assigned_table} min="1" onChange={e => setForm({ ...form, assigned_table: e.target.value })} />
        </div>
      </div>
      <div className="edit-actions">
        <button className="save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button className="confirm-no" onClick={onDone} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

export default RestaurantDashboardPage;
