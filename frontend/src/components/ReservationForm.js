import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:3001/api';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Generate time slots for a given range in 30-min intervals
function generateTimeSlots(startTime, endTime) {
  const [startH, startM] = (startTime || '10:00').split(':').map(Number);
  const [endH] = (endTime || '23:00').split(':').map(Number);
  const slots = [];
  for (let h = startH; h <= endH; h++) {
    if (h === startH && startM > 0) {
      slots.push(`${String(h).padStart(2, '0')}:30`);
    } else {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      if (h < endH) slots.push(`${String(h).padStart(2, '0')}:30`);
    }
  }
  return slots;
}

function ReservationForm({ restaurantId, restaurant }) {
  const { user } = useAuth();

  // Parse restaurant schedule config
  let closedDays = [];
  let specialClosures = [];
  try { closedDays = JSON.parse(restaurant?.closed_days || '[]'); } catch {}
  try { specialClosures = JSON.parse(restaurant?.special_closures || '[]'); } catch {}
  const closureDates = specialClosures.map(c => c.date);
  const TIME_SLOTS = generateTimeSlots(restaurant?.reservation_start_time, restaurant?.reservation_end_time);

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
  const [showNotes, setShowNotes] = useState(false);

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
    if (date < today || isClosed(day)) return;
    const yyyy = calYear;
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const updates = { ...formData, date: dateStr };
    // Clear selected time if it's now in the past for today
    if (isToday(day) && formData.time) {
      const now = new Date();
      const [h, m] = formData.time.split(':').map(Number);
      if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
        updates.time = '';
      }
    }
    setFormData(updates);
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

  const isClosed = (day) => {
    const date = new Date(calYear, calMonth, day);
    // JS getDay: 0=Sun, convert to Mon=0 format
    const jsDay = date.getDay();
    const mondayBased = jsDay === 0 ? 6 : jsDay - 1;
    if (closedDays.includes(mondayBased)) return true;
    // Check special closures
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${calYear}-${mm}-${dd}`;
    if (closureDates.includes(dateStr)) return true;
    return false;
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
                      className={`cal-cell ${isPast(day) || isClosed(day) ? 'disabled' : ''} ${isSelected(day) ? 'selected' : ''} ${isToday(day) ? 'today' : ''} ${isClosed(day) && !isPast(day) ? 'closed' : ''}`}
                      onClick={() => selectDate(day)}
                      disabled={isPast(day) || isClosed(day)}
                      title={isClosed(day) ? 'Closed' : ''}
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
            {TIME_SLOTS.filter(slot => !isTimeSlotPast(slot)).map(slot => (
              <button
                key={slot}
                type="button"
                className={`time-slot ${formData.time === slot ? 'selected' : ''}`}
                onClick={() => setFormData({ ...formData, time: slot })}
              >
                {slot}
              </button>
            ))}
            {TIME_SLOTS.every(slot => isTimeSlotPast(slot)) && formData.date && (
              <p className="no-slots-msg">No available time slots for today</p>
            )}
          </div>
        </div>

        {/* Notes - collapsible */}
        <div className="res-section">
          <button
            type="button"
            className="notes-toggle"
            onClick={() => setShowNotes(s => !s)}
          >
            <span>Special Requests (optional)</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`notes-arrow ${showNotes ? 'open' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showNotes && (
            <div className="form-group" style={{ marginTop: 8 }}>
              <input type="text" id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="e.g. birthday, allergy, high chair" />
            </div>
          )}
        </div>

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? 'Reserving...' : 'Reserve a Table'}
        </button>
      </form>
    </div>
  );
}

export default ReservationForm;
