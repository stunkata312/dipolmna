/**
 * Visual floor plan for picking a table.
 * - tables: Array<{id, seats}> — the restaurant's actual table config
 * - takenMap: Map(tableId -> { time, name, num_people })
 * - currentTable: the table currently selected on this reservation (excluded from "taken")
 */
function TableGrid({ tables = [], selected, onSelect, takenMap, partySize, currentTable }) {
  if (!tables || tables.length === 0) {
    return <div className="table-grid table-grid-empty">No tables configured yet.</div>;
  }

  return (
    <div className="table-grid">
      <div className="table-grid-legend">
        <span><i className="legend-dot legend-free" /> Free</span>
        <span><i className="legend-dot legend-taken" /> Taken</span>
        <span><i className="legend-dot legend-small" /> Too small</span>
      </div>
      <div className="table-grid-cells">
        {tables.map(t => {
          const taken = takenMap.get(t.id);
          const isSelf = currentTable === t.id;
          const isTaken = !!taken && !isSelf;
          const tooSmall = t.seats && partySize && t.seats < partySize;
          const isSelected = selected === t.id;

          let title = `Table ${t.id} · ${t.seats} seats`;
          if (isTaken) title += ` · taken by ${taken.name} at ${taken.time} (${taken.num_people}p)`;
          else if (tooSmall) title += ` · seats only ${t.seats}, party is ${partySize}`;

          return (
            <button
              key={t.id}
              type="button"
              className={`table-cell${isSelected ? ' table-cell-selected' : ''}${isTaken ? ' table-cell-taken' : ''}${tooSmall && !isTaken ? ' table-cell-small' : ''}`}
              onClick={() => !isTaken && onSelect(t.id)}
              disabled={isTaken}
              title={title}
              aria-pressed={isSelected}
            >
              <span className="table-cell-num">{t.id}</span>
              <span className="table-cell-seats">{t.seats}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TableGrid;
