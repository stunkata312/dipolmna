import { useState, useMemo } from 'react';
import Dropdown from './Dropdown';

const SEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 10, 12];
const SEAT_OPTIONS_LABELED = SEAT_OPTIONS.map(s => ({ value: s, label: `${s} seats` }));
const SEAT_OPTIONS_COMPACT = SEAT_OPTIONS.map(s => ({ value: s, label: String(s) }));

/**
 * Per-table seat configuration. Owner bulk-adds tables with a chosen seat count,
 * each entry can be removed individually. num_tables and max_guests are derived.
 *
 * value:    Array<{ id: number, seats: number }>
 * onChange: (next) => void
 */
function TablesEditor({ value = [], onChange }) {
  const [count, setCount] = useState(4);
  const [seats, setSeats] = useState(4);

  const totals = useMemo(() => ({
    tables: value.length,
    guests: value.reduce((s, t) => s + (t.seats || 0), 0),
  }), [value]);

  const handleAdd = () => {
    const n = parseInt(count, 10);
    const s = parseInt(seats, 10);
    if (!Number.isFinite(n) || n <= 0 || n > 50) return;
    if (!Number.isFinite(s) || s <= 0) return;
    const nextId = value.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;
    const additions = Array.from({ length: n }, (_, i) => ({ id: nextId + i, seats: s }));
    onChange([...value, ...additions]);
  };

  const handleChangeSeatsValue = (id, newSeats) => {
    onChange(value.map(t => t.id === id ? { ...t, seats: newSeats } : t));
  };

  const handleRemove = (id) => {
    onChange(value.filter(t => t.id !== id));
  };

  return (
    <div className="tables-editor">
      <div className="tables-editor-header">
        <label>Tables</label>
        <span className="tables-editor-totals">
          <strong>{totals.tables}</strong> tables · <strong>{totals.guests}</strong> max guests
        </span>
      </div>

      <div className="tables-editor-add-row">
        <div className="form-group tables-editor-field">
          <label>Number of Tables</label>
          <input
            type="number"
            min="1"
            max="50"
            value={count}
            onChange={e => setCount(e.target.value)}
          />
        </div>
        <div className="form-group tables-editor-field">
          <label>Seats per Table</label>
          <input
            type="number"
            min="1"
            max="20"
            value={seats}
            onChange={e => setSeats(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="tables-editor-add-btn"
          onClick={handleAdd}
        >
          + Add tables
        </button>
      </div>

      {value.length > 0 ? (
        <div className="tables-editor-grid">
          {value.map(t => (
            <div key={t.id} className="tables-editor-cell">
              <span className="tables-editor-num">{t.id}</span>
              <Dropdown
                value={t.seats}
                options={SEAT_OPTIONS_COMPACT}
                onChange={(v) => handleChangeSeatsValue(t.id, v)}
                ariaLabel="Seats at this table"
                compact
              />
              <button
                type="button"
                className="tables-editor-remove"
                onClick={() => handleRemove(t.id)}
                title="Remove this table"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="tables-editor-empty">No tables yet. Add some above.</p>
      )}
    </div>
  );
}

export default TablesEditor;
