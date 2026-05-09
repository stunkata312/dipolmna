import { useState, useEffect, useRef } from 'react';

/**
 * Reusable themed dropdown — always opens downward, scrollable.
 *
 * Props:
 *   value     — current selected value (compared via ===)
 *   options   — array of either primitives (used as both value + label) or { value, label } objects
 *   onChange  — (newValue) => void
 *   ariaLabel — accessible label
 *   disabled  — disables interaction
 *   width     — optional CSS width override (e.g. '160px')
 *   align     — 'left' (default) or 'right' — which edge of the button the list aligns to
 *   compact   — true for a smaller variant (used inside tight containers)
 */
function normalize(opt) {
  if (opt && typeof opt === 'object' && 'value' in opt) return opt;
  return { value: opt, label: String(opt) };
}

function Dropdown({
  value,
  options = [],
  onChange,
  ariaLabel,
  disabled,
  width,
  align = 'left',
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);

  const normalized = options.map(normalize);
  const current = normalized.find(o => o.value === value);
  const displayLabel = current ? current.label : (value !== undefined && value !== null ? String(value) : '');

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

  // Scroll the active option into view when opening
  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector('.is-active');
    if (active) active.scrollIntoView({ block: 'center' });
  }, [open]);

  return (
    <div
      className={`themed-dropdown${compact ? ' themed-dropdown-compact' : ''}`}
      ref={ref}
      style={width ? { width } : undefined}
    >
      <button
        type="button"
        className={`themed-select themed-dropdown-btn${open ? ' is-open' : ''}`}
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="themed-dropdown-value">{displayLabel}</span>
      </button>
      {open && (
        <ul
          className="themed-dropdown-list"
          role="listbox"
          ref={listRef}
          style={align === 'right' ? { left: 'auto', right: 0 } : undefined}
        >
          {normalized.map(opt => (
            <li
              key={String(opt.value)}
              className={`themed-dropdown-option${opt.value === value ? ' is-active' : ''}`}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Dropdown;
