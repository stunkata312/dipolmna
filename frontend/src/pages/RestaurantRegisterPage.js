import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LocationPicker from '../components/LocationPicker';
import ImageListInput from '../components/ImageListInput';
import TablesEditor from '../components/TablesEditor';
import TimeInput from '../components/TimeInput';
import DatePicker from '../components/DatePicker';
import Dropdown from '../components/Dropdown';

function RestaurantRegisterPage() {
  const { restaurantRegister } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=owner, 2=restaurant info, 3=capacity, 4=schedule
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const emptyAccount = () => ({ name: '', email: '', password: '', phone: '' });
  const [owners, setOwners] = useState([emptyAccount()]);
  const [hostesses, setHostesses] = useState([]);
  // Per-field validation popups, keyed by `${group}-${index}-${field}`.
  const [fieldErrors, setFieldErrors] = useState({});
  const [restaurantData, setRestaurantData] = useState({
    restaurant_name: '',
    address: '',
    description: '',
    restaurant_phone: '',
    // Per-day OVERRIDES on top of the Reservation Hours window. Empty map
    // means the booking slots are generated from reservation_start_time /
    // reservation_end_time for every weekday. Keys are 0 = Monday … 6 = Sunday.
    // Days marked weekly-closed are filtered separately and never appear.
    open_hours: {},
    cover_images: [],
    gallery_images: [],
    tables: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, seats: 4 })),
    reservation_start_time: '10:00',
    reservation_end_time: '23:00',
    closed_days: [],
    special_closures: [],
    latitude: null,
    longitude: null,
    currency: 'EUR',
    // Each section: { name: string, items: [{ name, description, price }] }
    menu: [],
    no_show_buffer_minutes: '15',
  });
  // Field-level popup errors for step 2 (restaurant_phone today).
  const [restaurantFieldErrors, setRestaurantFieldErrors] = useState({});
  const [newClosure, setNewClosure] = useState({ date: '', reason: '' });

  const handleRestaurantChange = (e) => setRestaurantData({ ...restaurantData, [e.target.name]: e.target.value });

  const handleBufferMinutes = (raw) => {
    if (raw === '') {
      setRestaurantFieldErrors(p => { const n = { ...p }; delete n.no_show_buffer_minutes; return n; });
      setRestaurantData(prev => ({ ...prev, no_show_buffer_minutes: '' }));
      return;
    }
    if (!/^\d*$/.test(raw)) {
      setRestaurantFieldErrors(p => ({ ...p, no_show_buffer_minutes: 'Wrong format — digits only' }));
      const stripped = raw.replace(/\D/g, '');
      setRestaurantData(prev => ({ ...prev, no_show_buffer_minutes: stripped }));
      return;
    }
    setRestaurantFieldErrors(p => { const n = { ...p }; delete n.no_show_buffer_minutes; return n; });
    setRestaurantData(prev => ({ ...prev, no_show_buffer_minutes: raw }));
  };

  const handleRestaurantPhone = (raw) => {
    let value = raw;
    if (!/^\d*$/.test(value)) {
      setRestaurantFieldErrors(p => ({ ...p, restaurant_phone: 'Wrong format — digits only' }));
      value = value.replace(/\D/g, '');
    } else {
      setRestaurantFieldErrors(p => { const n = { ...p }; delete n.restaurant_phone; return n; });
    }
    setRestaurantData(prev => ({ ...prev, restaurant_phone: value }));
  };

  const addMenuSection = () => {
    setRestaurantData(prev => ({
      ...prev,
      menu: [...prev.menu, { name: '', items: [] }],
    }));
  };

  const removeMenuSection = (sectionIdx) => {
    setRestaurantData(prev => ({
      ...prev,
      menu: prev.menu.filter((_, i) => i !== sectionIdx),
    }));
  };

  const updateMenuSection = (sectionIdx, patch) => {
    setRestaurantData(prev => ({
      ...prev,
      menu: prev.menu.map((s, i) => i === sectionIdx ? { ...s, ...patch } : s),
    }));
  };

  const addMenuItem = (sectionIdx) => {
    setRestaurantData(prev => ({
      ...prev,
      menu: prev.menu.map((s, i) =>
        i === sectionIdx
          ? { ...s, items: [...s.items, { name: '', description: '', price: '', photos: [] }] }
          : s
      ),
    }));
  };

  const removeMenuItem = (sectionIdx, itemIdx) => {
    setRestaurantData(prev => ({
      ...prev,
      menu: prev.menu.map((s, i) =>
        i === sectionIdx
          ? { ...s, items: s.items.filter((_, j) => j !== itemIdx) }
          : s
      ),
    }));
  };

  const updateMenuItem = (sectionIdx, itemIdx, patch) => {
    setRestaurantData(prev => ({
      ...prev,
      menu: prev.menu.map((s, i) =>
        i === sectionIdx
          ? { ...s, items: s.items.map((it, j) => j === itemIdx ? { ...it, ...patch } : it) }
          : s
      ),
    }));
  };

  const toggleOpenDay = (idx) => {
    setRestaurantData(prev => {
      const next = { ...prev.open_hours };
      if (idx in next) {
        delete next[idx];
      } else {
        next[idx] = { from: '10:00', until: '23:00' };
      }
      return { ...prev, open_hours: next };
    });
  };

  const setDayHour = (idx, field, value) => {
    setRestaurantData(prev => ({
      ...prev,
      open_hours: {
        ...prev.open_hours,
        [idx]: { ...prev.open_hours[idx], [field]: value },
      },
    }));
  };

  // Serialize the per-day OVERRIDE map into a readable string stored in
  // restaurants.opening_hours. Empty map → empty string (the booking flow
  // uses Reservation Hours for every day, so there's nothing to spell out).
  // Contiguous days with identical overrides collapse: "Mon-Fri 10:00-18:00".
  const serializeOpeningHours = () => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const entries = Object.entries(restaurantData.open_hours)
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
        ? labels[g.firstDay]
        : `${labels[g.firstDay]}-${labels[g.lastDay]}`;
      return `${dayStr} ${g.from}-${g.until}`;
    }).join(', ');
  };

  // Letters + spaces only (so users can type a first and last name).
  const NAME_OK = /^[A-Za-z\s]*$/;
  // Digits only.
  const PHONE_OK = /^\d*$/;

  const fieldKey = (group, index, field) => `${group}-${index}-${field}`;

  const setFieldError = (group, index, field, message) => {
    setFieldErrors(prev => ({ ...prev, [fieldKey(group, index, field)]: message }));
  };
  const clearFieldError = (group, index, field) => {
    setFieldErrors(prev => {
      if (!(fieldKey(group, index, field) in prev)) return prev;
      const next = { ...prev };
      delete next[fieldKey(group, index, field)];
      return next;
    });
  };

  const updateAccount = (group, index, field, rawValue) => {
    let value = rawValue;
    if (field === 'name') {
      if (!NAME_OK.test(value)) {
        setFieldError(group, index, 'name', 'Wrong format — letters only');
        value = value.replace(/[^A-Za-z\s]/g, '');
      } else {
        clearFieldError(group, index, 'name');
      }
    } else if (field === 'phone') {
      if (!PHONE_OK.test(value)) {
        setFieldError(group, index, 'phone', 'Wrong format — digits only');
        value = value.replace(/\D/g, '');
      } else {
        clearFieldError(group, index, 'phone');
      }
    } else {
      clearFieldError(group, index, field);
    }

    if (group === 'owners') {
      setOwners(prev => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
    } else {
      setHostesses(prev => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
    }
  };

  const addOwner = () => setOwners(prev => [...prev, emptyAccount()]);
  const addHostess = () => setHostesses(prev => [...prev, emptyAccount()]);
  const removeOwner = (index) => {
    setOwners(prev => prev.filter((_, i) => i !== index));
    // Drop any stale field errors that pointed at the removed row.
    setFieldErrors(prev => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith(`owners-${index}-`)) next[k] = v;
      }
      return next;
    });
  };
  const removeHostess = (index) => {
    setHostesses(prev => prev.filter((_, i) => i !== index));
    setFieldErrors(prev => {
      const next = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith(`hostesses-${index}-`)) next[k] = v;
      }
      return next;
    });
  };

  const validateAccount = (account, label) => {
    if (!account.name.trim()) return `${label}: name is required`;
    if (!NAME_OK.test(account.name)) return `${label}: name must contain letters only`;
    if (!account.email.trim()) return `${label}: email is required`;
    if (!account.password || account.password.length < 6) return `${label}: password must be at least 6 characters`;
    if (account.phone && !PHONE_OK.test(account.phone)) return `${label}: phone must contain digits only`;
    return null;
  };

  const validateStep1 = () => {
    // Check for duplicate emails across all accounts on the page.
    const emails = [...owners, ...hostesses].map(a => a.email.trim().toLowerCase()).filter(Boolean);
    const dup = emails.find((e, i) => emails.indexOf(e) !== i);
    if (dup) return `Duplicate email: ${dup}`;

    for (let i = 0; i < owners.length; i++) {
      const err = validateAccount(owners[i], i === 0 ? 'Primary owner' : `Owner #${i + 1}`);
      if (err) return err;
    }
    for (let i = 0; i < hostesses.length; i++) {
      const err = validateAccount(hostesses[i], `Hostess #${i + 1}`);
      if (err) return err;
    }
    return null;
  };

  const validateStep2 = () => {
    if (!restaurantData.restaurant_name.trim()) return 'Restaurant name is required';
    if (!restaurantData.address.trim()) return 'Address is required';
    if (!restaurantData.restaurant_phone.trim()) return 'Restaurant phone is required';
    if (!/^\d+$/.test(restaurantData.restaurant_phone.trim())) return 'Restaurant phone must contain digits only';
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

    // Re-run step-1 validation in case the user jumped backward and edited an account.
    const stepError = validateStep1();
    if (stepError) {
      setError(stepError);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...restaurantData,
        opening_hours: serializeOpeningHours(),
        open_hours_json: JSON.stringify(restaurantData.open_hours),
        closed_days: JSON.stringify(restaurantData.closed_days),
        special_closures: JSON.stringify(restaurantData.special_closures),
        cover_images: JSON.stringify(restaurantData.cover_images),
        gallery_images: JSON.stringify(restaurantData.gallery_images),
        tables: JSON.stringify(restaurantData.tables),
        menu_json: JSON.stringify(
          restaurantData.menu
            // Drop empty sections / items so the public page doesn't show blanks.
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
            .filter(s => s.name && s.items.length > 0)
        ),
      };
      // open_hours / menu are the client-side helpers; backend uses *_json.
      delete payload.open_hours;
      delete payload.menu;
      const primaryOwner = owners[0];
      const ownerData = {
        name: primaryOwner.name,
        email: primaryOwner.email,
        password: primaryOwner.password,
        phone: primaryOwner.phone,
        additional_owners: owners.slice(1).map(o => ({
          name: o.name, email: o.email, password: o.password, phone: o.phone,
        })),
        hostesses: hostesses.map(h => ({
          name: h.name, email: h.email, password: h.password, phone: h.phone,
        })),
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
            {['Account', 'Restaurant', 'Capacity', 'Schedule', 'Menu'].map((label, i) => (
              <div key={i} className={`register-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
                <div className="register-step-circle">{step > i + 1 ? '✓' : i + 1}</div>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Owner + staff accounts */}
            {step === 1 && (
              <div className="register-step-content">
                <h2>Owner's Account</h2>
                {owners.map((acc, i) => (
                  <AccountBlock
                    key={`owner-${i}`}
                    group="owners"
                    index={i}
                    label={i === 0 ? 'Primary Owner' : `Owner #${i + 1}`}
                    account={acc}
                    fieldErrors={fieldErrors}
                    onChange={updateAccount}
                    onRemove={i === 0 ? null : () => removeOwner(i)}
                  />
                ))}
                <button type="button" className="add-account-btn" onClick={addOwner}>
                  + Add Owner Account
                </button>

                {hostesses.length > 0 && <h3 className="account-section-title">Hostess Accounts</h3>}
                {hostesses.map((acc, i) => (
                  <AccountBlock
                    key={`hostess-${i}`}
                    group="hostesses"
                    index={i}
                    label={`Hostess #${i + 1}`}
                    account={acc}
                    fieldErrors={fieldErrors}
                    onChange={updateAccount}
                    onRemove={() => removeHostess(i)}
                  />
                ))}
                <button type="button" className="add-account-btn" onClick={addHostess}>
                  + Add Hostess Account
                </button>

                <button type="button" className="submit-btn" onClick={handleNext}>Next →</button>
              </div>
            )}

            {/* Step 2: Restaurant */}
            {step === 2 && (
              <div className="register-step-content">
                <h2>Restaurant</h2>
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
                  <label>Restaurant Phone</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    name="restaurant_phone"
                    value={restaurantData.restaurant_phone}
                    onChange={(e) => handleRestaurantPhone(e.target.value)}
                    placeholder="35920000000"
                  />
                  {restaurantFieldErrors.restaurant_phone && (
                    <div className="field-error-popup">{restaurantFieldErrors.restaurant_phone}</div>
                  )}
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
                  <h3 className="schedule-section-title">Opening Hours</h3>
                  <p className="schedule-hint">Reservation Hours apply to every day by default. Select a day here only if its hours differ — that day's slots will use these times instead.</p>
                  <div className="closed-days-grid open-days-grid">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => (
                      <button
                        key={day}
                        type="button"
                        className={`closed-day-btn ${i in restaurantData.open_hours ? 'closed' : ''}`}
                        onClick={() => toggleOpenDay(i)}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                  {Object.keys(restaurantData.open_hours).length > 0 && (
                    <div className="open-hours-rows">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => {
                        if (!(i in restaurantData.open_hours)) return null;
                        const h = restaurantData.open_hours[i];
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

                <div className="schedule-section">
                  <h3 className="schedule-section-title">Buffer Time</h3>
                  <p className="schedule-hint">
                    The current buffer time for guests to arrive is {restaurantData.no_show_buffer_minutes || 15} minutes. After the time past the reservation will be automatically marked as a no-show. Leave empty to keep the default of 15.
                  </p>
                  <div className="form-group">
                    <label>Minutes <span className="label-optional">*optional</span></label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={restaurantData.no_show_buffer_minutes}
                      onChange={(e) => handleBufferMinutes(e.target.value)}
                      placeholder="15"
                    />
                    {restaurantFieldErrors.no_show_buffer_minutes && (
                      <div className="field-error-popup">{restaurantFieldErrors.no_show_buffer_minutes}</div>
                    )}
                  </div>
                </div>

                <div className="register-step-actions">
                  <button type="button" className="back-step-btn" onClick={handleBack}>← Back</button>
                  <button type="button" className="submit-btn" onClick={handleNext}>Next →</button>
                </div>
              </div>
            )}

            {/* Step 5: Menu */}
            {step === 5 && (
              <div className="register-step-content">
                <h2>Menu <span className="label-optional">*optional</span></h2>
                <p className="schedule-hint">
                  Add sections (e.g. Appetizers, Mains) and items inside each. Leave this empty to skip — you can always add a menu later from the dashboard settings.
                </p>

                <div className="form-group">
                  <label>Currency</label>
                  <Dropdown
                    value={restaurantData.currency}
                    options={[
                      { value: 'EUR', label: 'EUR - €' },
                      { value: 'USD', label: 'USD - $' },
                      { value: 'GBP', label: 'GBP - £' },
                    ]}
                    onChange={(v) => setRestaurantData(prev => ({ ...prev, currency: v }))}
                    ariaLabel="Menu currency"
                  />
                </div>

                {restaurantData.menu.map((section, si) => (
                  <div key={si} className="menu-section-block">
                    <div className="menu-section-head">
                      <input
                        type="text"
                        className="menu-section-input"
                        placeholder={`Section name (e.g. Appetizers)`}
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

function AccountBlock({ group, index, label, account, fieldErrors, onChange, onRemove }) {
  const errKey = (field) => fieldErrors[`${group}-${index}-${field}`];
  return (
    <div className="account-block">
      <div className="account-block-header">
        <h4 className="account-block-title">{label}</h4>
        {onRemove && (
          <button type="button" className="account-block-remove" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <div className="form-group">
        <label>Full Name</label>
        <input
          type="text"
          value={account.name}
          onChange={(e) => onChange(group, index, 'name', e.target.value)}
          placeholder="John Smith"
        />
        {errKey('name') && <div className="field-error-popup">{errKey('name')}</div>}
      </div>
      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          value={account.email}
          onChange={(e) => onChange(group, index, 'email', e.target.value)}
          placeholder="staff@restaurant.com"
        />
      </div>
      <div className="form-group">
        <label>Password</label>
        <input
          type="password"
          value={account.password}
          onChange={(e) => onChange(group, index, 'password', e.target.value)}
          placeholder="Min 6 characters"
        />
      </div>
      <div className="form-group">
        <label>Phone <span className="label-optional">*optional</span></label>
        <input
          type="tel"
          inputMode="numeric"
          value={account.phone}
          onChange={(e) => onChange(group, index, 'phone', e.target.value)}
          placeholder="359888000000"
        />
        {errKey('phone') && <div className="field-error-popup">{errKey('phone')}</div>}
      </div>
    </div>
  );
}

export default RestaurantRegisterPage;
