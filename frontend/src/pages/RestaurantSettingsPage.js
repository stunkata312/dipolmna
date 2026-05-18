import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import LocationPicker from '../components/LocationPicker';
import ImageListInput from '../components/ImageListInput';
import TablesEditor from '../components/TablesEditor';
import TimeInput from '../components/TimeInput';
import DatePicker from '../components/DatePicker';
import Dropdown from '../components/Dropdown';

const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function serializeOpeningHours(openHours) {
  const entries = Object.entries(openHours)
    .map(([k, v]) => [parseInt(k, 10), v])
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return '';
  const groups = [];
  let cur = null;
  for (const [d, h] of entries) {
    if (cur && cur.from === h.from && cur.until === h.until && cur.lastDay === d - 1) {
      cur.lastDay = d;
    } else {
      if (cur) groups.push(cur);
      cur = { firstDay: d, lastDay: d, from: h.from, until: h.until };
    }
  }
  if (cur) groups.push(cur);
  return groups.map(g => {
    const dayStr = g.firstDay === g.lastDay
      ? DAY_SHORT[g.firstDay]
      : `${DAY_SHORT[g.firstDay]}-${DAY_SHORT[g.lastDay]}`;
    return `${dayStr} ${g.from}-${g.until}`;
  }).join(', ');
}

const SETTINGS_KEY = ['restaurant', 'me'];

function RestaurantSettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [newClosure, setNewClosure] = useState({ date: '', reason: '' });
  const [activeTab, setActiveTab] = useState('accounts');
  const [bufferError, setBufferError] = useState(null);

  const handleBufferMinutes = (raw) => {
    if (raw === '') {
      setBufferError(null);
      setForm(prev => ({ ...prev, no_show_buffer_minutes: '' }));
      return;
    }
    if (!/^\d*$/.test(raw)) {
      setBufferError('Wrong format — digits only');
      setForm(prev => ({ ...prev, no_show_buffer_minutes: raw.replace(/\D/g, '') }));
      return;
    }
    setBufferError(null);
    setForm(prev => ({ ...prev, no_show_buffer_minutes: raw }));
  };

  const isOwner = !!user && user.role === 'restaurant';

  useEffect(() => {
    if (user && user.role !== 'restaurant') navigate('/');
  }, [user, navigate]);

  const { data: settings, isLoading: loading, error: loadError } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiFetch('/restaurant/me'),
    enabled: isOwner,
  });

  // Seed local form once settings have loaded
  useEffect(() => {
    if (!settings || form) return;
    let closedDays = [];
    let specialClosures = [];
    let coverImages = [];
    let galleryImages = [];
    let tables = [];
    let openHours = {};
    let menu = [];
    try { closedDays = JSON.parse(settings.closed_days || '[]'); } catch {}
    try { specialClosures = JSON.parse(settings.special_closures || '[]'); } catch {}
    try { coverImages = JSON.parse(settings.cover_images || '[]'); } catch {}
    try { galleryImages = JSON.parse(settings.gallery_images || '[]'); } catch {}
    try { tables = JSON.parse(settings.tables || '[]'); } catch {}
    try { openHours = JSON.parse(settings.open_hours_json || '{}'); } catch {}
    try { menu = JSON.parse(settings.menu_json || '[]'); } catch {}
    // If old data only has image_url, treat it as the first cover image
    if (coverImages.length === 0 && settings.image_url) coverImages = [settings.image_url];
    // Backfill tables from legacy num_tables/seats_per_table if missing
    if (tables.length === 0 && settings.num_tables) {
      tables = Array.from({ length: settings.num_tables }, (_, i) => ({
        id: i + 1, seats: settings.seats_per_table || 4,
      }));
    }
    setForm({
      name: settings.name || '',
      address: settings.address || '',
      description: settings.description || '',
      phone: settings.phone || '',
      opening_hours: settings.opening_hours || '',
      cover_images: coverImages,
      gallery_images: galleryImages,
      tables,
      reservation_start_time: settings.reservation_start_time || '10:00',
      reservation_end_time: settings.reservation_end_time || '23:00',
      closed_days: closedDays,
      special_closures: specialClosures,
      latitude: settings.latitude ?? null,
      longitude: settings.longitude ?? null,
      open_hours: openHours,
      no_show_buffer_minutes:
        settings.no_show_buffer_minutes != null ? String(settings.no_show_buffer_minutes) : '15',
      menu: menu.map(s => ({
        name: s.name || '',
        items: (s.items || []).map(it => ({
          name: it.name || '',
          description: it.description || '',
          price: it.price ?? '',
          // Backwards-compatible: old rows had a single `photo` field.
          photos: Array.isArray(it.photos)
            ? it.photos
            : (it.photo ? [it.photo] : []),
        })),
      })),
      currency: settings.currency || 'EUR',
    });
  }, [settings, form]);

  const saveSettings = useMutation({
    mutationFn: (body) => apiFetch('/restaurant/me', { method: 'PUT', body }),
    onSuccess: () => {
      setSuccess('Settings saved successfully!');
      setError(null);
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
    },
    onError: (err) => setError(err.message),
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleOpenDay = (idx) => {
    setForm(prev => {
      const next = { ...prev.open_hours };
      if (idx in next) delete next[idx];
      else next[idx] = { from: '10:00', until: '23:00' };
      return { ...prev, open_hours: next };
    });
  };

  const setDayHour = (idx, field, value) => {
    setForm(prev => ({
      ...prev,
      open_hours: { ...prev.open_hours, [idx]: { ...prev.open_hours[idx], [field]: value } },
    }));
  };

  const addMenuSection = () => setForm(prev => ({
    ...prev, menu: [...prev.menu, { name: '', items: [] }],
  }));
  const removeMenuSection = (si) => setForm(prev => ({
    ...prev, menu: prev.menu.filter((_, i) => i !== si),
  }));
  const updateMenuSection = (si, patch) => setForm(prev => ({
    ...prev, menu: prev.menu.map((s, i) => i === si ? { ...s, ...patch } : s),
  }));
  const addMenuItem = (si) => setForm(prev => ({
    ...prev,
    menu: prev.menu.map((s, i) => i === si
      ? { ...s, items: [...s.items, { name: '', description: '', price: '', photos: [] }] }
      : s),
  }));
  const removeMenuItem = (si, ii) => setForm(prev => ({
    ...prev,
    menu: prev.menu.map((s, i) => i === si
      ? { ...s, items: s.items.filter((_, j) => j !== ii) }
      : s),
  }));
  const updateMenuItem = (si, ii, patch) => setForm(prev => ({
    ...prev,
    menu: prev.menu.map((s, i) => i === si
      ? { ...s, items: s.items.map((it, j) => j === ii ? { ...it, ...patch } : it) }
      : s),
  }));

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      setError('Name and address are required');
      return;
    }
    setError(null);
    setSuccess(null);
    // Auto-generate the human-readable opening_hours string from the
    // per-day overrides. Empty map -> empty string (booking flow uses
    // Reservation Hours by default).
    const generatedOpeningHours = serializeOpeningHours(form.open_hours);
    const cleanMenu = form.menu
      .map(s => ({
        name: (s.name || '').trim(),
        items: s.items
          .map(it => ({
            name: (it.name || '').trim(),
            description: (it.description || '').trim(),
            price: it.price === '' || it.price == null ? null : parseFloat(it.price),
            photos: (Array.isArray(it.photos) ? it.photos : [])
              .map(p => (p || '').trim())
              .filter(Boolean),
          }))
          .filter(it => it.name),
      }))
      .filter(s => s.name && s.items.length > 0);
    saveSettings.mutate({
      ...form,
      opening_hours: generatedOpeningHours,
      open_hours_json: JSON.stringify(form.open_hours),
      menu_json: JSON.stringify(cleanMenu),
      currency: form.currency,
      closed_days: JSON.stringify(form.closed_days),
      special_closures: JSON.stringify(form.special_closures),
      cover_images: JSON.stringify(form.cover_images),
      gallery_images: JSON.stringify(form.gallery_images),
      tables: JSON.stringify(form.tables),
    });
  };

  const saving = saveSettings.isPending;

  if (!user || user.role !== 'restaurant') return null;
  if (loading || !form) return <div className="loading">Loading settings...</div>;
  if (loadError && !form) return <div className="error-message">Failed to load settings</div>;

  return (
    <div>
      <Link to="/restaurant/dashboard" className="back-link">&larr; Back to Dashboard</Link>
      <div className="settings-container">
        <div className="settings-card">
          <h1>Restaurant Settings</h1>

          <div className="settings-tabs" role="tablist">
            {[
              { id: 'accounts', label: 'Accounts Info' },
              { id: 'restaurant', label: 'Restaurant Info' },
              { id: 'capacity', label: 'Capacity' },
              { id: 'schedule', label: 'Schedule' },
              { id: 'menu', label: 'Menu' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                className={`settings-tab ${activeTab === t.id ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'accounts' && <AccountsTab />}

          {activeTab === 'restaurant' && (
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Restaurant Name</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input type="text" name="address" value={form.address} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Pin Location on Map</label>
                <LocationPicker
                  lat={form.latitude}
                  lng={form.longitude}
                  address={form.address}
                  onChange={(lat, lng) => setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="form-textarea" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+359 2 000 0000" />
              </div>

              <h2 className="settings-section-title">Photos</h2>
              <ImageListInput
                label="Cover Photos"
                hint="Shown as a slideshow at the top of your restaurant page. The first photo is the primary cover."
                primaryHint="Primary"
                value={form.cover_images}
                onChange={(next) => setForm({ ...form, cover_images: next })}
              />
              <ImageListInput
                label="Gallery Photos"
                hint='Shown when guests click the "See more photos" button on your restaurant page.'
                value={form.gallery_images}
                onChange={(next) => setForm({ ...form, gallery_images: next })}
              />

              <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: 24 }}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              {success && <div className="form-feedback success-message">{success}</div>}
              {error && <div className="form-feedback error-message">{error}</div>}
            </form>
          )}

          {activeTab === 'capacity' && (
            <form onSubmit={handleSave}>
              <TablesEditor
                value={form.tables}
                onChange={(next) => setForm({ ...form, tables: next })}
              />
              <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: 24 }}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              {success && <div className="form-feedback success-message">{success}</div>}
              {error && <div className="form-feedback error-message">{error}</div>}
            </form>
          )}

          {activeTab === 'schedule' && (
            <form onSubmit={handleSave}>
              <div className="schedule-section">
                <h3 className="schedule-section-title">Reservation Hours</h3>
                <p className="schedule-hint">Set the time window when customers can book reservations.</p>
                <div className="schedule-time-row">
                  <div className="form-group">
                    <label>From</label>
                    <TimeInput
                      value={form.reservation_start_time}
                      onChange={(v) => setForm({ ...form, reservation_start_time: v })}
                    />
                  </div>
                  <span className="schedule-time-separator">to</span>
                  <div className="form-group">
                    <label>Until</label>
                    <TimeInput
                      value={form.reservation_end_time}
                      onChange={(v) => setForm({ ...form, reservation_end_time: v })}
                    />
                  </div>
                </div>
              </div>

              <div className="schedule-section">
                <h3 className="schedule-section-title">Opening Hours</h3>
                <p className="schedule-hint">Reservation Hours apply to every day by default. Select a day here only if its hours differ — that day's slots will use these times instead.</p>
                <div className="closed-days-grid open-days-grid">
                  {DAY_FULL.map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      className={`closed-day-btn ${i in form.open_hours ? 'closed' : ''}`}
                      onClick={() => toggleOpenDay(i)}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                {Object.keys(form.open_hours).length > 0 && (
                  <div className="open-hours-rows">
                    {DAY_FULL.map((day, i) => {
                      if (!(i in form.open_hours)) return null;
                      const h = form.open_hours[i];
                      return (
                        <div key={i} className="open-hours-row">
                          <span className="open-hours-day">{day}</span>
                          <TimeInput value={h.from} onChange={(v) => setDayHour(i, 'from', v)} />
                          <span className="schedule-time-separator">to</span>
                          <TimeInput value={h.until} onChange={(v) => setDayHour(i, 'until', v)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="schedule-section">
                <h3 className="schedule-section-title">Weekly Closed Days</h3>
                <p className="schedule-hint">Select the days your restaurant is closed every week.</p>
                <div className="closed-days-grid">
                  {DAY_FULL.map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      className={`closed-day-btn ${form.closed_days.includes(i) ? 'closed' : ''}`}
                      onClick={() => {
                        const days = form.closed_days.includes(i)
                          ? form.closed_days.filter(d => d !== i)
                          : [...form.closed_days, i];
                        setForm({ ...form, closed_days: days });
                      }}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="schedule-section">
                <h3 className="schedule-section-title">Special Closures</h3>
                <p className="schedule-hint">Add specific dates when your restaurant will be closed (holidays, events, etc.).</p>
                <div className="closure-add-row">
                  <div className="form-group">
                    <label>Date</label>
                    <DatePicker
                      value={newClosure.date}
                      onChange={(d) => setNewClosure({ ...newClosure, date: d })}
                      specialClosures={form.special_closures}
                      minDate={new Date().toISOString().split('T')[0]}
                      placeholder="Pick a date"
                    />
                  </div>
                  <div className="form-group">
                    <label>Reason <span className="label-optional">*optional</span></label>
                    <input
                      type="text"
                      placeholder="e.g. Christmas Day"
                      value={newClosure.reason}
                      onChange={e => setNewClosure({ ...newClosure, reason: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="closure-add-btn"
                    onClick={() => {
                      if (!newClosure.date) return;
                      setForm({ ...form, special_closures: [...form.special_closures, { ...newClosure }] });
                      setNewClosure({ date: '', reason: '' });
                    }}
                    disabled={!newClosure.date}
                  >
                    + Add
                  </button>
                </div>
                {form.special_closures.length > 0 && (
                  <div className="closures-list">
                    {form.special_closures.map((c, i) => (
                      <div key={i} className="closure-item">
                        <span className="closure-date">
                          {new Date(c.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {c.reason && <span className="closure-reason">{c.reason}</span>}
                        <button
                          type="button"
                          className="closure-remove-btn"
                          onClick={() => setForm({ ...form, special_closures: form.special_closures.filter((_, idx) => idx !== i) })}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="schedule-section">
                <h3 className="schedule-section-title">Buffer Time</h3>
                <p className="schedule-hint">
                  The current buffer time for guests to arrive is {form.no_show_buffer_minutes || 15} minutes. After the time past the reservation will be automatically marked as a no-show. Leave empty to keep the default of 15.
                </p>
                <div className="form-group">
                  <label>Minutes <span className="label-optional">*optional</span></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.no_show_buffer_minutes || ''}
                    onChange={(e) => handleBufferMinutes(e.target.value)}
                    placeholder="15"
                  />
                  {bufferError && (
                    <div className="field-error-popup">{bufferError}</div>
                  )}
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: 24 }}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              {success && <div className="form-feedback success-message">{success}</div>}
              {error && <div className="form-feedback error-message">{error}</div>}
            </form>
          )}

          {activeTab === 'menu' && (
            <form onSubmit={handleSave}>
              <p className="schedule-hint">
                Add sections (e.g. Appetizers, Mains) and items inside each. Leaving this empty hides the menu from your restaurant page.
              </p>

              <div className="form-group">
                <label>Currency</label>
                <Dropdown
                  value={form.currency}
                  options={[
                    { value: 'EUR', label: 'EUR - €' },
                    { value: 'USD', label: 'USD - $' },
                    { value: 'GBP', label: 'GBP - £' },
                  ]}
                  onChange={(v) => setForm(prev => ({ ...prev, currency: v }))}
                  ariaLabel="Menu currency"
                />
              </div>

              {form.menu.map((section, si) => (
                <div key={si} className="menu-section-block">
                  <div className="menu-section-head">
                    <input
                      type="text"
                      className="menu-section-input"
                      placeholder="Section name (e.g. Appetizers)"
                      value={section.name}
                      onChange={(e) => updateMenuSection(si, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      className="account-block-remove"
                      onClick={() => removeMenuSection(si)}
                    >
                      × Remove section
                    </button>
                  </div>

                  {section.items.map((it, ii) => (
                    <div key={ii} className="menu-item-row">
                      <input
                        type="text"
                        className="menu-item-name"
                        placeholder="Item name"
                        value={it.name}
                        onChange={(e) => updateMenuItem(si, ii, { name: e.target.value })}
                      />
                      <div className="menu-item-desc-wrap">
                        <input
                          type="text"
                          className="menu-item-desc"
                          placeholder="Description"
                          value={it.description}
                          onChange={(e) => updateMenuItem(si, ii, { description: e.target.value })}
                        />
                        <span className="label-optional">*optional</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="menu-item-price"
                        placeholder="Price"
                        value={it.price}
                        onChange={(e) => updateMenuItem(si, ii, { price: e.target.value })}
                      />
                      <button
                        type="button"
                        className="menu-item-remove"
                        onClick={() => removeMenuItem(si, ii)}
                        title="Remove item"
                      >
                        ×
                      </button>
                      <div className="menu-item-photo-group">
                        <ImageListInput
                          label={<>Photos <span className="label-optional">*optional</span></>}
                          hint="The first photo is the one shown next to this item. Click a photo on the menu to open all of them."
                          primaryHint="Primary"
                          value={Array.isArray(it.photos) ? it.photos : []}
                          onChange={(next) => updateMenuItem(si, ii, { photos: next })}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="menu-add-item-btn"
                    onClick={() => addMenuItem(si)}
                  >
                    + Add item
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="add-account-btn"
                onClick={addMenuSection}
              >
                + Add Section
              </button>

              <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: 24 }}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              {success && <div className="form-feedback success-message">{success}</div>}
              {error && <div className="form-feedback error-message">{error}</div>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const NAME_OK = /^[A-Za-z\s]*$/;
const PHONE_OK = /^\d*$/;

function AccountsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // In-progress new accounts; each item: { localId, role }. Saved rows come back via the query.
  const [drafts, setDrafts] = useState([]);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['restaurant', 'staff'],
    queryFn: () => apiFetch('/restaurant/staff'),
  });

  if (isLoading) return <div className="loading">Loading accounts...</div>;
  if (loadError) return <div className="error-message">Failed to load accounts</div>;
  const staff = data?.staff || [];

  // Removing accounts is restricted to the primary owner.
  const isPrimaryOwner = staff.some(s => s.is_primary_owner && s.id === user?.id);

  const addDraft = (role) => setDrafts(d => [...d, { localId: Date.now() + Math.random(), role }]);
  const removeDraft = (localId) => setDrafts(d => d.filter(x => x.localId !== localId));
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['restaurant', 'staff'] });

  return (
    <div className="accounts-list">
      {staff.map(account => (
        <AccountEditor
          key={account.id}
          account={account}
          onSaved={invalidate}
          canRemove={isPrimaryOwner && !account.is_primary_owner}
        />
      ))}
      {drafts.map(draft => (
        <NewAccountForm
          key={draft.localId}
          role={draft.role}
          onCancel={() => removeDraft(draft.localId)}
          onCreated={() => { removeDraft(draft.localId); invalidate(); }}
        />
      ))}
      <button type="button" className="add-account-btn" onClick={() => addDraft('restaurant')}>
        + Add Owner Account
      </button>
      <button type="button" className="add-account-btn" onClick={() => addDraft('hostess')}>
        + Add Hostess Account
      </button>
    </div>
  );
}

function NewAccountForm({ role, onCancel, onCreated }) {
  const [draft, setDraft] = useState({ name: '', email: '', password: '', phone: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [rowError, setRowError] = useState(null);

  const create = useMutation({
    mutationFn: (body) => apiFetch('/restaurant/staff', { method: 'POST', body }),
    onSuccess: () => onCreated?.(),
    onError: (err) => setRowError(err.message),
  });

  const onField = (field, raw) => {
    let value = raw;
    if (field === 'name') {
      if (!NAME_OK.test(value)) {
        setFieldErrors(p => ({ ...p, name: 'Wrong format — letters only' }));
        value = value.replace(/[^A-Za-z\s]/g, '');
      } else {
        setFieldErrors(p => { const n = { ...p }; delete n.name; return n; });
      }
    } else if (field === 'phone') {
      if (!PHONE_OK.test(value)) {
        setFieldErrors(p => ({ ...p, phone: 'Wrong format — digits only' }));
        value = value.replace(/\D/g, '');
      } else {
        setFieldErrors(p => { const n = { ...p }; delete n.phone; return n; });
      }
    }
    setDraft(d => ({ ...d, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) { setRowError('Name is required'); return; }
    if (!draft.email.trim()) { setRowError('Email is required'); return; }
    if (!draft.password || draft.password.length < 6) { setRowError('Password must be at least 6 characters'); return; }
    setRowError(null);
    create.mutate({
      role,
      name: draft.name.trim(),
      email: draft.email.trim(),
      password: draft.password,
      phone: draft.phone.trim(),
    });
  };

  const roleLabel = role === 'restaurant' ? 'New Owner' : 'New Hostess';
  const roleClass = role === 'restaurant' ? 'owner' : 'hostess';

  return (
    <form className="account-block" onSubmit={handleSubmit}>
      <div className="account-block-header">
        <h4 className="account-block-title">
          {roleLabel}
          <span className={`account-row-badge ${roleClass}`}>{role === 'restaurant' ? 'Owner' : 'Hostess'}</span>
        </h4>
        <button type="button" className="account-block-remove" onClick={onCancel}>Cancel</button>
      </div>
      <div className="form-group">
        <label>Full Name</label>
        <input type="text" value={draft.name} onChange={(e) => onField('name', e.target.value)} placeholder="John Smith" />
        {fieldErrors.name && <div className="field-error-popup">{fieldErrors.name}</div>}
      </div>
      <div className="form-group">
        <label>Email</label>
        <input type="email" value={draft.email} onChange={(e) => onField('email', e.target.value)} placeholder="staff@restaurant.com" />
      </div>
      <div className="form-group">
        <label>Password</label>
        <input type="password" value={draft.password} onChange={(e) => onField('password', e.target.value)} placeholder="Min 6 characters" />
      </div>
      <div className="form-group">
        <label>Phone <span className="label-optional">*optional</span></label>
        <input
          type="tel"
          inputMode="numeric"
          value={draft.phone}
          onChange={(e) => onField('phone', e.target.value)}
          placeholder="359888000000"
        />
        {fieldErrors.phone && <div className="field-error-popup">{fieldErrors.phone}</div>}
      </div>
      <button type="submit" className="submit-btn" disabled={create.isPending} style={{ width: 'auto' }}>
        {create.isPending ? 'Creating...' : 'Create account'}
      </button>
      {rowError && <div className="form-feedback error-message">{rowError}</div>}
    </form>
  );
}

function AccountEditor({ account, onSaved, canRemove }) {
  const [draft, setDraft] = useState({
    name: account.name || '',
    email: account.email || '',
    phone: account.phone || '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [rowError, setRowError] = useState(null);
  const [rowSuccess, setRowSuccess] = useState(null);

  const save = useMutation({
    mutationFn: (body) => apiFetch(`/restaurant/staff/${account.id}`, { method: 'PUT', body }),
    onSuccess: () => {
      setRowError(null);
      setRowSuccess('Saved');
      setTimeout(() => setRowSuccess(null), 2000);
      onSaved?.();
    },
    onError: (err) => setRowError(err.message),
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/restaurant/staff/${account.id}`, { method: 'DELETE' }),
    onSuccess: () => onSaved?.(),
    onError: (err) => setRowError(err.message),
  });

  const handleRemove = () => {
    if (!window.confirm(`Remove ${account.name}'s account? This cannot be undone.`)) return;
    remove.mutate();
  };

  const onField = (field, raw) => {
    setRowSuccess(null);
    let value = raw;
    if (field === 'name') {
      if (!NAME_OK.test(value)) {
        setFieldErrors(p => ({ ...p, name: 'Wrong format — letters only' }));
        value = value.replace(/[^A-Za-z\s]/g, '');
      } else {
        setFieldErrors(p => { const n = { ...p }; delete n.name; return n; });
      }
    } else if (field === 'phone') {
      if (!PHONE_OK.test(value)) {
        setFieldErrors(p => ({ ...p, phone: 'Wrong format — digits only' }));
        value = value.replace(/\D/g, '');
      } else {
        setFieldErrors(p => { const n = { ...p }; delete n.phone; return n; });
      }
    }
    setDraft(d => ({ ...d, [field]: value }));
  };

  const dirty =
    draft.name !== (account.name || '') ||
    draft.email !== (account.email || '') ||
    draft.phone !== (account.phone || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) { setRowError('Name is required'); return; }
    if (!draft.email.trim()) { setRowError('Email is required'); return; }
    setRowError(null);
    save.mutate({ name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() });
  };

  const roleLabel = account.role === 'restaurant' ? 'Owner' : 'Hostess';
  const roleClass = account.role === 'restaurant' ? 'owner' : 'hostess';

  return (
    <form className="account-block" onSubmit={handleSubmit}>
      <div className="account-block-header">
        <h4 className="account-block-title">
          {account.name}
          <span className={`account-row-badge ${roleClass}`}>{roleLabel}</span>
          {account.is_primary_owner && <span className="account-row-badge primary">Primary</span>}
        </h4>
        {canRemove && (
          <button
            type="button"
            className="account-block-danger"
            onClick={handleRemove}
            disabled={remove.isPending}
          >
            {remove.isPending ? 'Removing...' : 'Remove'}
          </button>
        )}
      </div>
      <div className="form-group">
        <label>Full Name</label>
        <input type="text" value={draft.name} onChange={(e) => onField('name', e.target.value)} />
        {fieldErrors.name && <div className="field-error-popup">{fieldErrors.name}</div>}
      </div>
      <div className="form-group">
        <label>Email</label>
        <input type="email" value={draft.email} onChange={(e) => onField('email', e.target.value)} />
      </div>
      <div className="form-group">
        <label>Phone <span className="label-optional">*optional</span></label>
        <input
          type="tel"
          inputMode="numeric"
          value={draft.phone}
          onChange={(e) => onField('phone', e.target.value)}
          placeholder="359888000000"
        />
        {fieldErrors.phone && <div className="field-error-popup">{fieldErrors.phone}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="submit"
          className="submit-btn"
          disabled={!dirty || save.isPending}
          style={{ width: 'auto' }}
        >
          {save.isPending ? 'Saving...' : 'Save'}
        </button>
        {rowSuccess && <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>{rowSuccess}</span>}
      </div>
      {rowError && <div className="form-feedback error-message">{rowError}</div>}
    </form>
  );
}

export default RestaurantSettingsPage;
