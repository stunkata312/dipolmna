import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import TableGrid from '../components/TableGrid';
import StarRating from '../components/StarRating';

// Build Map(date -> Map(table -> { time, name, num_people })) from confirmed/arrived bookings
function buildTakenIndex(upcoming = [], completed = []) {
  const idx = new Map();
  const add = (r) => {
    if (!r.assigned_table) return;
    if (!idx.has(r.date)) idx.set(r.date, new Map());
    idx.get(r.date).set(r.assigned_table, {
      time: r.time, name: r.name, num_people: r.num_people,
    });
  };
  for (const r of upcoming) add(r);
  // Include arrived (today) so the owner doesn't double-book over an in-progress table
  for (const r of completed) if (r.status === 'arrived') add(r);
  return idx;
}

const DASHBOARD_KEY = ['restaurant', 'dashboard'];

function NoShowBadge({ count }) {
  if (!count || count <= 0) return null;
  return <span className="prev-noshow-badge">PREVIOUS NO-SHOW: {count}</span>;
}

function RestaurantDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);

  const isOwner = !!user && user.role === 'restaurant';

  useEffect(() => {
    if (user && user.role !== 'restaurant') navigate('/');
  }, [user, navigate]);

  const { data, isLoading: loading, error } = useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => apiFetch('/restaurant/dashboard'),
    enabled: isOwner,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const takenIndex = useMemo(
    () => buildTakenIndex(data?.upcoming, data?.completed),
    [data?.upcoming, data?.completed]
  );

  // Reviews left on this restaurant
  const restaurantId = data?.restaurant?.id;
  const { data: reviewsData } = useQuery({
    queryKey: ['restaurant', restaurantId, 'reviews'],
    queryFn: () => apiFetch(`/restaurants/${restaurantId}/reviews`),
    enabled: !!restaurantId,
    staleTime: 30_000,
  });

  const restaurantTables = useMemo(() => {
    if (!data?.restaurant) return [];
    try {
      const parsed = JSON.parse(data.restaurant.tables || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    // Legacy fallback: synthesize from num_tables / seats_per_table
    const n = data.restaurant.num_tables || 0;
    const s = data.restaurant.seats_per_table || 4;
    return Array.from({ length: n }, (_, i) => ({ id: i + 1, seats: s }));
  }, [data?.restaurant]);

  const refreshDashboard = () => queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });

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
    return d.toLocaleString('en-GB', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    });
  };

  const handleApprove = async (id, assigned_table) => {
    setActionLoading(id + '-approve');
    setActionError(null);
    try {
      await apiFetch(`/restaurant/reservations/${id}/approve`, { method: 'PUT', body: { assigned_table } });
      refreshDashboard();
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
      await apiFetch(`/restaurant/reservations/${id}/decline`, { method: 'PUT', body: {} });
      refreshDashboard();
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
      await apiFetch(`/restaurant/reservations/${id}/status`, { method: 'PUT', body: { status } });
      refreshDashboard();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearArrived = async () => {
    setActionLoading('clear-arrived');
    setActionError(null);
    try {
      await apiFetch('/restaurant/reservations/clear-arrived', { method: 'POST' });
      refreshDashboard();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!user || user.role !== 'restaurant') return null;
  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error-message">{error.message || 'Failed to load dashboard'}</div>;

  const { restaurant, pending = [], upcoming = [], completed = [], cancelled = [], stats = {} } = data || {};
  if (!restaurant) return <div className="loading">Loading dashboard...</div>;
  const tablesUsed = stats.arrived || 0;
  const occupancyRate = restaurant.num_tables > 0
    ? Math.min(100, Math.round((tablesUsed / restaurant.num_tables) * 100))
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
          <div className="stat-label">Currently Arrived</div>
          {stats.arrived > 0 && (
            <button
              type="button"
              className="stat-reset-btn"
              onClick={handleClearArrived}
              disabled={actionLoading === 'clear-arrived'}
              title="End the shift and clear today's arrivals"
            >
              {actionLoading === 'clear-arrived' ? 'Resetting…' : 'Reset'}
            </button>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.cancelled_today || 0}</div>
          <div className="stat-label">Cancellations Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{occupancyRate}%</div>
          <div className="stat-label">Tables Used ({tablesUsed}/{restaurant.num_tables})</div>
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
        <button
          className={`dashboard-tab ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews
          {reviewsData?.stats?.total > 0 && <span className="tab-badge tab-badge-orange">{reviewsData.stats.total}</span>}
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
                      tables={restaurantTables}
                      onApprove={handleApprove}
                      onDecline={handleDecline}
                      actionLoading={actionLoading}
                      formatDate={formatDate}
                      formatDateTime={formatDateTime}
                      takenForDate={takenIndex.get(r.date) || new Map()}
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
                      tables={restaurantTables}
                      onStatusUpdate={handleStatusUpdate}
                      actionLoading={actionLoading}
                      formatDate={formatDate}
                      onRefresh={refreshDashboard}
                      takenForDate={takenIndex.get(r.date) || new Map()}
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
                    <CompletedCard
                      key={r.id}
                      reservation={r}
                      formatDate={formatDate}
                      onStatusUpdate={handleStatusUpdate}
                      actionLoading={actionLoading}
                    />
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
              <p className="cancelled-notice">Cancelled reservations and no-shows are automatically deleted after 15 days.</p>
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

      {/* Reviews tab */}
      {activeTab === 'reviews' && (
        <div className="dashboard-section">
          <ReviewsTabContent reviewsData={reviewsData} />
        </div>
      )}
    </div>
  );
}

function CompletedCard({ reservation: r, formatDate, onStatusUpdate, actionLoading }) {
  const isDone = r.status === 'completed';
  const isMarkingDone = actionLoading === r.id + '-completed';

  return (
    <div className={`dashboard-card completed-card${isDone ? ' done-card' : ''}`}>
      <div className="dashboard-card-header">
        <div className="dashboard-card-guest">
          <div className={`guest-avatar ${isDone ? 'guest-avatar-grey' : 'guest-avatar-green'}`}>
            {r.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{r.name}</strong>
            <span className="guest-contact">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span>
          </div>
        </div>
        <div className="status-stack">
          <div className="status-with-action">
            <span className={`res-status-badge ${isDone ? 'status-done' : 'status-arrived'}`}>
              {isDone ? 'Done' : 'Arrived'}
            </span>
            {!isDone && onStatusUpdate && (
              <button
                type="button"
                className="done-btn"
                onClick={() => onStatusUpdate(r.id, 'completed')}
                disabled={isMarkingDone}
                title="Mark this reservation as done — frees the table"
              >
                {isMarkingDone ? '...' : 'DONE'}
              </button>
            )}
          </div>
          <NoShowBadge count={r.previous_no_shows} />
        </div>
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
  const isNoShow = r.status === 'no_show';
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
        <div className="status-stack">
          <span className={`res-status-badge ${isNoShow ? 'status-noshow' : 'status-cancelled'}`}>
            {isNoShow ? 'No-show' : 'Cancelled'}
          </span>
          <NoShowBadge count={r.previous_no_shows} />
        </div>
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
          <span className="info-chip info-chip-muted">
            {isNoShow ? 'Marked no-show' : 'Cancelled'} on {cancelledDate}
          </span>
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

function PendingCard({ reservation: r, restaurant, tables, onApprove, onDecline, actionLoading, formatDate, formatDateTime, takenForDate }) {
  // Pre-select the customer's preferred table when present
  const [selectedTable, setSelectedTable] = useState(r.preferred_table || null);
  const [tableError, setTableError] = useState(null);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const isApproving = actionLoading === r.id + '-approve';
  const isDeclining = actionLoading === r.id + '-decline';

  const createdAt = formatDateTime(r.created_at);
  const validTableIds = new Set(tables.map(t => t.id));
  const tableValid = Number.isInteger(selectedTable) && validTableIds.has(selectedTable);

  const handleApproveClick = () => {
    if (!tableValid) {
      setTableError('Pick a table from the floor plan before approving.');
      return;
    }
    setTableError(null);
    onApprove(r.id, selectedTable);
  };

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
        <div className="status-stack">
          <span className="res-status-badge status-pending">Pending</span>
          <NoShowBadge count={r.previous_no_shows} />
        </div>
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
        <TableGrid
          tables={tables}
          selected={selectedTable}
          onSelect={(n) => { setSelectedTable(n); setTableError(null); }}
          takenMap={takenForDate}
          partySize={r.num_people}
        />

        <div className="pending-actions-row">
          {r.preferred_table && (
            <div className="preferred-table-hint">
              Customer prefers <strong>Table {r.preferred_table}</strong>
            </div>
          )}
          <button
            className="approve-btn pending-btn"
            onClick={handleApproveClick}
            disabled={isApproving || isDeclining || !tableValid}
            title={tableValid ? '' : 'Pick a table before approving'}
          >
            {isApproving ? 'Approving...' : tableValid ? `✓ Approve · Table ${selectedTable}` : '✓ Approve'}
          </button>
          {!showDeclineConfirm ? (
            <button
              className="decline-btn pending-btn"
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

        {tableError && <div className="field-error">{tableError}</div>}
      </div>
    </div>
  );
}

function UpcomingCard({ reservation: r, restaurant, tables, onStatusUpdate, actionLoading, formatDate, onRefresh, takenForDate }) {
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
        <div className="status-stack">
          <span className="res-status-badge status-confirmed">Confirmed</span>
          <NoShowBadge count={r.previous_no_shows} />
        </div>
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
        <ModifyForm
          reservationId={r.id}
          current={r}
          restaurant={restaurant}
          tables={tables}
          takenForDate={takenForDate}
          onDone={() => setShowModify(false)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

function ModifyForm({ reservationId, current, restaurant, tables, takenForDate, onDone, onRefresh }) {
  // Owner modifies the assigned table only — date/time/people are display-only
  const [assignedTable, setAssignedTable] = useState(current.assigned_table || null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const formatDisplayDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      await apiFetch(`/restaurant/reservations/${reservationId}`, {
        method: 'PUT',
        body: { assigned_table: assignedTable || null },
      });
      onDone();
      if (onRefresh) onRefresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modify-form">
      {err && <div className="error-message" style={{ marginBottom: 8 }}>{err}</div>}

      {/* Read-only summary of date / time / people */}
      <div className="modify-readonly-row">
        <div className="modify-readonly-field">
          <span className="modify-readonly-label">Date</span>
          <span className="modify-readonly-value">{formatDisplayDate(current.date)}</span>
        </div>
        <div className="modify-readonly-field">
          <span className="modify-readonly-label">Time</span>
          <span className="modify-readonly-value">{current.time}</span>
        </div>
        <div className="modify-readonly-field">
          <span className="modify-readonly-label">People</span>
          <span className="modify-readonly-value">{current.num_people}</span>
        </div>
      </div>

      {tables && tables.length > 0 && (
        <div className="form-group" style={{ marginTop: 10 }}>
          <label>Table</label>
          <TableGrid
            tables={tables}
            selected={assignedTable}
            onSelect={(n) => setAssignedTable(n)}
            takenMap={takenForDate || new Map()}
            partySize={current.num_people}
            currentTable={current.assigned_table}
          />
        </div>
      )}
      <div className="edit-actions">
        <button className="save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button className="confirm-no" onClick={onDone} disabled={saving}>Cancel</button>
      </div>
    </div>
  );
}

function ReviewsTabContent({ reviewsData }) {
  if (!reviewsData) {
    return <div className="loading">Loading reviews…</div>;
  }
  const { stats, reviews } = reviewsData;

  if (stats.total === 0) {
    return (
      <div className="dashboard-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
        <p>No reviews yet</p>
      </div>
    );
  }

  const totalForBars = Math.max(1, stats.total);
  const formatDate = (iso) => {
    const d = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <div className="reviews-summary">
        <div className="reviews-avg">
          <span className="reviews-avg-num">{stats.avg.toFixed(1)}</span>
          <StarRating rating={stats.avg} />
          <span className="reviews-count">
            {stats.total} {stats.total === 1 ? 'review' : 'reviews'}
          </span>
        </div>
        <div className="reviews-dist">
          {[5, 4, 3, 2, 1].map(stars => {
            const count = stats.counts[stars] || 0;
            const pct = (count / totalForBars) * 100;
            return (
              <div key={stars} className="dist-row">
                <span className="dist-label">{stars}★</span>
                <div className="dist-bar">
                  <div className="dist-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="dist-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="reviews-list">
        {reviews.map(r => (
          <div key={r.id} className="review-item">
            <div className="review-head">
              {r.avatar_url ? (
                <img src={r.avatar_url} alt="" className="review-avatar" referrerPolicy="no-referrer" />
              ) : (
                <span className="review-avatar review-avatar-initials">
                  {(r.user_name || '?').charAt(0).toUpperCase()}
                </span>
              )}
              <div className="review-meta">
                <strong>{r.user_name || 'Anonymous'}</strong>
                <div className="review-meta-row">
                  <StarRating rating={r.rating} />
                  <span className="review-date">{formatDate(r.created_at)}</span>
                </div>
              </div>
            </div>
            {r.comment && <p className="review-comment">{r.comment}</p>}
          </div>
        ))}
      </div>
    </>
  );
}

export default RestaurantDashboardPage;
