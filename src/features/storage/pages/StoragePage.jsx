// src/features/storage/pages/StoragePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../../../cssFiles/Storage.css";
import { storageApi } from "../api";
import { fmtDate, softWrapBarcode, readLocalAuth } from "../utils";
import ItemForm from "../components/ItemForm";
import CategoryManager from "../components/CategoryManager";
import QuantityModal from "../components/QuantityModal";
import ConfirmModal from "../components/ConfirmModal";

export default function StoragePage() {
  const { userID } = useMemo(readLocalAuth, []);

  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [zeroOnly, setZeroOnly] = useState(false);
  const [lowOnly, setLowOnly] = useState(false);

  // ui
  const [showItemForm, setShowItemForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [showCatForm, setShowCatForm] = useState(false);

  // modals
  const [qtyModal, setQtyModal] = useState(null); // { name, mode:'add'|'remove' }
  const [confirm, setConfirm] = useState(null);   // { type:'use'|'delete', name }

  // query
  const query = useMemo(() => ({
    search: search.trim(),
    category: category.trim(),
    zeroOnly,
    lowOnly,
  }), [search, category, zeroOnly, lowOnly]);

  // client-side fallback filter
  const viewItems = useMemo(() => {
    let arr = items;
    if (zeroOnly && lowOnly) return arr.filter((it) => Number(it.qnt) <= 1);
    if (zeroOnly)             return arr.filter((it) => Number(it.qnt) === 0);
    if (lowOnly)              return arr.filter((it) => Number(it.qnt) === 1);
    return arr;
  }, [items, zeroOnly, lowOnly]);

  async function loadItems() {
    setLoading(true); setError("");
    try {
      const data = await storageApi.listProducts(query, userID);
      setItems(data.items || []);
    } catch (e) {
      setItems([]);
      setError(e.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await storageApi.listCategories(userID);
      setCategories(data.categories || []);
    } catch { /* ignore */ }
  }

  useEffect(() => { loadCategories(); }, []); // once
  useEffect(() => { loadItems(); }, [query.search, query.category, query.zeroOnly, query.lowOnly]); // refetch on filter change

  function onAddItem() { setEditing(null); setShowItemForm(true); }
  function onEditItem(row) { setEditing(row); setShowItemForm(true); }

  // actions
  async function doDelete(name) {
    setBusyKey(name); setError("");
    try { await storageApi.deleteProduct(name, userID); await loadItems(); }
    catch (e) { setError(e.message || "Delete failed"); }
    finally { setBusyKey(null); }
  }

  async function doAdjust(name, delta) {
    setBusyKey(name); setError("");
    try { await storageApi.adjustQuantity(name, delta, userID); await loadItems(); }
    catch (e) { setError(e.message || "Adjust failed"); }
    finally { setBusyKey(null); }
  }

  async function doUse(name) {
    setBusyKey(name); setError("");
    try { await storageApi.useOne(name, userID); await loadItems(); }
    catch (e) { setError(e.message || "Use failed"); }
    finally { setBusyKey(null); }
  }

  return (
    <div className="storage">
      <header className="storage__header">
        <h1 className="storage__title">Storage (consumables)</h1>
        <div className="storage__toolbar">
          <input className="storage__search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="storage__search storage__search--narrow" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="storage__low">
            <input type="checkbox" checked={zeroOnly} onChange={(e) => setZeroOnly(e.target.checked)} />
            Out of stock only
          </label>
          <label className="storage__low">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
            Low stock (1)
          </label>
          <button className="btn btn--accent" onClick={onAddItem}>+ Add Item</button>
          <button className="btn btn--ghost" onClick={() => setShowCatForm(true)}>Manage Categories</button>
        </div>
      </header>

      {error && <div className="storage__error">{error}</div>}

      <div className="storage__tablewrap">
        <table className="storage__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th className="num">Qnt</th>
              <th>Barcode</th>
              <th>Color</th>
              <th>Brand</th>
              <th>Last Used</th>
              <th className="actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="center">Loading…</td></tr>
            ) : viewItems.length === 0 ? (
              <tr><td colSpan={8} className="center">No items</td></tr>
            ) : (
              viewItems.map((it) => {
                const zero = Number(it.qnt) === 0;
                const rowBusy = busyKey === it.productName;
                return (
                  <tr key={it.productName} className={zero ? "row row--low" : "row"}>
                    <td data-label="Name"><div className="cell-name"><span className="cell-name__title">{it.productName}</span></div></td>
                    <td data-label="Category"><span className="cell-val">{it.categoryName}</span></td>
                    <td data-label="Qnt" className="num"><span className="cell-val">{it.qnt}</span></td>
                    <td data-label="Barcode"><span className="cell-val cell-val--barcode">{it.barcode ? softWrapBarcode(it.barcode) : "-"}</span></td>
                    <td data-label="Color"><span className="cell-val">{it.color || "-"}</span></td>
                    <td data-label="Brand"><span className="cell-val">{it.firma || "-"}</span></td>
                    <td data-label="Last Used"><span className="cell-val">{fmtDate(it.lastItemOpened)}</span></td>
                    <td className="actions">
                      <div className="actionbar">
                        <button className="btn btn--useone" disabled={rowBusy} onClick={() => setConfirm({ type: "use", name: it.productName })}>
                          Use one
                        </button>
                        <button className="btn btn--ghost btn--plus"  disabled={rowBusy} onClick={() => setQtyModal({ name: it.productName, mode: "add" })}>
                          Add➕
                        </button>
                        <button className="btn btn--ghost btn--minus" disabled={rowBusy} onClick={() => setQtyModal({ name: it.productName, mode: "remove" })}>
                          Remove➖
                        </button>
                        <button className="btn btn--edit" onClick={() => { setEditing(it); setShowItemForm(true); }}>
                          Edit⚙️
                        </button>
                        <button className="btn btn--danger" disabled={rowBusy} onClick={() => setConfirm({ type: "delete", name: it.productName })}>
                          Delete🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <ItemForm
        open={showItemForm}
        editing={editing}
        categories={categories}
        onClose={() => setShowItemForm(false)}
        onSaved={async () => { setShowItemForm(false); await loadItems(); }}
        userID={userID}
      />

      <CategoryManager
        open={showCatForm}
        onClose={() => setShowCatForm(false)}
        categories={categories}
        onChanged={async () => { await loadCategories(); await loadItems(); }}
        userID={userID}
        activeCategory={category}
        setActiveCategory={setCategory}
      />

      <QuantityModal
        open={!!qtyModal}
        name={qtyModal?.name}
        mode={qtyModal?.mode}
        onClose={() => setQtyModal(null)}
        onConfirm={async (n) => {
          const sign = qtyModal.mode === "add" ? +1 : -1;
          const name = qtyModal.name;
          setQtyModal(null);
          await doAdjust(name, sign * n);
        }}
      />

      <ConfirmModal
        open={!!confirm}
        type={confirm?.type}
        name={confirm?.name}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const { type, name } = confirm;
          setConfirm(null);
          if (type === "use") await doUse(name);
          else await doDelete(name);
        }}
      />
    </div>
  );
}
