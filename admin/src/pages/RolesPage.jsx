import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Shield, Plus, Edit2, Trash2, Check, X,
  History, UserPlus, Search, ChevronDown,
} from "lucide-react";
import { getRoles, createRole, deleteRole, updateRolePermissions } from "../api/endpoints";

/* ─────────────────────────── constants ──────────────────────────── */

const MODULES = [
  "Dashboard", "Live Tracking", "Passenger Counter",
  "Users", "Drivers", "Vehicles", "Routes & Stops",
  "Trips", "Analytics", "Tickets", "Notifications", "Ratings", "Wallet",
];

const PERMS       = ["view", "create", "edit", "delete"];
const PERM_LABEL  = { view: "View", create: "Create", edit: "Edit", delete: "Delete" };
const ROLE_COLORS = ["#7C3AED","#2563EB","#059669","#D97706","#DC2626","#0891B2","#DB2777","#9333EA"];

const DEFAULT_ROLES = [
  {
    id: 1, system: true, name: "Super Admin", color: "#7C3AED",
    description: "Full unrestricted access to all modules",
    permissions: Object.fromEntries(MODULES.map(m => [m, { view:true,  create:true,  edit:true,  delete:true  }])),
  },
  {
    id: 2, system: true, name: "Transport Manager", color: "#2563EB",
    description: "Manages fleet operations and trips",
    permissions: Object.fromEntries(MODULES.map(m => [m, {
      view:   true,
      create: ["Drivers","Vehicles","Routes & Stops","Trips"].includes(m),
      edit:   ["Drivers","Vehicles","Routes & Stops","Trips","Live Tracking"].includes(m),
      delete: ["Trips"].includes(m),
    }])),
  },
  {
    id: 3, system: true, name: "Finance Officer", color: "#059669",
    description: "Manages wallet, tickets and financial reports",
    permissions: Object.fromEntries(MODULES.map(m => [m, {
      view:   ["Dashboard","Analytics","Tickets","Wallet","Ratings"].includes(m),
      create: ["Tickets","Wallet"].includes(m),
      edit:   ["Tickets","Wallet"].includes(m),
      delete: false,
    }])),
  },
  {
    id: 4, system: true, name: "Ops Staff", color: "#D97706",
    description: "Day-to-day operations monitoring",
    permissions: Object.fromEntries(MODULES.map(m => [m, {
      view:   ["Dashboard","Live Tracking","Trips","Notifications","Passenger Counter"].includes(m),
      create: ["Notifications"].includes(m),
      edit:   false,
      delete: false,
    }])),
  },
  {
    id: 5, system: true, name: "Auditor", color: "#DC2626",
    description: "Read-only access to all modules for compliance",
    permissions: Object.fromEntries(MODULES.map(m => [m, { view:true, create:false, edit:false, delete:false }])),
  },
  {
    id: 6, system: true, name: "IT Admin", color: "#0891B2",
    description: "Technical configuration and system access",
    permissions: Object.fromEntries(MODULES.map(m => [m, {
      view:   true,
      create: ["Users"].includes(m),
      edit:   ["Users","Vehicles"].includes(m),
      delete: ["Users"].includes(m),
    }])),
  },
];

/* seed role-assignment history — newest first */
const SEED_HISTORY = [
  { id:1,  user:"Ahmad Faris",    userId:"U-021", action:"assigned", role:"Transport Manager", prevRole:null,               grantedBy:"Admin User", ts:"2026-04-28T09:14:00", note:"Promoted to fleet ops lead" },
  { id:2,  user:"Siti Noor",      userId:"U-035", action:"changed",  role:"Finance Officer",   prevRole:"Ops Staff",         grantedBy:"Admin User", ts:"2026-04-29T11:32:00", note:"Transferred to finance team" },
  { id:3,  user:"Raj Kumar",      userId:"U-008", action:"assigned", role:"Auditor",            prevRole:null,               grantedBy:"Admin User", ts:"2026-04-29T14:05:00", note:"External audit engagement" },
  { id:4,  user:"Nurul Ain",      userId:"U-047", action:"assigned", role:"Ops Staff",          prevRole:null,               grantedBy:"Admin User", ts:"2026-04-30T08:20:00", note:"New hire onboarded" },
  { id:5,  user:"Daniel Wong",    userId:"U-012", action:"changed",  role:"Super Admin",        prevRole:"IT Admin",         grantedBy:"Admin User", ts:"2026-04-30T10:45:00", note:"Elevated for system migration" },
  { id:6,  user:"Farah Izzati",   userId:"U-059", action:"assigned", role:"IT Admin",           prevRole:null,               grantedBy:"Admin User", ts:"2026-05-01T09:00:00", note:"IT team expansion" },
  { id:7,  user:"Hassan Ali",     userId:"U-033", action:"revoked",  role:"Ops Staff",          prevRole:"Ops Staff",        grantedBy:"Admin User", ts:"2026-05-01T15:30:00", note:"Staff offboarding" },
  { id:8,  user:"Priya Menon",    userId:"U-074", action:"changed",  role:"Finance Officer",    prevRole:"Auditor",          grantedBy:"Admin User", ts:"2026-05-02T10:10:00", note:"Role correction after review" },
  { id:9,  user:"Lim Siew Ting",  userId:"U-091", action:"assigned", role:"Transport Manager",  prevRole:null,               grantedBy:"Admin User", ts:"2026-05-02T13:55:00", note:"Fleet team restructure" },
  { id:10, user:"Azlan Bin Yusof",userId:"U-017", action:"changed",  role:"Auditor",            prevRole:"Finance Officer",  grantedBy:"Admin User", ts:"2026-05-03T09:40:00", note:"Compliance audit rotation" },
];

// UI module name → DB module_name (null = no corresponding DB permission)
const MODULE_TO_DB = {
  "Dashboard":         "dashboard",
  "Live Tracking":     "live",
  "Passenger Counter": null,
  "Users":             "users",
  "Drivers":           "drivers",
  "Vehicles":          "vehicles",
  "Routes & Stops":    "routes",
  "Trips":             "trips",
  "Analytics":         "analytics",
  "Tickets":           "tickets",
  "Notifications":     "notifications",
  "Ratings":           "ratings",
  "Wallet":            "wallet",
};

const SYSTEM_ROLE_COLORS = {
  admin:             "#7C3AED",
  super_admin:       "#7C3AED",
  transport_manager: "#2563EB",
  finance_officer:   "#059669",
  ops_staff:         "#D97706",
  auditor:           "#DC2626",
  it_admin:          "#0891B2",
  staff:             "#DB2777",
};

function dbPermToUi(permKeys = []) {
  const ui = emptyPermissions();
  for (const [uiMod, dbMod] of Object.entries(MODULE_TO_DB)) {
    if (!dbMod) continue;
    for (const perm of PERMS) {
      ui[uiMod][perm] = permKeys.includes(`${dbMod}.${perm}`);
    }
  }
  return ui;
}

function uiPermToDb(uiPerms) {
  const keys = [];
  for (const [uiMod, dbMod] of Object.entries(MODULE_TO_DB)) {
    if (!dbMod) continue;
    for (const perm of PERMS) {
      if (uiPerms[uiMod]?.[perm]) keys.push(`${dbMod}.${perm}`);
    }
  }
  return keys;
}

function mapApiRole(r, idx) {
  const color = SYSTEM_ROLE_COLORS[r.role_key] ?? ROLE_COLORS[idx % ROLE_COLORS.length];
  return {
    id:          r.role_id,
    role_key:    r.role_key,
    system:      !!r.is_system,
    name:        r.display_name,
    color,
    description: r.description ?? "",
    permissions: dbPermToUi(r.permissions ?? []),
  };
}

function emptyPermissions() {
  return Object.fromEntries(MODULES.map(m => [m, { view:false, create:false, edit:false, delete:false }]));
}

function fmt(ts) {
  const d = new Date(ts);
  return d.toLocaleString("en-MY", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

/* ─────────────────────────── shared styles ──────────────────────── */

const S = {
  page:    { animation:"fadeInUp .4s ease both" },
  header:  { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 },
  h1:      { fontSize:22, fontWeight:800, color:"#0F172A", letterSpacing:"-.5px" },
  sub:     { fontSize:13, color:"#64748B", marginTop:3 },
  btn: (bg="#2563EB", fg="#fff") => ({
    display:"flex", alignItems:"center", gap:6, padding:"9px 16px",
    background:bg, color:fg, border:"none", borderRadius:9, fontSize:13,
    fontWeight:600, cursor:"pointer", transition:"all .15s",
  }),
  card: {
    background:"#fff", border:"1px solid #E2E8F0", borderRadius:14,
    padding:"20px 22px", boxShadow:"0 1px 4px rgba(0,0,0,.04)",
  },
  input: {
    width:"100%", padding:"9px 12px", border:"1px solid #E2E8F0",
    borderRadius:8, fontSize:13, color:"#0F172A", background:"#F8FAFC", outline:"none",
  },
  label: { fontSize:12, fontWeight:600, color:"#374151", marginBottom:5, display:"block" },
  overlay: {
    position:"fixed", inset:0, background:"rgba(15,23,42,.45)",
    backdropFilter:"blur(4px)", zIndex:1000,
    display:"flex", alignItems:"center", justifyContent:"center",
  },
  modal: {
    background:"#fff", borderRadius:18, boxShadow:"0 20px 60px rgba(0,0,0,.18)",
    width:"min(92vw, 860px)", maxHeight:"90vh", overflowY:"auto", padding:32,
  },
  sectionLabel: {
    fontSize:11, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase",
    color:"#94A3B8", marginBottom:12, marginTop:4,
  },
};

/* ─────────────────────────── small atoms ────────────────────────── */

function ColorDot({ color, size=10 }) {
  return <span style={{ width:size, height:size, borderRadius:"50%", background:color, display:"inline-block", flexShrink:0 }} />;
}

function Check2({ on, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:26, height:26, borderRadius:6, border:"1.5px solid",
      borderColor: on ? "transparent" : "#D1D5DB",
      background:  on ? "#2563EB" : "#F8FAFC",
      display:"flex", alignItems:"center", justifyContent:"center",
      cursor:"pointer", transition:"all .12s", margin:"0 auto",
    }}>
      {on && <Check size={13} color="#fff" strokeWidth={3} />}
    </button>
  );
}

const ACTION_META = {
  assigned: { label:"Assigned",  bg:"#EFF6FF", color:"#2563EB" },
  changed:  { label:"Changed",   bg:"#FFFBEB", color:"#D97706" },
  revoked:  { label:"Revoked",   bg:"#FEF2F2", color:"#DC2626" },
  created:  { label:"Role Created", bg:"#F0FDF4", color:"#059669" },
  updated:  { label:"Role Updated", bg:"#F5F3FF", color:"#7C3AED" },
};

function ActionBadge({ action }) {
  const m = ACTION_META[action] ?? { label:action, bg:"#F1F5F9", color:"#64748B" };
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:6, background:m.bg, color:m.color }}>
      {m.label}
    </span>
  );
}

/* ─────────────────────────── Permission Matrix ───────────────────── */

function PermissionMatrix({ roles }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:820 }}>
        <thead>
          <tr>
            <th style={{ width:160, textAlign:"left", padding:"10px 12px", background:"#F8FAFC", borderBottom:"2px solid #E2E8F0", color:"#374151", fontWeight:700, position:"sticky", left:0, zIndex:2 }}>
              Module / Permission
            </th>
            {roles.map(r => (
              <th key={r.id} colSpan={4} style={{
                textAlign:"center", padding:"10px 6px", background:"#F8FAFC",
                borderBottom:"2px solid #E2E8F0", color:r.color, fontWeight:700,
                borderLeft:"1px solid #E2E8F0", whiteSpace:"nowrap",
              }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                  <ColorDot color={r.color} /> {r.name}
                  {r.system && <span style={{ fontSize:9, fontWeight:700, background:`${r.color}20`, color:r.color, padding:"1px 5px", borderRadius:4 }}>SYS</span>}
                </div>
              </th>
            ))}
          </tr>
          <tr>
            <th style={{ background:"#F1F5F9", borderBottom:"1px solid #E2E8F0", position:"sticky", left:0, zIndex:2 }} />
            {roles.map(r =>
              PERMS.map(p => (
                <th key={`${r.id}-${p}`} style={{
                  padding:"5px 4px", background:"#F1F5F9", borderBottom:"1px solid #E2E8F0",
                  textAlign:"center", color:"#94A3B8", fontWeight:600, fontSize:10,
                  borderLeft: p==="view" ? "1px solid #E2E8F0" : "none",
                }}>
                  {PERM_LABEL[p].slice(0,1)}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((mod, mi) => (
            <tr key={mod} style={{ background: mi%2===0 ? "#fff" : "#FAFBFC" }}>
              <td style={{
                padding:"10px 12px", fontWeight:600, color:"#334155", fontSize:12,
                borderBottom:"1px solid #F1F5F9", whiteSpace:"nowrap",
                position:"sticky", left:0, background: mi%2===0 ? "#fff" : "#FAFBFC",
                zIndex:1, borderRight:"1px solid #E2E8F0",
              }}>
                {mod}
              </td>
              {roles.map(r =>
                PERMS.map(p => {
                  const on = r.permissions[mod]?.[p] ?? false;
                  return (
                    <td key={`${r.id}-${p}`} style={{
                      textAlign:"center", padding:"10px 4px",
                      borderBottom:"1px solid #F1F5F9",
                      borderLeft: p==="view" ? "1px solid #E2E8F0" : "none",
                    }}>
                      {on
                        ? <Check size={14} color="#10B981" strokeWidth={2.5} />
                        : <X size={12} color="#D1D5DB" strokeWidth={2} />
                      }
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display:"flex", gap:20, marginTop:12, flexWrap:"wrap" }}>
        <span style={{ fontSize:11, color:"#64748B", display:"flex", alignItems:"center", gap:5 }}>
          <Check size={12} color="#10B981" strokeWidth={2.5} /> Allowed
        </span>
        <span style={{ fontSize:11, color:"#64748B", display:"flex", alignItems:"center", gap:5 }}>
          <X size={12} color="#D1D5DB" strokeWidth={2} /> Denied
        </span>
        {PERMS.map(p => (
          <span key={p} style={{ fontSize:11, color:"#64748B" }}>
            <b style={{ color:"#374151" }}>{PERM_LABEL[p].slice(0,1)}</b> = {PERM_LABEL[p]}
          </span>
        ))}
        <span style={{ fontSize:11, color:"#64748B" }}><b style={{ color:"#374151" }}>SYS</b> = Built-in system role</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── Role Editor Modal ───────────────────── */

function RoleModal({ role, onSave, onClose, saving = false }) {
  const [name,  setName]  = useState(role?.name        ?? "");
  const [desc,  setDesc]  = useState(role?.description ?? "");
  const [color, setColor] = useState(role?.color       ?? ROLE_COLORS[0]);
  const [perms, setPerms] = useState(role?.permissions ?? emptyPermissions());

  function toggle(mod, perm) {
    setPerms(prev => ({ ...prev, [mod]: { ...prev[mod], [perm]: !prev[mod][perm] } }));
  }
  function toggleAll(mod) {
    const all = PERMS.every(p => perms[mod][p]);
    setPerms(prev => ({ ...prev, [mod]: Object.fromEntries(PERMS.map(p => [p, !all])) }));
  }
  function toggleGlobal(perm) {
    const all = MODULES.every(m => perms[m][perm]);
    setPerms(prev => {
      const next = { ...prev };
      MODULES.forEach(m => { next[m] = { ...next[m], [perm]: !all }; });
      return next;
    });
  }

  return (
    <div style={S.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={S.modal}>
        {/* header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:color, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Shield size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:"#0F172A" }}>{role ? "Edit Role" : "Create New Role"}</div>
              <div style={{ fontSize:12, color:"#64748B" }}>Define name, color and permissions per module</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8" }}>
            <X size={20} />
          </button>
        </div>

        {/* basic info */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
          <div>
            <label style={S.label}>Role Name *</label>
            <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Transport Manager" />
          </div>
          <div>
            <label style={S.label}>Role Color</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", paddingTop:4 }}>
              {ROLE_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width:26, height:26, borderRadius:"50%", background:c, border:"none",
                  cursor:"pointer", outline: color===c ? `3px solid ${c}` : "none", outlineOffset:2,
                }} />
              ))}
            </div>
          </div>
          <div style={{ gridColumn:"1/-1" }}>
            <label style={S.label}>Description</label>
            <input style={S.input} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description of this role" />
          </div>
        </div>

        {/* global toggles */}
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>Quick toggle:</span>
          {PERMS.map(p => {
            const all = MODULES.every(m => perms[m][p]);
            return (
              <button key={p} onClick={() => toggleGlobal(p)} style={{
                padding:"4px 12px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer",
                border:"1px solid", borderColor: all ? "#2563EB" : "#E2E8F0",
                background: all ? "#EFF6FF" : "#F8FAFC", color: all ? "#2563EB" : "#64748B",
                transition:"all .12s",
              }}>
                All {PERM_LABEL[p]}
              </button>
            );
          })}
        </div>

        {/* per-module grid */}
        <div style={{ border:"1px solid #E2E8F0", borderRadius:12, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(4,80px)", background:"#F8FAFC", padding:"8px 14px", borderBottom:"1px solid #E2E8F0" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#374151" }}>MODULE</div>
            {PERMS.map(p => (
              <div key={p} style={{ fontSize:11, fontWeight:700, color:"#374151", textAlign:"center" }}>{PERM_LABEL[p].toUpperCase()}</div>
            ))}
          </div>
          {MODULES.map((mod, mi) => {
            const allOn = PERMS.every(p => perms[mod][p]);
            return (
              <div key={mod} style={{
                display:"grid", gridTemplateColumns:"1fr repeat(4,80px)",
                padding:"10px 14px", alignItems:"center",
                borderBottom: mi < MODULES.length-1 ? "1px solid #F1F5F9" : "none",
                background: mi%2===0 ? "#fff" : "#FAFBFC",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={() => toggleAll(mod)}>
                  <span style={{ fontSize:13, fontWeight:600, color:"#334155" }}>{mod}</span>
                  {allOn && <span style={{ fontSize:10, fontWeight:700, color:"#2563EB", background:"#EFF6FF", padding:"1px 6px", borderRadius:6 }}>ALL</span>}
                </div>
                {PERMS.map(p => (
                  <div key={p} style={{ display:"flex", justifyContent:"center" }}>
                    <Check2 on={perms[mod][p]} onClick={() => toggle(mod, p)} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
          <button onClick={onClose} style={{ ...S.btn("#F1F5F9","#374151") }}>Cancel</button>
          <button
            onClick={() => !saving && name.trim() && onSave({ name:name.trim(), description:desc.trim(), color, permissions:perms })}
            style={{ ...S.btn(), opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}
            disabled={saving}
          >
            <Shield size={14} /> {saving ? "Saving…" : role ? "Save Changes" : "Create Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Assign Role Modal ───────────────────── */

function AssignModal({ roles, onSave, onClose }) {
  const [userName, setUserName] = useState("");
  const [userId,   setUserId]   = useState("");
  const [roleId,   setRoleId]   = useState(roles[0]?.id ?? "");
  const [prevRole, setPrevRole] = useState("");
  const [note,     setNote]     = useState("");
  const action = prevRole ? "changed" : "assigned";

  function handleSave() {
    if (!userName.trim() || !roleId) return;
    const role = roles.find(r => r.id === Number(roleId));
    onSave({
      user:      userName.trim(),
      userId:    userId.trim() || `U-${Math.floor(Math.random()*900)+100}`,
      action,
      role:      role.name,
      prevRole:  prevRole || null,
      grantedBy: "Admin User",
      ts:        new Date().toISOString(),
      note:      note.trim(),
    });
  }

  return (
    <div style={S.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ ...S.modal, width:"min(92vw,480px)", padding:28 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:800, color:"#0F172A" }}>Assign Role to User</div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8" }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={S.label}>User Name *</label>
            <input style={S.input} value={userName} onChange={e => setUserName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label style={S.label}>User ID (optional)</label>
            <input style={S.input} value={userId} onChange={e => setUserId(e.target.value)} placeholder="e.g. U-042" />
          </div>
          <div>
            <label style={S.label}>Assign Role *</label>
            <div style={{ position:"relative" }}>
              <select
                style={{ ...S.input, appearance:"none", paddingRight:32, cursor:"pointer" }}
                value={roleId}
                onChange={e => setRoleId(e.target.value)}
              >
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <ChevronDown size={14} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:"#94A3B8" }} />
            </div>
          </div>
          <div>
            <label style={S.label}>Previous Role (if changing)</label>
            <input style={S.input} value={prevRole} onChange={e => setPrevRole(e.target.value)} placeholder="Leave blank if first assignment" />
          </div>
          <div>
            <label style={S.label}>Note / Reason</label>
            <input style={S.input} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Promoted to fleet ops lead" />
          </div>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:22 }}>
          <button onClick={onClose} style={{ ...S.btn("#F1F5F9","#374151") }}>Cancel</button>
          <button onClick={handleSave} style={S.btn()} disabled={!userName.trim()}>
            <UserPlus size={14} /> Assign Role
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── History Table ───────────────────────── */

function HistoryTab({ history, roles, onAssign }) {
  const [search,     setSearch]     = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [filterAct,  setFilterAct]  = useState("All");

  const roleNames = ["All", ...Array.from(new Set(history.map(h => h.role)))];
  const actTypes  = ["All", "assigned", "changed", "revoked", "created", "updated"];

  const filtered = useMemo(() => history.filter(h => {
    const q = search.toLowerCase();
    const matchSearch = !q || h.user.toLowerCase().includes(q) || h.role.toLowerCase().includes(q) || h.grantedBy.toLowerCase().includes(q);
    const matchRole   = filterRole==="All" || h.role===filterRole;
    const matchAct    = filterAct==="All"  || h.action===filterAct;
    return matchSearch && matchRole && matchAct;
  }), [history, search, filterRole, filterAct]);

  return (
    <div>
      {/* toolbar */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <Search size={14} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#94A3B8" }} />
          <input
            style={{ ...S.input, paddingLeft:32 }}
            placeholder="Search user, role, granted by…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ position:"relative" }}>
          <select style={{ ...S.input, width:"auto", paddingRight:28, cursor:"pointer", appearance:"none" }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            {roleNames.map(r => <option key={r}>{r}</option>)}
          </select>
          <ChevronDown size={13} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:"#94A3B8" }} />
        </div>
        <div style={{ position:"relative" }}>
          <select style={{ ...S.input, width:"auto", paddingRight:28, cursor:"pointer", appearance:"none" }} value={filterAct} onChange={e => setFilterAct(e.target.value)}>
            {actTypes.map(a => <option key={a} value={a}>{a==="All" ? "All actions" : ACTION_META[a]?.label ?? a}</option>)}
          </select>
          <ChevronDown size={13} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", color:"#94A3B8" }} />
        </div>
        <button style={S.btn()} onClick={onAssign}>
          <UserPlus size={14} /> Assign Role
        </button>
      </div>

      {/* stats strip */}
      <div style={{ display:"flex", gap:12, marginBottom:18, flexWrap:"wrap" }}>
        {[
          { label:"Total Events",  val:history.length,                                       color:"#2563EB" },
          { label:"Assignments",   val:history.filter(h=>h.action==="assigned").length,       color:"#059669" },
          { label:"Role Changes",  val:history.filter(h=>h.action==="changed").length,        color:"#D97706" },
          { label:"Revocations",   val:history.filter(h=>h.action==="revoked").length,        color:"#DC2626" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"10px 18px", minWidth:120 }}>
            <div style={{ fontSize:22, fontWeight:800, color }}>{val}</div>
            <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* table */}
      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:"#F8FAFC", borderBottom:"1px solid #E2E8F0" }}>
              {["User","Action","Role","Previous Role","Granted By","Date & Time","Note"].map(h => (
                <th key={h} style={{ textAlign:"left", padding:"10px 14px", fontWeight:700, fontSize:11, color:"#374151", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign:"center", padding:32, color:"#94A3B8", fontSize:13 }}>
                  No history entries match your filters.
                </td>
              </tr>
            )}
            {filtered.map((h, i) => {
              const roleObj = DEFAULT_ROLES.find(r => r.name===h.role);
              const roleColor = roleObj?.color ?? "#64748B";
              return (
                <tr key={h.id} style={{ borderBottom:"1px solid #F1F5F9", background: i%2===0 ? "#fff" : "#FAFBFC" }}>
                  <td style={{ padding:"11px 14px" }}>
                    <div style={{ fontWeight:600, color:"#0F172A" }}>{h.user}</div>
                    <div style={{ fontSize:11, color:"#94A3B8" }}>{h.userId}</div>
                  </td>
                  <td style={{ padding:"11px 14px" }}>
                    <ActionBadge action={h.action} />
                  </td>
                  <td style={{ padding:"11px 14px" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, fontWeight:700, color:roleColor }}>
                      <ColorDot color={roleColor} size={8} /> {h.role}
                    </span>
                  </td>
                  <td style={{ padding:"11px 14px", color:"#94A3B8", fontSize:12 }}>
                    {h.prevRole ? (
                      <span style={{ textDecoration:"line-through" }}>{h.prevRole}</span>
                    ) : (
                      <span style={{ color:"#D1D5DB" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding:"11px 14px", fontSize:12, color:"#334155", fontWeight:500 }}>{h.grantedBy}</td>
                  <td style={{ padding:"11px 14px", fontSize:11, color:"#64748B", whiteSpace:"nowrap" }}>{fmt(h.ts)}</td>
                  <td style={{ padding:"11px 14px", fontSize:11, color:"#94A3B8", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    {h.note || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:11, color:"#94A3B8", marginTop:10, textAlign:"right" }}>
        Showing {filtered.length} of {history.length} events
      </div>
    </div>
  );
}

/* ─────────────────────────── Role Card ──────────────────────────── */

function RoleCard({ role, onEdit, onDelete }) {
  const granted = MODULES.reduce((acc, m) => acc + PERMS.filter(p => role.permissions[m]?.[p]).length, 0);
  const pct     = Math.round((granted / (MODULES.length * PERMS.length)) * 100);

  return (
    <div style={{ ...S.card, borderLeft:`4px solid ${role.color}`, transition:"box-shadow .2s" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow="0 6px 24px rgba(0,0,0,.09)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.04)"}
    >
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:role.color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Shield size={17} color="#fff" />
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{role.name}</span>
              {role.system && (
                <span style={{ fontSize:9, fontWeight:800, background:`${role.color}20`, color:role.color, padding:"2px 6px", borderRadius:5, letterSpacing:".05em" }}>
                  SYSTEM
                </span>
              )}
            </div>
            <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>{role.description}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          {!role.system && (
            <button onClick={() => onEdit(role)} style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"6px 8px", cursor:"pointer", color:"#64748B" }}
              onMouseEnter={e => e.currentTarget.style.background="#E2E8F0"}
              onMouseLeave={e => e.currentTarget.style.background="#F1F5F9"}
            >
              <Edit2 size={13} />
            </button>
          )}
          {!role.system && (
            <button onClick={() => onDelete(role.id)} style={{ background:"#FEF2F2", border:"none", borderRadius:8, padding:"6px 8px", cursor:"pointer", color:"#DC2626" }}
              onMouseEnter={e => e.currentTarget.style.background="#FECACA"}
              onMouseLeave={e => e.currentTarget.style.background="#FEF2F2"}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* access bar */}
      <div style={{ marginBottom:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
          <span style={{ fontSize:11, color:"#64748B" }}>Access coverage</span>
          <span style={{ fontSize:11, fontWeight:700, color:role.color }}>{pct}%</span>
        </div>
        <div style={{ height:5, background:"#F1F5F9", borderRadius:99 }}>
          <div style={{ height:"100%", width:`${pct}%`, background:role.color, borderRadius:99, transition:"width .4s" }} />
        </div>
      </div>

      {/* permission chips */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
        {MODULES.slice(0, 6).map(m => {
          const on = PERMS.filter(p => role.permissions[m]?.[p]);
          if (!on.length) return null;
          return (
            <span key={m} style={{
              fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:6,
              background:`${role.color}15`, color:role.color, border:`1px solid ${role.color}30`,
            }}>
              {m} · {on.map(p => PERM_LABEL[p].slice(0,1)).join("")}
            </span>
          );
        })}
        {MODULES.length > 6 && <span style={{ fontSize:10, color:"#94A3B8" }}>+{MODULES.length-6} more</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────── Main Page ──────────────────────────── */

export default function RolesPage() {
  const [roles,    setRoles]    = useState(DEFAULT_ROLES);
  const [history,  setHistory]  = useState(SEED_HISTORY);
  const [nextHid,  setNextHid]  = useState(SEED_HISTORY.length + 1);
  const [tab,      setTab]      = useState("roles");
  const [modal,    setModal]    = useState(null);   // null | "create" | "assign" | role-obj
  const [deleteId, setDeleteId] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [saving,   setSaving]   = useState(false);

  // Load real roles from API on mount; fall back to DEFAULT_ROLES on failure
  const loadRoles = useCallback(() => {
    getRoles()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setRoles(data.map(mapApiRole));
        }
      })
      .catch(() => {}); // keep DEFAULT_ROLES on failure
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  function addHistory(entry) {
    setHistory(prev => [{ id: nextHid, ...entry }, ...prev]);
    setNextHid(n => n + 1);
  }

  async function handleRoleSave(data) {
    setSaving(true);
    setApiError(null);
    try {
      if (modal === "create") {
        // 1. Create the role record
        const res = await createRole({
          role_key:     data.name.toLowerCase().replace(/\s+/g, "_"),
          display_name: data.name,
          description:  data.description,
        });
        const newId = res.role_id ?? res.data?.role_id;

        // 2. Set its permissions
        if (newId) {
          await updateRolePermissions(newId, uiPermToDb(data.permissions));
        }

        addHistory({ user:"—", userId:"—", action:"created", role:data.name, prevRole:null, grantedBy:"Admin User", ts:new Date().toISOString(), note:"New role definition created" });
      } else {
        // Editing a custom role — only permissions can change (system roles are blocked by API)
        await updateRolePermissions(modal.id, uiPermToDb(data.permissions));
        addHistory({ user:"—", userId:"—", action:"updated", role:data.name, prevRole:null, grantedBy:"Admin User", ts:new Date().toISOString(), note:"Permissions updated" });
      }

      // Reload from server so UI reflects DB truth
      loadRoles();
      setModal(null);
    } catch (err) {
      setApiError(err?.response?.data?.error ?? err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleAssignSave(entry) {
    addHistory(entry);
    setModal(null);
  }

  async function handleDelete() {
    const role = roles.find(r => r.id === deleteId);
    try {
      await deleteRole(deleteId);
      setRoles(prev => prev.filter(r => r.id !== deleteId));
      addHistory({ user:"—", userId:"—", action:"revoked", role:role?.name ?? "Unknown", prevRole:null, grantedBy:"Admin User", ts:new Date().toISOString(), note:"Role definition deleted" });
    } catch (err) {
      setApiError(err?.response?.data?.error ?? "Delete failed");
    }
    setDeleteId(null);
  }

  const systemRoles = roles.filter(r => r.system);
  const customRoles = roles.filter(r => !r.system);

  const tabStyle = (t) => ({
    padding:"8px 20px", borderRadius:9, fontSize:13, fontWeight:600,
    cursor:"pointer", border:"none", transition:"all .15s",
    background: tab===t ? "#2563EB" : "#F1F5F9",
    color:      tab===t ? "#fff"    : "#64748B",
  });

  return (
    <div style={S.page}>
      {/* API error toast */}
      {apiError && (
        <div style={{ position:"fixed", bottom:24, right:24, zIndex:2000,
                      background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10,
                      padding:"12px 18px", fontSize:13, color:"#DC2626", fontWeight:600,
                      boxShadow:"0 8px 24px rgba(0,0,0,.12)", display:"flex", alignItems:"center", gap:10 }}>
          ⚠ {apiError}
          <button onClick={() => setApiError(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#DC2626", fontWeight:800 }}>×</button>
        </div>
      )}

      {/* header */}
      <div style={S.header}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:"linear-gradient(135deg,#7C3AED,#6D28D9)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 14px rgba(124,58,237,.3)" }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <div style={S.h1}>Roles &amp; Permissions</div>
            <div style={S.sub}>{systemRoles.length} system roles &nbsp;·&nbsp; {customRoles.length} custom roles &nbsp;·&nbsp; {history.length} history events</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {tab === "history" && (
            <button style={S.btn("#059669")} onClick={() => setModal("assign")}
              onMouseEnter={e => e.currentTarget.style.opacity=".88"}
              onMouseLeave={e => e.currentTarget.style.opacity="1"}
            >
              <UserPlus size={15} /> Assign Role
            </button>
          )}
          <button style={S.btn()} onClick={() => setModal("create")}
            onMouseEnter={e => { e.currentTarget.style.background="#1D4ED8"; e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="#2563EB"; e.currentTarget.style.transform="none"; }}
          >
            <Plus size={15} /> Create Role
          </button>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:24 }}>
        <button style={tabStyle("roles")}   onClick={() => setTab("roles")}>Role Cards</button>
        <button style={tabStyle("matrix")}  onClick={() => setTab("matrix")}>Permission Matrix</button>
        <button style={tabStyle("history")} onClick={() => setTab("history")}>
          <span style={{ display:"flex", alignItems:"center", gap:6 }}>
            <History size={13} /> Assignment History
            <span style={{ background: tab==="history" ? "rgba(255,255,255,.3)" : "#E2E8F0", color: tab==="history" ? "#fff" : "#64748B", fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:6 }}>
              {history.length}
            </span>
          </span>
        </button>
      </div>

      {/* ── Role Cards ── */}
      {tab === "roles" && (
        <div>
          {/* system roles */}
          <div style={S.sectionLabel}>System Roles — built-in RBAC definitions</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16, marginBottom:28 }}>
            {systemRoles.map(r => (
              <RoleCard key={r.id} role={r} onEdit={() => setModal(r)} onDelete={setDeleteId} />
            ))}
          </div>

          {/* custom roles */}
          <div style={S.sectionLabel}>Custom Roles</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:16 }}>
            {customRoles.map(r => (
              <RoleCard key={r.id} role={r} onEdit={() => setModal(r)} onDelete={setDeleteId} />
            ))}
            <div onClick={() => setModal("create")} style={{
              ...S.card, border:"2px dashed #E2E8F0", cursor:"pointer",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              gap:10, minHeight:140, color:"#94A3B8", transition:"all .15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor="#2563EB"; e.currentTarget.style.color="#2563EB"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor="#E2E8F0"; e.currentTarget.style.color="#94A3B8"; }}
            >
              <Plus size={26} />
              <span style={{ fontSize:13, fontWeight:600 }}>Create Custom Role</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Permission Matrix ── */}
      {tab === "matrix" && (
        <div style={S.card}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#0F172A", marginBottom:4 }}>Permission Matrix</div>
            <div style={{ fontSize:12, color:"#64748B" }}>Full RBAC grid — all {roles.length} roles × {MODULES.length} modules × {PERMS.length} permission types. V=View C=Create E=Edit D=Delete.</div>
          </div>
          <PermissionMatrix roles={roles} />
        </div>
      )}

      {/* ── History ── */}
      {tab === "history" && (
        <HistoryTab
          history={history}
          roles={roles}
          onAssign={() => setModal("assign")}
        />
      )}

      {/* ── modals ── */}
      {(modal === "create" || (modal && modal !== "assign")) && (
        <RoleModal
          role={modal === "create" ? null : modal}
          onSave={handleRoleSave}
          onClose={() => !saving && setModal(null)}
          saving={saving}
        />
      )}

      {modal === "assign" && (
        <AssignModal
          roles={roles}
          onSave={handleAssignSave}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── delete confirm ── */}
      {deleteId && (
        <div style={S.overlay} onClick={e => e.target===e.currentTarget && setDeleteId(null)}>
          <div style={{ background:"#fff", borderRadius:16, padding:28, width:380, boxShadow:"0 20px 50px rgba(0,0,0,.15)" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#0F172A", marginBottom:8 }}>Delete Role?</div>
            <div style={{ fontSize:13, color:"#64748B", marginBottom:22 }}>
              This will permanently remove the role and log the event to history.
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button onClick={() => setDeleteId(null)} style={{ ...S.btn("#F1F5F9","#374151") }}>Cancel</button>
              <button onClick={handleDelete} style={S.btn("#DC2626")}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
