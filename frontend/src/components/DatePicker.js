import { useState, useEffect, useRef } from 'react';
import Calendar from './Calendar';

/**
 * Themed date picker — same look as Dropdown/TimeInput.
 * Trigger button shows the formatted date; on click, a popup shows the Calendar below.
 *
 * Props:
 *   value           — YYYY-MM-DD string (or empty)
 *   onChange        — (dateStr) => void
 *   closedDays      — Mon-based array of weekday indices to disable
 *   specialClosures — array of { date, reason }
 *   minDate         — YYYY-MM-DD; defaults to today
 *   placeholder     — text shown when value is empty
 */
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function DatePicker({ value, onChange, closedDays, specialClosures, minDate, placeholder = 'Select date', disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handlePick = (newDate) => {
    onChange(newDate);
    setOpen(false);
  };

  return (
    <div className="themed-dropdown date-picker" ref={ref}>
      <button
        type="button"
        className={`themed-select themed-dropdown-btn date-picker-btn${open ? ' is-open' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="themed-dropdown-value">
          {value ? formatDate(value) : <span className="date-picker-placeholder">{placeholder}</span>}
        </span>
      </button>
      {open && (
        <div className="date-picker-popup">
          <Calendar
            value={value}
            onChange={handlePick}
            closedDays={closedDays}
            specialClosures={specialClosures}
            minDate={minDate}
          />
        </div>
      )}
    </div>
  );
}

export default DatePicker;
