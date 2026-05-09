import { useState } from 'react';

/**
 * Manages a list of image URLs. Add via input, remove via × button.
 * Drag-style reorder kept out for simplicity — first image is treated as primary.
 */
function ImageListInput({ label, hint, value = [], onChange, primaryHint }) {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState(null);

  const handleAdd = () => {
    // Split on whitespace, commas, or semicolons so the user can paste many at once
    const candidates = draft.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    if (candidates.length === 0) return;

    const existing = new Set(value);
    const toAdd = [];
    const skippedInvalid = [];
    let skippedDuplicate = 0;

    for (const url of candidates) {
      if (!/^https?:\/\//i.test(url)) {
        skippedInvalid.push(url);
        continue;
      }
      if (existing.has(url)) { skippedDuplicate++; continue; }
      existing.add(url);
      toAdd.push(url);
    }

    if (toAdd.length > 0) {
      onChange([...value, ...toAdd]);
      setDraft('');
    }

    const messages = [];
    if (skippedInvalid.length > 0) {
      messages.push(`${skippedInvalid.length} skipped (must start with http:// or https://)`);
    }
    if (skippedDuplicate > 0) {
      messages.push(`${skippedDuplicate} duplicate${skippedDuplicate > 1 ? 's' : ''} skipped`);
    }
    setErr(messages.length > 0 ? messages.join(' · ') : null);
  };

  const handleRemove = (idx) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  const handleMakePrimary = (idx) => {
    if (idx === 0) return;
    const next = [...value];
    const [picked] = next.splice(idx, 1);
    next.unshift(picked);
    onChange(next);
  };

  return (
    <div className="image-list-input">
      <div className="image-list-header">
        <label>{label}</label>
        {hint && <span className="image-list-hint">{hint}</span>}
      </div>

      <div className="image-list-add-row">
        <input
          type="text"
          placeholder="https://...  (paste multiple separated by spaces, commas, or new lines)"
          value={draft}
          onChange={e => { setDraft(e.target.value); if (err) setErr(null); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
        />
        <button type="button" className="image-list-add-btn" onClick={handleAdd} disabled={!draft.trim()}>
          + Add
        </button>
      </div>
      {err && <div className="field-error">{err}</div>}

      {value.length > 0 && (
        <div className="image-list-grid">
          {value.map((url, i) => (
            <div key={i} className={`image-list-thumb${i === 0 && primaryHint ? ' is-primary' : ''}`}>
              <img src={url} alt="" loading="lazy" onError={(e) => { e.currentTarget.classList.add('image-broken'); }} />
              {i === 0 && primaryHint && <span className="image-list-primary-tag">{primaryHint}</span>}
              <div className="image-list-thumb-actions">
                {i > 0 && (
                  <button
                    type="button"
                    className="image-list-make-primary"
                    title="Make primary (first)"
                    onClick={() => handleMakePrimary(i)}
                  >
                    ↑
                  </button>
                )}
                <button
                  type="button"
                  className="image-list-remove"
                  title="Remove"
                  onClick={() => handleRemove(i)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ImageListInput;
