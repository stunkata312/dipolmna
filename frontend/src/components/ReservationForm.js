import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:3001/api';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Generate time slots from 10:00 to 23:00 in 30-min intervals
const TIME_SLOTS = [];
for (let h = 10; h <= 23; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 23) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

function ReservationForm({ restaurantId }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    num_people: 2,
    notes: ''
  });
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Calendar state
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validate = () => {
    if (!formData.name.trim()) return 'Name is required';
    if (!formData.email.trim()) return 'Email is required';
    if (!formData.date) return 'Please select a date';
    if (!formData.time) return 'Please select a time';
    if (!formData.num_people || formData.num_people <= 0) {
      return 'Number of people must be at least 1';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          restaurant_id: restaurantId,
          num_people: parseInt(formData.num_people, 10)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create reservation');
      }

      setSuccess('Reservation submitted! The restaurant will confirm shortly.');
      setFormData({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        date: '',
        time: '',
        num_people: 2,
        notes: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Calendar helpers
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday = 0
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  const canGoPrev = calYear > today.getFullYear() || (calYear === today.getFullYear() && calMonth > today.getMonth());

  const selectDate = (day) => {
    const date = new Date(calYear, calMonth, day);
    if (date < today) return;
    const yyyy = calYear;
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    setFormData({ ...formData, date: `${yyyy}-${mm}-${dd}` });
  };

  const isSelected = (day) => {
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return formData.date === `${calYear}-${mm}-${dd}`;
  };

  const isToday = (day) => {
    return calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate();
  };

  const isPast = (day) => {
    const date = new Date(calYear, calMonth, day);
    return date < today;
  };

  // Time slot helpers
  const isTimeSlotPast = (slot) => {
    if (!formData.date) return false;
    const selectedDate = new Date(formData.date + 'T00:00:00');
    if (selectedDate > today) return false;
    // Same day — check if time has passed
    const now = new Date();
    const [h, m] = slot.split(':').map(Number);
    return h < now.getHours() || (h === now.getHours() && m <= now.getMinutes());
  };

  // People counter
  const decrementPeople = () => {
    if (formData.num_people > 1) {
      setFormData({ ...formData, num_people: formData.num_people - 1 });
    }
  };

  const incrementPeople = () => {
    if (formData.num_people < 20) {
      setFormData({ ...formData, num_people: formData.num_people + 1 });
    }
  };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(calMonth, calYear);
  const firstDay = getFirstDayOfMonth(calMonth, calYear);
  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  return (
    <div className="reservation-card modern-reservation">
      <h2>Make a Reservation</h2>

      {success && <div className="success-message">{success}</div>}
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Personal Info */}
        <div className="res-section">
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Your name" />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} placeholder="your@email.com" />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Phone (optional)</label>
            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="+359 888 000 000" />
          </div>
        </div>

        {/* People Counter */}
        <div className="res-section">
          <label className="res-section-label">Party Size</label>
          <div className="people-counter">
            <button type="button" className="counter-btn" onClick={decrementPeople} disabled={formData.num_people <= 1}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <div className="counter-display">
              <span className="counter-value">{formData.num_people}</span>
              <span className="counter-label">{formData.num_people === 1 ? 'Guest' : 'Guests'}</span>
            </div>
            <button type="button" className="counter-btn" onClick={incrementPeople} disabled={formData.num_people >= 20}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Calendar */}
        <div className="res-section">
          <label className="res-section-label">Select Date</label>
          <div className="custom-calendar">
            <div className="cal-header">
              <button type="button" className="cal-nav" onClick={prevMonth} disabled={!canGoPrev}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="cal-title">{MONTH_NAMES[calMonth]} {calYear}</span>
              <button type="button" className="cal-nav" onClick={nextMonth}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 6 15 12 9 18" />
                </svg>
              </button>
            </div>
            <div className="cal-days-header">
              {DAY_NAMES.map(d => <div key={d} className="cal-day-name">{d}</div>)}
            </div>
            <div className="cal-grid">
              {calendarCells.map((day, i) => (
                <div key={i} className="cal-cell-wrapper">
                  {day ? (
                    <button
                      type="button"
                      className={`cal-cell ${isPast(day) ? 'disabled' : ''} ${isSelected(day) ? 'selected' : ''} ${isToday(day) ? 'today' : ''}`}
                      onClick={() => selectDate(day)}
                      disabled={isPast(day)}
                    >
                      {day}
                    </button>
                  ) : <div className="cal-cell empty" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Time Slots */}
        <div className="res-section">
          <label className="res-section-label">Select Time</label>
          <div className="time-slots-grid">
            {TIME_SLOTS.map(slot => (
              <button
                key={slot}
                type="button"
                className={`time-slot ${formData.time === slot ? 'selected' : ''} ${isTimeSlotPast(slot) ? 'disabled' : ''}`}
                onClick={() => !isTimeSlotPast(slot) && setFormData({ ...formData, time: slot })}
                disabled={isTimeSlotPast(slot)}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="res-section">
          <div className="form-group">
            <label htmlFor="notes">Special Requests (optional)</label>
            <input type="text" id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="e.g. birthday, allergy, high chair" />
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? 'Reserving...' : 'Reserve a Table'}
        </button>
      </form>
    </div>
  );
}

export default ReservationForm;
