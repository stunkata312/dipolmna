import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/client';
import Calendar from './Calendar';

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

// JS getDay() is 0=Sun..6=Sat; the registration form uses 0=Mon..6=Sun, so
// convert before looking the day up in open_hours_json.
function jsDateToMonIdx(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

function ReservationForm({ restaurantId, restaurant }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Parse restaurant schedule config
  let closedDays = [];
  let specialClosures = [];
  let openHours = {};
  try { closedDays = JSON.parse(restaurant?.closed_days || '[]'); } catch {}
  try { specialClosures = JSON.parse(restaurant?.special_closures || '[]'); } catch {}
  try { openHours = JSON.parse(restaurant?.open_hours_json || '{}'); } catch {}

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    date: '',
    time: '',
    num_people: 2,
    notes: '',
    preferred_table: null,
  });
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [showNotes, setShowNotes] = useState(false);

  // Reservation Hours are the baseline window for every day. Opening Hours
  // is a map of per-weekday overrides — if the chosen date's weekday has an
  // entry, those hours replace the baseline for that day (intersected with
  // it). Days NOT in the override map keep the baseline. Weekly-closed days
  // and special closures are filtered separately by the calendar.
  const rsvFrom = restaurant?.reservation_start_time || '10:00';
  const rsvUntil = restaurant?.reservation_end_time || '23:00';
  const TIME_SLOTS = useMemo(() => {
    if (!formData.date) return generateTimeSlots(rsvFrom, rsvUntil);
    const idx = jsDateToMonIdx(formData.date);
    const override = openHours[idx];
    if (!override) return generateTimeSlots(rsvFrom, rsvUntil);
    const from = override.from > rsvFrom ? override.from : rsvFrom;
    const until = override.until < rsvUntil ? override.until : rsvUntil;
    if (from >= until) return [];
    return generateTimeSlots(from, until);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.date,
    restaurant?.open_hours_json,
    restaurant?.reservation_start_time,
    restaurant?.reservation_end_time,
  ]);

  // Availability for the chosen date — booked count per slot
  const { data: availability } = useQuery({
    queryKey: ['restaurant', restaurantId, 'availability', formData.date],
    queryFn: () => apiFetch(`/restaurants/${restaurantId}/availability?date=${formData.date}`),
    enabled: !!formData.date && !!restaurantId,
    staleTime: 30_000,
  });

  const slotCounts = availability?.slots || {};
  const numTables = availability?.num_tables ?? restaurant?.num_tables ?? 1;
  const allTables = availability?.tables || [];
  const takenAtSlot = (availability?.taken_tables || {})[formData.time] || [];
  const isSlotFull = (slot) => (slotCounts[slot] || 0) >= numTables;
  const slotLoad = (slot) => {
    const c = slotCounts[slot] || 0;
    if (c === 0) return 'free';
    if (c >= numTables) return 'full';
    if (c >= numTables * 0.6) return 'busy';
    return 'some';
  };

  // Tables that fit the party and are free at the chosen time, sorted by best fit (smallest seats >= party size first)
  const recommendedTables = (() => {
    if (!formData.time || allTables.length === 0) return [];
    const partySize = parseInt(formData.num_people, 10) || 1;
    const takenSet = new Set(takenAtSlot);
    return allTables
      .filter(t => !takenSet.has(t.id) && t.seats >= partySize)
      .sort((a, b) => a.seats - b.seats || a.id - b.id);
  })();

  const createReservation = useMutation({
    mutationFn: (payload) => apiFetch('/reservations', { method: 'POST', body: payload }),
    onSuccess: () => {
      setSuccess('Reservation submitted! The restaurant will confirm shortly.');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['user', 'reservations'] });
      setFormData({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        date: '',
        time: '',
        num_people: 2,
        notes: '',
        preferred_table: null,
      });
      setShowTablePicker(false);
    },
    onError: (err) => setError(err.message),
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuccess(null);
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    createReservation.mutate({
      ...formData,
      restaurant_id: restaurantId,
      num_people: parseInt(formData.num_people, 10),
      preferred_table: formData.preferred_table || null,
    });
  };

  const handleDateChange = (newDate) => {
    const updates = { ...formData, date: newDate };
    // If switching to today, clear a now-past time
    if (newDate && new Date(newDate + 'T00:00:00').getTime() === today.getTime() && formData.time) {
      const now = new Date();
      const [h, m] = formData.time.split(':').map(Number);
      if (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes())) {
        updates.time = '';
      }
    }
    setFormData(updates);
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

  return (
    <div className="reservation-card modern-reservation">
      <h2>Make a Reservation</h2>

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
            <label htmlFor="phone">Phone <span className="label-optional">*optional</span></label>
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
          <Calendar
            value={formData.date}
            onChange={handleDateChange}
            closedDays={closedDays}
            specialClosures={specialClosures}
          />
        </div>

        {/* Time Slots */}
        <div className="res-section">
          <div className="res-section-label-row">
            <label className="res-section-label">Select Time</label>
            {formData.date && (
              <div className="slot-legend">
                <span><i className="slot-dot slot-dot-free" /> Open</span>
                <span><i className="slot-dot slot-dot-some" /> Available</span>
                <span><i className="slot-dot slot-dot-busy" /> Limited</span>
                <span><i className="slot-dot slot-dot-full" /> Full</span>
              </div>
            )}
          </div>
          <div className="time-slots-grid">
            {TIME_SLOTS.filter(slot => !isTimeSlotPast(slot)).map(slot => {
              const full = isSlotFull(slot);
              const load = slotLoad(slot);
              const c = slotCounts[slot] || 0;
              return (
                <button
                  key={slot}
                  type="button"
                  className={`time-slot time-slot-${load} ${formData.time === slot ? 'selected' : ''}`}
                  onClick={() => !full && setFormData({ ...formData, time: slot, preferred_table: null })}
                  disabled={full}
                  title={full ? 'Fully booked' : `${c}/${numTables} tables booked`}
                >
                  <span>{slot}</span>
                  {c > 0 && <span className="slot-count">{c}/{numTables}</span>}
                </button>
              );
            })}
            {TIME_SLOTS.every(slot => isTimeSlotPast(slot)) && formData.date && (
              <p className="no-slots-msg">No available time slots for today</p>
            )}
          </div>
        </div>

        {/* Select Table — always visible, collapsible, optional */}
        <div className="res-section">
          <button
            type="button"
            className="notes-toggle"
            onClick={() => setShowTablePicker(s => !s)}
          >
            <span>
              Select Table <span className="label-optional">*optional</span>
              {formData.preferred_table && (
                <span className="picker-summary"> · Table {formData.preferred_table}</span>
              )}
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              className={`notes-arrow ${showTablePicker ? 'open' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showTablePicker && (
            <div className="customer-table-picker">
              {!formData.date || !formData.time ? (
                <p className="picker-hint">Pick a date and time first to see available tables.</p>
              ) : recommendedTables.length === 0 ? (
                <p className="picker-hint">No tables fit your party of {formData.num_people} at {formData.time}.</p>
              ) : (
                <>
                  <p className="picker-hint">
                    Showing tables that fit your party of {formData.num_people} and are free at {formData.time}.
                  </p>
                  <div className="customer-table-grid">
                    {recommendedTables.map(t => {
                      const isSelected = formData.preferred_table === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`customer-table-cell${isSelected ? ' is-selected' : ''}`}
                          onClick={() => setFormData({
                            ...formData,
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
                </>
              )}
              {formData.preferred_table && (
                <div className="picker-clear-row">
                  <button
                    type="button"
                    className="picker-clear-btn"
                    onClick={() => setFormData({ ...formData, preferred_table: null })}
                  >
                    Clear preference
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes - collapsible */}
        <div className="res-section">
          <button
            type="button"
            className="notes-toggle"
            onClick={() => setShowNotes(s => !s)}
          >
            <span>Special Requests <span className="label-optional">*optional</span></span>
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

        <button type="submit" className="submit-btn" disabled={createReservation.isPending}>
          {createReservation.isPending ? 'Reserving...' : 'Reserve a Table'}
        </button>

        {success && <div className="form-feedback success-message">{success}</div>}
        {error && <div className="form-feedback error-message">{error}</div>}
      </form>
    </div>
  );
}

export default ReservationForm;
