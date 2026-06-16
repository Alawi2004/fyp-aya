export function DataTable({ columns, rows, onRowClick }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key + col.label}
              style={{
                padding: "10px 14px",
                textAlign: "left",
                fontSize: 10,
                fontWeight: 700,
                color: "#64748B",
                textTransform: "uppercase",
                letterSpacing: ".07em",
                borderBottom: "2px solid #E2E8F0",
                borderTop: "1px solid #E2E8F0",
                background: "#F1F5F9",
                whiteSpace: "nowrap",
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.id ?? i}
            className="table-row"
            onClick={() => onRowClick?.(row)}
            style={{
              borderBottom: "1px solid #E8EDF5",
              cursor: onRowClick ? "pointer" : "default",
              background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
              transition: "background .12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; }}
            onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? "#FFFFFF" : "#F8FAFC"; }}
          >
            {columns.map((col) => (
              <td key={col.key + col.label} style={{ padding: "11px 14px", color: "#1E293B", verticalAlign: "middle" }}>
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
