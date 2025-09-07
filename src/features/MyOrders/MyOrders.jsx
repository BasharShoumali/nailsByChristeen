import { useMemo, useState } from "react";
import "./MyOrders.css";
import useLoggedUser from "./hooks/useLoggedUser";
import useMyAppointments from "./hooks/useMyAppointments";
import OrdersTable, { SORTABLE_COLUMNS } from "./components/OrdersTable";
import ConfirmModal from "./components/ConfirmModal";
import ImageModal from "./components/ImageModal";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "canceled", label: "Canceled" },
];

export default function MyOrders() {
  const user = useLoggedUser();
  const [statusFilter, setStatusFilter] = useState("all");

  const [sortKey, setSortKey] = useState("workDate");
  const [sortDir, setSortDir] = useState("desc");

  // cancel confirm modal
  const [confirmId, setConfirmId] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(new Set());

  // image modal
  const [imgModalOpen, setImgModalOpen] = useState(false);
  const [currentImg, setCurrentImg] = useState("");

  const { rows, setRows, loading, err, setErr, refetch } =
    useMyAppointments(user?.userID, statusFilter);

  const withSet = (set, cb) => { const next = new Set(set); cb(next); return next; };

  function requestCancel(id, afterConfirm) {
    setConfirmId({ id, afterConfirm });
  }

  async function confirmModal() {
    if (!confirmId?.id) return;
    const id = confirmId.id;
    setConfirmBusy(true);
    setPendingCancel((s) => withSet(s, (n) => n.add(id)));
    try {
      await confirmId.afterConfirm?.();
    } finally {
      setConfirmBusy(false);
      setPendingCancel((s) => withSet(s, (n) => n.delete(id)));
      setConfirmId(null);
    }
  }

  const closeModal = () => setConfirmId(null);

  function openImgModal(url) { setCurrentImg(url); setImgModalOpen(true); }
  function closeImgModal() { setImgModalOpen(false); setCurrentImg(""); }

  if (!user?.userID) {
    return (
      <div className="orders-wrap">
        <div className="orders-card">
          <h1 className="orders-title">My Orders</h1>
          <p className="orders-sub">Please log in to view your appointments.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-wrap">
      <div className="orders-card">
        <div className="orders-header">
          <h1 className="orders-title">My Orders</h1>
          <div className="orders-controls">
            <label className="orders-filter">
              <span>Status:</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        <OrdersTable
          rows={rows}
          loading={loading}
          err={err}
          sortKey={sortKey}
          sortDir={sortDir}
          setSortKey={setSortKey}
          setSortDir={setSortDir}
          pendingCancel={pendingCancel}
          requestCancel={requestCancel}
          openImgModal={openImgModal}
          refetch={refetch}
          setRows={setRows}
          setErr={setErr}
        />
      </div>

      <ConfirmModal
        open={!!confirmId}
        title="Cancel appointment?"
        message="Are you sure you want to cancel this appointment?"
        confirmText="Yes, cancel"
        cancelText="Keep appointment"
        onConfirm={confirmModal}
        onCancel={closeModal}
        busy={confirmBusy}
      />

      <ImageModal open={imgModalOpen} imgUrl={currentImg} onClose={closeImgModal} />
    </div>
  );
}
