// App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./features/homePage/HomePage";
import Navbar from "./components/navbar/NavBar";
import Footer from "./components/footer/Footer";
import MyOrders from "./features/MyOrders/MyOrders";

 
//=====================new
import AppointmentsPage from "./features/adminsAppointments/pages/AppointmentsPage";
import ReportsPage from "./features/reports/pages/ReportsPage";
import SchedulePage from "./features/schedule/pages/SchedulePage";
import StoragePage from "./features/storage/pages/StoragePage";
import AdminUsersPage from "./features/adminUsers/pages/AdminUsersPage";
import ForgotPasswordPage from "./features/auth/pages/ForgotPasswordPage";
import LogIn from "./features/auth/pages/LoginPage";
import PageNotFound from "./features/auth/pages/PageNotFound";
import SignUp from "./features/auth/pages/SignupPage";
import UpdateProfilePage from './features/account/UpdateProfilePage';

// helpers
function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("loggedUser") || "null");
  } catch {
    return null;
  }
}
const isLoggedIn = () => !!getStoredUser()?.userID;
const hasRole = (r) => getStoredUser()?.role === r;

// route guards
function RequireAuth({ children }) {
  return isLoggedIn() ? children : <Navigate to="/login" replace />;
}
function RequireRole({ role, children }) {
  return hasRole(role) ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar />
        <main className="page-content">
          <Routes>
            {/* PUBLIC home — no redirect, no guard */}
            <Route path="/" element={<HomePage />} />

            {/* Auth pages */}
            <Route path="/login" element={<LogIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot" element={<ForgotPasswordPage />} />

            {/* User-only */}
            <Route
              path="/myorders"
              element={
                <RequireAuth>
                  <MyOrders />
                </RequireAuth>
              }
            />

            {/* User-only */}
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <UpdateProfilePage  />
                </RequireAuth>
              }
            />

            {/* Admin-only */}
            <Route
              path="/admin/appointments"
              element={
                <RequireRole role="manager">
                  <AppointmentsPage  />
                </RequireRole>
              }
            />

            {/* Admin-only Reports */}
            <Route
              path="/admin/reports"
              element={
                <RequireRole role="manager">
                  <ReportsPage />
                </RequireRole>
              }
            />

             {/* Admin-only Users */}
            <Route
              path="/admin/users"
              element={
                <RequireRole role="manager">
                  <AdminUsersPage />
                </RequireRole>
              }
            />

             {/* Admin-only Storage */}
            <Route
              path="/admin/storage"
              element={
                <RequireRole role="manager">
                  <StoragePage />
                </RequireRole>
              }
            />

            {/* Admin-only Schedule */}
            <Route
              path="/admin/schedule"
              element={
                <RequireRole role="manager">
                  <SchedulePage />
                </RequireRole>
              }
            />

            {/* 404 */}
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
