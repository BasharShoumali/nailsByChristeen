const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const fmtMoney = (n) =>
  `₪${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fullName = (u) => [u?.firstName || "", u?.lastName || ""].join(" ").trim() || "—";

export default function UsersTable({ users, q, setQ, loading, err, onHistory, onAdd }) {
  const filtered = (q || "").trim()
    ? users.filter((u) => {
        const s = q.trim().toLowerCase();
        return (
          String(u.userNumber ?? "").includes(s) ||
          String(u.userID ?? "").includes(s) ||
          (u.userName ?? "").toLowerCase().includes(s) ||
          fullName(u).toLowerCase().includes(s) ||
          (u.phoneNumber ?? "").toLowerCase().includes(s)
        );
      })
    : users;

  return (
    <>
      <div className="au-toolbar">
        <div className="au-title">
          <h1>Users</h1>
          <p className="au-subtitle">Sorted by account number (userNumber)</p>
        </div>
        <div className="au-actions">
          <input
            type="search"
            placeholder="Search users…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="au-search"
            aria-label="Search users"
          />
          {loading && <span className="au-pill">Loading…</span>}
          {err && <span className="au-pill au-error">{err}</span>}
        </div>
      </div>

      <div className="au-table-wrap">
        <table className="au-table">
          <thead>
            <tr>
              <th>#</th>
              <th>User ID</th>
              <th>Name</th>
              <th>Username</th>
              <th>Phone</th>
              <th>DOB</th>
              <th>Visited</th>
              <th>Revenue</th>
              <th className="au-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.userID}>
                <td className="au-num" data-label="#">{u.userNumber ?? "—"}</td>
                <td className="au-num" data-label="User ID">{u.userID}</td>
                <td data-label="Name">{fullName(u)}</td>
                <td data-label="Username">{u.userName || "—"}</td>
                <td data-label="Phone">{u.phoneNumber || "—"}</td>
                <td data-label="DOB">{fmtDate(u.dateOfBirth)}</td>
                <td className="au-num" data-label="Closed">{u.closedCount ?? 0}</td>
                <td className="au-num" data-label="Revenue">{fmtMoney(u.revenue)}</td>
                <td className="au-actions-cell" data-label="Actions">
                  <div className="au-btn-group">
                    <button className="au-btn au-secondary" onClick={() => onHistory(u)}>History</button>
                    <button className="au-btn au-primary" onClick={() => onAdd(u)}>Add Appointment</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !err && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="au-muted au-center">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
