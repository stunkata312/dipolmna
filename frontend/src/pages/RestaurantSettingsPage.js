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

const SETTINGS_KEY = ['restaurant', 'me'];

function RestaurantSettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [newClosure, setNewClosure] = useState({ date: '', reason: '' });

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
    try { closedDays = JSON.parse(settings.closed_days || '[]'); } catch {}
    try { specialClosures = JSON.parse(settings.special_closures || '[]'); } catch {}
    try { coverImages = JSON.parse(settings.cover_images || '[]'); } catch {}
    try { galleryImages = JSON.parse(settings.gallery_images || '[]'); } catch {}
    try { tables = JSON.parse(settings.tables || '[]'); } catch {}
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

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      setError('Name and address are required');
      return;
    }
    setError(null);
    setSuccess(null);
    saveSettings.mutate({
      ...form,
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

          <form onSubmit={handleSave}>
            <h2 className="settings-section-title">Basic Info</h2>
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
            <div className="form-group">
              <label>Opening Hours</label>
              <input type="text" name="opening_hours" value={form.opening_hours} onChange={handleChange} placeholder="Mon–Fri 12:00–22:00" />
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

            <h2 className="settings-section-title">Capacity</h2>
            <TablesEditor
              value={form.tables}
              onChange={(next) => setForm({ ...form, tables: next })}
            />

            <h2 className="settings-section-title">Reservation Schedule</h2>
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
              <h3 className="schedule-section-title">Weekly Closed Days</h3>
              <p className="schedule-hint">Select the days your restaurant is closed every week.</p>
              <div className="closed-days-grid">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => (
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

            <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: 24 }}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            {success && <div className="form-feedback success-message">{success}</div>}
            {error && <div className="form-feedback error-message">{error}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}

export default RestaurantSettingsPage;
