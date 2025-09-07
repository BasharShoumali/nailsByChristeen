// src/features/storage/api.js
import { api } from "../../shared/lib/apiClient";

const hdr = (userID) => {
  const h = {};
  const n = Number(userID);
  if (Number.isFinite(n)) h["x-user-id"] = String(n); // harmless if not required
  return h;
};

// build query string from filter object
const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (typeof v === "boolean") { if (v) p.set(k, "true"); return; }
    p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const storageApi = {
  // products
  listProducts: (filters, userID) =>
    api.get(`/products${qs(filters)}`, { headers: hdr(userID) }),

  createProduct: (body, userID) =>
    api.post(`/products`, body, { headers: { "Content-Type": "application/json", ...hdr(userID) } }),

  updateProduct: (name, body, userID) =>
    api.patch(`/products/${encodeURIComponent(name)}`, body, { headers: { "Content-Type": "application/json", ...hdr(userID) } }),

  deleteProduct: (name, userID) =>
    api.del(`/products/${encodeURIComponent(name)}`, { headers: hdr(userID) }),

  adjustQuantity: (name, delta, userID) =>
    api.post(`/products/${encodeURIComponent(name)}/adjust`, { delta }, { headers: { "Content-Type": "application/json", ...hdr(userID) } }),

  useOne: (name, userID) =>
    api.post(`/products/${encodeURIComponent(name)}/use`, {}, { headers: hdr(userID) }),

  // categories
  listCategories: (userID) =>
    api.get(`/categories`, { headers: hdr(userID) }),

  createCategory: (categoryName, userID) =>
    api.post(`/categories`, { categoryName }, { headers: { "Content-Type": "application/json", ...hdr(userID) } }),

  deleteCategory: (categoryName, userID) =>
    api.del(`/categories/${encodeURIComponent(categoryName)}`, { headers: hdr(userID) }),
};
