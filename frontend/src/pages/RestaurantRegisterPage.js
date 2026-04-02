import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RestaurantRegisterPage() {
  const { restaurantRegister } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=owner, 2=restaurant info, 3=capacity, 4=schedule
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [ownerData, setOwnerData] = useState({ name: '', email: '', password: '', phone: '' });
  const [restaurantData, setRestaurantData] = useState({
    restaurant_name: '',
    address: '',
    description: '',
    restaurant_phone: '',
    opening_hours: '',
    image_url: '',
    num_tables: '10',
    seats_per_table: '4',
    max_guests: '40',
    reservation_start_time: '10:00',
    reservation_end_time: '23:00',
    closed_days: [],
    special_closures: []
  });
  const [newClosure, setNewClosure] = useState({ date: '', reason: '' });

  const handleOwnerChange = (e) => setOwnerData({ ...ownerData, [e.target.name]: e.target.value });
  const handleRestaurantChange = (e) => setRestaurantData({ ...restaurantData, [e.target.name]: e.target.value });

  const validateStep1 = () => {
    if (!ownerData.name.trim()) return 'Name is required';
    if (!ownerData.email.trim()) return 'Email is required';
    if (!ownerData.password || ownerData.password.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  const validateStep2 = () => {
    if (!restaurantData.restaurant_name.trim()) return 'Restaurant name is required';
    if (!restaurantData.address.trim()) return 'Address is required';
    return null;
  };

  const validateStep3 = () => {
    if (parseInt(restaurantData.num_tables, 10) <= 0) return 'Number of tables must be positive';
    if (parseInt(restaurantData.seats_per_table, 10) <= 0) return 'Seats per table must be positive';
    if (parseInt(restaurantData.max_guests, 10) <= 0) return 'Max guests must be positive';
    return null;
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) { setError(err); return; }
    }
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(s => s - 1);
  };

  const toggleClosedDay = (day) => {
    setRestaurantData(prev => {
      const days = prev.closed_days.includes(day)
        ? prev.closed_days.filter(d => d !== day)
        : [...prev.closed_days, day];
      return { ...prev, closed_days: days };
    });
  };

  const addClosure = () => {
    if (!newClosure.date) return;
    setRestaurantData(prev => ({
      ...prev,
      special_closures: [...prev.special_closures, { ...newClosure }]
    }));
    setNewClosure({ date: '', reason: '' });
  };

  const removeClosure = (index) => {
    setRestaurantData(prev => ({
      ...prev,
      special_closures: prev.special_closures.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    setLoading(true);
    try {
      const payload = {
        ...restaurantData,
        closed_days: JSON.stringify(restaurantData.closed_days),
        special_closures: JSON.stringify(restaurantData.special_closures)
      };
      await restaurantRegister(ownerData, payload);
      navigate('/restaurant/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Link to="/" className="back-link">&larr; Back to home</Link>

      <div className="register-restaurant-container">
        <div className="register-restaurant-card">
          <h1>Register Your Restaurant</h1>
          <p className="register-restaurant-subtitle">Join RestaurantBook and start managing your reservations</p>

          {/* Step indicator */}
          <div className="register-steps">
            {['Account', 'Restaurant Info', 'Capacity', 'Schedule'].map((label, i) => (
              <div key={i} className={`register-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
                <div className="register-step-circle">{step > i + 1 ? '✓' : i + 1}</div>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Owner account */}
            {step === 1 && (
              <div className="register-step-content">
                <h2>Your Account</h2>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" name="name" value={ownerData.name} onChange={handleOwnerChange} placeholder="John Smith" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" name="email" value={ownerData.email} onChange={handleOwnerChange} placeholder="owner@restaurant.com" />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" name="password" value={ownerData.password} onChange={handleOwnerChange} placeholder="Min 6 characters" />
                </div>
                <div className="form-group">
                  <label>Phone (optional)</label>
                  <input type="tel" name="phone" value={ownerData.phone} onChange={handleOwnerChange} placeholder="+359 888 000 000" />
                </div>
                <button type="button" className="submit-btn" onClick={handleNext}>Next →</button>
              </div>
            )}

            {/* Step 2: Restaurant info */}
            {step === 2 && (
              <div className="register-step-content">
                <h2>Restaurant Details</h2>
                <div className="form-group">
                  <label>Restaurant Name</label>
                  <input type="text" name="restaurant_name" value={restaurantData.restaurant_name} onChange={handleRestaurantChange} placeholder="My Restaurant" />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" name="address" value={restaurantData.address} onChange={handleRestaurantChange} placeholder="ul. Example 10, Sofia" />
                </div>
                <div className="form-group">
                  <label>Description (optional)</label>
                  <textarea name="description" value={restaurantData.description} onChange={handleRestaurantChange} placeholder="Tell customers about your restaurant..." rows={3} className="form-textarea" />
                </div>
                <div className="form-group">
                  <label>Restaurant Phone (optional)</label>
                  <input type="tel" name="restaurant_phone" value={restaurantData.restaurant_phone} onChange={handleRestaurantChange} placeholder="+359 2 000 0000" />
                </div>
                <div className="form-group">
                  <label>Opening Hours (optional)</label>
                  <input type="text" name="opening_hours" value={restaurantData.opening_hours} onChange={handleRestaurantChange} placeholder="Mon–Fri 12:00–22:00, Sat–Sun 11:00–23:00" />
                </div>
                <div className="form-group">
                  <label>Image URL (optional)</label>
                  <input type="url" name="image_url" value={restaurantData.image_url} onChange={handleRestaurantChange} placeholder="https://..." />
                </div>
                <div className="register-step-actions">
                  <button type="button" className="back-step-btn" onClick={handleBack}>← Back</button>
                  <button type="button" className="submit-btn" onClick={handleNext}>Next →</button>
                </div>
              </div>
            )}

            {/* Step 3: Capacity */}
            {step === 3 && (
              <div className="register-step-content">
                <h2>Capacity</h2>
                <div className="register-capacity-grid">
                  <div className="form-group">
                    <label>Number of Tables</label>
                    <input type="number" name="num_tables" value={restaurantData.num_tables} onChange={handleRestaurantChange} min="1" />
                  </div>
                  <div className="form-group">
                    <label>Seats per Table</label>
                    <input type="number" name="seats_per_table" value={restaurantData.seats_per_table} onChange={handleRestaurantChange} min="1" />
                  </div>
                  <div className="form-group">
                    <label>Max Guests at Once</label>
                    <input type="number" name="max_guests" value={restaurantData.max_guests} onChange={handleRestaurantChange} min="1" />
                  </div>
                </div>
                <div className="capacity-summary">
                  Total capacity: {parseInt(restaurantData.num_tables, 10) * parseInt(restaurantData.seats_per_table, 10) || 0} seats
                </div>
                <div className="register-step-actions">
                  <button type="button" className="back-step-btn" onClick={handleBack}>← Back</button>
                  <button type="button" className="submit-btn" onClick={handleNext}>Next →</button>
                </div>
              </div>
            )}

            {/* Step 4: Schedule */}
            {step === 4 && (
              <div className="register-step-content">
                <h2>Reservation Schedule</h2>

                <div className="schedule-section">
                  <h3 className="schedule-section-title">Reservation Hours</h3>
                  <p className="schedule-hint">Set the time window when customers can book reservations.</p>
                  <div className="schedule-time-row">
                    <div className="form-group">
                      <label>From</label>
                      <input
                        type="time"
                        value={restaurantData.reservation_start_time}
                        onChange={e => setRestaurantData({ ...restaurantData, reservation_start_time: e.target.value })}
                      />
                    </div>
                    <span className="schedule-time-separator">to</span>
                    <div className="form-group">
                      <label>Until</label>
                      <input
                        type="time"
                        value={restaurantData.reservation_end_time}
                        onChange={e => setRestaurantData({ ...restaurantData, reservation_end_time: e.target.value })}
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
                        className={`closed-day-btn ${restaurantData.closed_days.includes(i) ? 'closed' : ''}`}
                        onClick={() => toggleClosedDay(i)}
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
                    <input
                      type="date"
                      value={newClosure.date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setNewClosure({ ...newClosure, date: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={newClosure.reason}
                      onChange={e => setNewClosure({ ...newClosure, reason: e.target.value })}
                    />
                    <button type="button" className="closure-add-btn" onClick={addClosure} disabled={!newClosure.date}>
                      + Add
                    </button>
                  </div>
                  {restaurantData.special_closures.length > 0 && (
                    <div className="closures-list">
                      {restaurantData.special_closures.map((c, i) => (
                        <div key={i} className="closure-item">
                          <span className="closure-date">
                            {new Date(c.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          {c.reason && <span className="closure-reason">{c.reason}</span>}
                          <button type="button" className="closure-remove-btn" onClick={() => removeClosure(i)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="register-step-actions">
                  <button type="button" className="back-step-btn" onClick={handleBack}>← Back</button>
                  <button type="submit" className="submit-btn" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Restaurant'}
                  </button>
                </div>
              </div>
            )}
          </form>

          <div className="register-restaurant-footer">
            Already have an account? <Link to="/" className="register-link">Sign in from the header</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RestaurantRegisterPage;
