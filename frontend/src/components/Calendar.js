import { useState, useEffect } from 'react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad(n) { return String(n).padStart(2, '0'); }
function toISO(year, month0, day) { return `${year}-${pad(month0 + 1)}-${pad(day)}`; }

/**
 * Standalone month-grid calendar.
 *
 * Props:
 *   value           — selected date string YYYY-MM-DD (or empty)
 *   onChange        — (dateStr) => void
 *   closedDays      — array of weekday indices (Mon-based, 0..6)
 *   specialClosures — array of { date: 'YYYY-MM-DD', reason }
 *   minDate         — YYYY-MM-DD; dates before this are disabled (defaults to today)
 */
function Calendar({ value, onChange, closedDays = [], specialClosures = [], minDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const minDateObj = minDate ? new Date(minDate + 'T00:00:00') : today;

  // Open on the value's month if present, else current month
  const initial = value ? new Date(value + 'T00:00:00') : today;
  const [calMonth, setCalMonth] = useState(initial.getMonth());
  const [calYear, setCalYear] = useState(initial.getFullYear());

  // Re-sync when value changes externally
  useEffect(() => {
    if (!value) return;
    const d = new Date(value + 'T00:00:00');
    setCalMonth(d.getMonth());
    setCalYear(d.getFullYear());
  }, [value]);

  const closureSet = new Set(specialClosures.map(c => c.date));

  const getDaysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m, y) => {
    const day = new Date(y, m, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday = 0
  };

  const canGoPrev =
    calYear > minDateObj.getFullYear()
    || (calYear === minDateObj.getFullYear() && calMonth > minDateObj.getMonth());

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  };

  const isToday = (day) =>
    calYear === today.getFullYear() && calMonth === today.getMonth() && day === today.getDate();

  const isPast = (day) => new Date(calYear, calMonth, day) < minDateObj;

  const isClosed = (day) => {
    const date = new Date(calYear, calMonth, day);
    const jsDay = date.getDay();
    const mondayBased = jsDay === 0 ? 6 : jsDay - 1;
    if (closedDays.includes(mondayBased)) return true;
    if (closureSet.has(toISO(calYear, calMonth, day))) return true;
    return false;
  };

  const isSelected = (day) => value === toISO(calYear, calMonth, day);

  const selectDate = (day) => {
    if (isPast(day) || isClosed(day)) return;
    onChange(toISO(calYear, calMonth, day));
  };

  const daysInMonth = getDaysInMonth(calMonth, calYear);
  const firstDay = getFirstDayOfMonth(calMonth, calYear);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
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
        {cells.map((day, i) => (
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
  );
}

export default Calendar;
