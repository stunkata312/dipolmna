import Dropdown from './Dropdown';

/**
 * 24-hour time picker (two custom dropdowns).
 * Always drops downward, regardless of viewport position.
 * value/onChange use 'HH:MM' strings.
 */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function TimeInput({ value, onChange, disabled }) {
  const [hRaw, mRaw] = (value || '00:00').split(':');
  const h = (hRaw || '00').padStart(2, '0');
  const m = (mRaw || '00').padStart(2, '0');

  // Tolerate non-5-min legacy values by injecting the current minute into the option list
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();

  return (
    <div className="time-input">
      <Dropdown
        value={h}
        options={HOURS}
        onChange={(newH) => onChange(`${newH}:${m}`)}
        ariaLabel="Hours"
        disabled={disabled}
      />
      <span className="time-input-sep">:</span>
      <Dropdown
        value={m}
        options={minutes}
        onChange={(newM) => onChange(`${h}:${newM}`)}
        ariaLabel="Minutes"
        disabled={disabled}
      />
    </div>
  );
}

export default TimeInput;
