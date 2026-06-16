export function downloadCSV(rows, columns, filename) {
  const header = columns.map(c => `"${c.label}"`).join(",");
  const body = rows.map(row =>
    columns.map(c => {
      const val = c.value ? c.value(row) : (row[c.key] ?? "");
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\n");
  const blob = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

export function printPDF(title, subtitle, columns, rows) {
  const thead = columns.map(c => `<th>${c.label}</th>`).join("");
  const tbody = rows.map(row =>
    `<tr>${columns.map(c => {
      const val = c.value ? c.value(row) : (row[c.key] ?? "");
      return `<td>${String(val)}</td>`;
    }).join("")}</tr>`
  ).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#0f172a}
    h2{font-size:16px;margin:0 0 4px}p{font-size:11px;color:#64748b;margin:0 0 14px}
    table{width:100%;border-collapse:collapse}
    th{background:#f1f5f9;text-align:left;padding:7px 10px;font-size:11px;border-bottom:2px solid #e2e8f0}
    td{padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px}
    tr:nth-child(even) td{background:#fafafa}
    @media print{body{margin:0}button{display:none}}
  </style></head><body>
  <h2>${title}</h2><p>${subtitle}</p>
  <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
