// pages/UsersPage.jsx
import { useState, useEffect } from "react";
import { Panel } from "../components/Panel";
import { DataTable } from "../components/Table";
import { Modal } from "../components/Modal";
import { StatusPill } from "../components/StatusPill";
import { StatCard } from "../components/StatCard";
import { getUsers, createNotification } from "../api/endpoints";
import apiClient from "../api/apiClient";
import { MOCK_USERS } from "../data/mockData";

const ROLES = ["Passenger", "Driver", "Admin"];

const ROLE_STYLE = {
  Admin:     { bg: "#FEF2F2",  color: "#B91C1C"  },
  Driver:    { bg: "#EFF6FF",  color: "#1E40AF"  },
  Passenger: { bg: "#F5F3FF",  color: "#6D28D9"  },
};

const EMPTY_FORM = { name: "", email: "", role: "Passenger", status: "Active" };

function normalizeUser(u) {
  return {
    id: u.user_id ?? u.id,
    name: u.full_name ?? u.name ?? "",
    email: u.email ?? "",
    role: u.role ?? "Passenger",
    joined: u.created_at ? u.created_at.slice(0, 10) : (u.joined ?? ""),
    trips: u.trips ?? 0,
    status: u.status ?? "Active",
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getUsers()
      .then((data) => setUsers((data || []).map(normalizeUser)))
      .catch(() => setUsers(MOCK_USERS));
  }, []);
  const [roleFilter, setRoleFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState(null);

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "All" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }
  function openEdit(u) {
    setEditTarget(u.id);
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.email) return;
    if (editTarget) {
      await apiClient.put(`/users/${editTarget}`, { full_name: form.name, phone: "" }).catch(() => {});
      setUsers((prev) =>
        prev.map((u) => (u.id === editTarget ? { ...u, ...form } : u)),
      );
    } else {
      const created = await apiClient.post("/auth/register", {
        full_name: form.name,
        email: form.email,
        password: "changeme123",
        role: form.role,
      }).catch(() => null);
      const newUser = {
        id: created?.data?.user_id ?? Date.now(),
        ...form,
        joined: new Date().toISOString().split("T")[0],
        trips: 0,
      };
      setUsers((prev) => [...prev, newUser]);
    }
    setModalOpen(false);
  }

  async function handleDelete() {
    await apiClient.delete(`/users/${deleteId}`).catch(() => {});
    setUsers((prev) => prev.filter((u) => u.id !== deleteId));
    setDeleteId(null);
  }

  const counts = {
    all: users.length,
    passengers: users.filter((u) => u.role === "Passenger").length,
    drivers: users.filter((u) => u.role === "Driver").length,
    admins: users.filter((u) => u.role === "Admin").length,
  };

  const columns = [
    {
      key: "name",
      label: "User",
      render: (v, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#EFF6FF",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {v
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: "#0F172A" }}>{v}</div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (v) => {
        const s = ROLE_STYLE[v] || {};
        return (
          <span
            style={{
              background: s.bg,
              color: s.color,
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: 20,
            }}
          >
            {v}
          </span>
        );
      },
    },
    { key: "joined", label: "Joined" },
    { key: "trips", label: "Total trips" },
    {
      key: "status",
      label: "Status",
      render: (v) => <StatusPill status={v} />,
    },
    {
      key: "id",
      label: "Actions",
      render: (_, row) => (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            style={{
              fontSize: 11,
              color: "#2563EB",
              background: "#EFF6FF",
              border: "none",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteId(row.id);
            }}
            style={{
              fontSize: 11,
              color: "#B91C1C",
              background: "#FEF2F2",
              border: "none",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div>
          <h1
            style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "-.3px" }}
          >
            Users
          </h1>
          <p style={{ fontSize: 12, color: "#64748B", margin: "2px 0 0" }}>
            Manage all registered users
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={openAdd}
          className="btn-primary"
          style={{
            background: "#2563EB",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "-.1px",
          }}
        >
          + Add user
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <StatCard
          label="Total users"
          value={counts.all}
          delta="registered"
          up={null}
        />
        <StatCard
          label="Passengers"
          value={counts.passengers}
          delta="active"
          up={null}
        />
        <StatCard
          label="Drivers"
          value={counts.drivers}
          delta="on platform"
          up={null}
        />
        <StatCard
          label="Admins"
          value={counts.admins}
          delta="system users"
          up={null}
        />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            fontSize: 13,
            outline: "none",
            width: 260,
          }}
        />
        {["All", ...ROLES].map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              cursor: "pointer",
              border: roleFilter === r ? "none" : "1px solid #e0e0e0",
              background: roleFilter === r ? "#2563EB" : "#fff",
              color: roleFilter === r ? "#fff" : "#555",
              fontWeight: roleFilter === r ? 600 : 400,
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <Panel title={`${filtered.length} users`}>
        <DataTable columns={columns} rows={filtered} onRowClick={openEdit} />
      </Panel>

      {modalOpen && (
        <Modal
          title={editTarget ? "Edit user" : "Add new user"}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        >
          {[
            {
              label: "Full name",
              key: "name",
              type: "text",
              placeholder: "e.g. Ali Hassan",
            },
            {
              label: "Email",
              key: "email",
              type: "email",
              placeholder: "user@mail.com",
            },
          ].map((f) => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                {f.label}
              </label>
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={(e) =>
                  setForm((p) => ({ ...p, [f.key]: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}
          {[
            { label: "Role", key: "role", options: ROLES },
            { label: "Status", key: "status", options: ["Active", "Inactive"] },
          ].map((f) => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#475569",
                  display: "block",
                  marginBottom: 5,
                }}
              >
                {f.label}
              </label>
              <select
                value={form[f.key]}
                onChange={(e) =>
                  setForm((p) => ({ ...p, [f.key]: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          ))}
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete user" onClose={() => setDeleteId(null)}>
          <p style={{ fontSize: 14, color: "#333", marginBottom: 20 }}>
            Are you sure you want to delete this user? This cannot be undone.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={() => setDeleteId(null)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#EF4444",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
