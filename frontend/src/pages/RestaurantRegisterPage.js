import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LocationPicker from '../components/LocationPicker';
import ImageListInput from '../components/ImageListInput';
import TablesEditor from '../components/TablesEditor';
import TimeInput from '../components/TimeInput';
import DatePicker from '../components/DatePicker';

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
    cover_images: [],
    gallery_images: [],
    tables: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, seats: 4 })),
    reservation_start_time: '10:00',
    reservation_end_time: '23:00',
    closed_days: [],
    special_closures: [],
    latitude: null,
    longitude: null
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
    if (!restaurantData.tables || restaurantData.tables.length === 0) return 'Add at least one table';
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
    if (step === 3) {
      const err = validateStep3();
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
        special_closures: JSON.stringify(restaurantData.special_closures),
        cover_images: JSON.stringify(restaurantData.cover_images),
        gallery_images: JSON.stringify(restaurantData.gallery_images),
        tables: JSON.stringify(restaurantData.tables),
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
          <p className="register-restaurant-subtitle">Join TakeASeat and start managing your reservations</p>

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
                  <label>Phone <span className="label-optional">*optional</span></label>
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
                  <label>Pin Location on Map</label>
                  <LocationPicker
                    lat={restaurantData.latitude}
                    lng={restaurantData.longitude}
                    address={restaurantData.address}
                    onChange={(lat, lng) => setRestaurantData(prev => ({ ...prev, latitude: lat, longitude: lng }))}
                  />
                </div>
                <div className="form-group">
                  <label>Description <span className="label-optional">*optional</span></label>
                  <textarea name="description" value={restaurantData.description} onChange={handleRestaurantChange} placeholder="Tell customers about your restaurant..." rows={3} className="form-textarea" />
                </div>
                <div className="form-group">
                  <label>Restaurant Phone <span className="label-optional">*optional</span></label>
                  <input type="tel" name="restaurant_phone" value={restaurantData.restaurant_phone} onChange={handleRestaurantChange} placeholder="+359 2 000 0000" />
                </div>
                <div className="form-group">
                  <label>Opening Hours <span className="label-optional">*optional</span></label>
                  <input type="text" name="opening_hours" value={restaurantData.opening_hours} onChange={handleRestaurantChange} placeholder="Mon–Fri 12:00–22:00, Sat–Sun 11:00–23:00" />
                </div>
                <ImageListInput
                  label={<>Cover Photos <span className="label-optional">*optional</span></>}
                  hint="Shown as a slideshow at the top of your restaurant page. The first photo is the primary cover."
                  primaryHint="Primary"
                  value={restaurantData.cover_images}
                  onChange={(next) => setRestaurantData({ ...restaurantData, cover_images: next })}
                />
                <ImageListInput
                  label={<>Gallery Photos <span className="label-optional">*optional</span></>}
                  hint='Shown when guests click the "See more photos" button.'
                  value={restaurantData.gallery_images}
                  onChange={(next) => setRestaurantData({ ...restaurantData, gallery_images: next })}
                />
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
                <TablesEditor
                  value={restaurantData.tables}
                  onChange={(next) => setRestaurantData({ ...restaurantData, tables: next })}
                />
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
                      <TimeInput
                        value={restaurantData.reservation_start_time}
                        onChange={(v) => setRestaurantData({ ...restaurantData, reservation_start_time: v })}
                      />
                    </div>
                    <span className="schedule-time-separator">to</span>
                    <div className="form-group">
                      <label>Until</label>
                      <TimeInput
                        value={restaurantData.reservation_end_time}
                        onChange={(v) => setRestaurantData({ ...restaurantData, reservation_end_time: v })}
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
                    <div className="form-group">
                      <label>Date</label>
                      <DatePicker
                        value={newClosure.date}
                        onChange={(d) => setNewClosure({ ...newClosure, date: d })}
                        specialClosures={restaurantData.special_closures}
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
