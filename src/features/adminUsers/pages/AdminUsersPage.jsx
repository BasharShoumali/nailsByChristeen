import { useEffect, useState } from "react";
import { getUsers } from "../api";
import UsersTable from "../components/UsersTable";
import AddAppointmentModal from "../components/AddAppointmentModal";
import HistoryModal from "../components/HistoryModal";
import "../../../cssFiles/AdminUsers.css"; // keep your existing styles

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  // modals
  const [addOpen, setAddOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [activeUser, setActiveUser] = useState(null);

  async function loadUsers() {
    try {
      setLoading(true); setErr("");
      const r = await getUsers();
      if (!r.ok) throw new Error(r.error || "Failed to load users");
      setUsers(r.users || []);
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  return (
    <div className="admin-users au-scope">
      <UsersTable
        users={users}
        q={q}
        setQ={setQ}
        loading={loading}
        err={err}
        onHistory={(u) => { setActiveUser(u); setHistOpen(true); }}
        onAdd={(u) => { setActiveUser(u); setAddOpen(true); }}
      />

      <AddAppointmentModal
        open={addOpen}
        user={activeUser}
        onClose={() => setAddOpen(false)}
        onCreated={() => loadUsers()}
      />

      <HistoryModal
        open={histOpen}
        user={activeUser}
        onClose={() => setHistOpen(false)}
      />
    </div>
  );
}
