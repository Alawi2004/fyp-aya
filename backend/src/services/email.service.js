import nodemailer from "nodemailer";

// Single transporter instance reused across all sends.
// Re-created lazily when env vars change (e.g. after a settings update).
let _transporter = null;
let _transporterKey = "";

function getTransporter() {
  // Cache key — if SMTP config changes (e.g. hot-reload in dev), recreate.
  const key = `${process.env.SMTP_HOST}:${process.env.SMTP_PORT}:${process.env.SMTP_USER}`;
  if (_transporter && key === _transporterKey) return _transporter;

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Accept self-signed certs in dev; in production TLS is verified by default.
    tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
  });

  _transporterKey = key;
  return _transporter;
}

// ── Scheduled report email ────────────────────────────────────────────────────

const REPORT_LABELS = {
  "driver-performance":    "Driver Performance Report",
  "vehicle-utilization":  "Vehicle Utilization Report",
  "revenue":              "Revenue Summary Report",
};

function buildReportHtml(reportType, reportName) {
  const date    = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const label   = REPORT_LABELS[reportType] || reportName;
  const sampleRows = {
    "driver-performance": [
      ["1", "Karim Moussa",   "45", "94%", "0", "4.9", "97"],
      ["2", "Maya Salameh",   "28", "96%", "0", "4.7", "95"],
      ["3", "Fadi Gemayel",   "42", "91%", "1", "4.8", "92"],
      ["4", "Lara Abi Nader", "38", "88%", "1", "4.5", "88"],
    ],
    "vehicle-utilization": [
      ["BUS-06", "Articulated", "11.0h", "1.0h",  "18", "460 km", "92%"],
      ["BUS-03", "Articulated", "10.5h", "1.5h",  "16", "410 km", "88%"],
      ["BUS-01", "Standard",    "9.5h",  "2.5h",  "14", "320 km", "79%"],
      ["BUS-08", "Standard",    "8.5h",  "3.5h",  "12", "290 km", "71%"],
    ],
    "revenue": [
      ["Route 12A", "City Center → Airport",   "42", "$3,360", "88%"],
      ["Route 7B",  "University → Downtown",   "38", "$2,660", "75%"],
      ["Route 3C",  "North Terminal → Mall",   "31", "$2,170", "94%"],
    ],
  };

  const headers = {
    "driver-performance":  ["Rank", "Driver", "Trips", "On-Time", "Complaints", "Rating", "Score"],
    "vehicle-utilization": ["Vehicle", "Type", "Active Hrs", "Idle Hrs", "Trips", "Distance", "Utilization"],
    "revenue":             ["Route", "Description", "Trips", "Revenue", "Avg Load"],
  };

  const rows = sampleRows[reportType] || [];
  const cols = headers[reportType]    || [];
  const thead = cols.map(c => `<th style="padding:8px 12px;background:#f4f6f8;border:1px solid #e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748B">${c}</th>`).join("");
  const tbody = rows.map((r, i) =>
    `<tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">${r.map(v => `<td style="padding:8px 12px;border:1px solid #e2e8f0;font-size:13px">${v}</td>`).join("")}</tr>`
  ).join("");

  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0">
      <div style="background:linear-gradient(135deg,#1E3A8A,#2563EB);padding:28px 32px">
        <div style="font-size:11px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Yalla Transit · Scheduled Report</div>
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">${label}</h1>
        <p style="color:rgba(255,255,255,.7);margin:6px 0 0;font-size:13px">Auto-generated on ${date}</p>
      </div>
      <div style="padding:24px 32px">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
        <p style="font-size:12px;color:#94A3B8;margin:0">This is an automated report from the Yalla Transit Admin system. To change your report schedule, log in to the admin portal.</p>
      </div>
    </div>`;
}

export async function sendScheduledReport(recipients, reportType, reportName) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from:    `"${process.env.SMTP_FROM_NAME || "Yalla Transit"}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
    to:      recipients.join(", "),
    subject: `📊 Scheduled Report: ${reportName} — ${new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}`,
    html:    buildReportHtml(reportType, reportName),
  });
}

export async function sendPasswordResetEmail(toEmail, resetUrl) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || "Yalla Transit Admin"}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Password Reset Request",
    text: `You requested a password reset. Click the link below within 1 hour:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;background:#F8FAFC;border-radius:12px">
        <h2 style="color:#1E293B;margin-bottom:8px">Password Reset</h2>
        <p style="color:#475569;margin-bottom:24px">You requested a password reset for your admin account. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
        <p style="color:#94A3B8;font-size:13px;margin-top:24px">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
