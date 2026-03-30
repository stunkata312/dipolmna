import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:3001/api';

function RestaurantSettingsPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!user || user.role !== 'restaurant') { navigate('/'); return; }
    fetch(`${API_URL}/restaurant/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setForm({
          name: d.name || '',
          address: d.address || '',
          description: d.description || '',
          phone: d.phone || '',
          opening_hours: d.opening_hours || '',
          image_url: d.image_url || '',
          num_tables: String(d.num_tables || 10),
          seats_per_table: String(d.seats_per_table || 4),
          max_guests: String(d.max_guests || 40)
        });
        setLoading(false);
      })
      .catch(() => { setError('Failed to load settings'); setLoading(false); });
  }, [user, token, navigate]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      setError('Name and address are required'); return;
    }
    setSaving(true); setError(null); setSuccess(null);
    try {
      const res = await fetch(`${API_URL}/restaurant/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          num_tables: parseInt(form.num_tables, 10),
          seats_per_table: parseInt(form.seats_per_table, 10),
          max_guests: parseInt(form.max_guests, 10)
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to save');
      setSuccess('Settings saved successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== 'restaurant') return null;
  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div>
      <Link to="/restaurant/dashboard" className="back-link">&larr; Back to Dashboard</Link>
      <div className="settings-container">
        <div className="settings-card">
          <h1>Restaurant Settings</h1>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

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
            <div className="form-group">
              <label>Image URL</label>
              <input type="url" name="image_url" value={form.image_url} onChange={handleChange} placeholder="https://..." />
            </div>

            <h2 className="settings-section-title">Capacity</h2>
            <div className="register-capacity-grid">
              <div className="form-group">
                <label>Number of Tables</label>
                <input type="number" name="num_tables" value={form.num_tables} onChange={handleChange} min="1" />
              </div>
              <div className="form-group">
                <label>Seats per Table</label>
                <input type="number" name="seats_per_table" value={form.seats_per_table} onChange={handleChange} min="1" />
              </div>
              <div className="form-group">
                <label>Max Guests at Once</label>
                <input type="number" name="max_guests" value={form.max_guests} onChange={handleChange} min="1" />
              </div>
            </div>
            <div className="capacity-summary">
              Total capacity: {parseInt(form.num_tables, 10) * parseInt(form.seats_per_table, 10) || 0} seats
            </div>

            <button type="submit" className="submit-btn" disabled={saving} style={{ marginTop: 24 }}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RestaurantSettingsPage;
