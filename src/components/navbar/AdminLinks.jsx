import { Link } from "react-router-dom";

export default function AdminLinks({ onLinkClick }) {
  return (
    <>
      <li><Link to="/admin/schedule" onClick={onLinkClick}>Schedule</Link></li>
      <li><Link to="/admin/appointments" onClick={onLinkClick}>Appointments</Link></li>
      <li><Link to="/admin/reports" onClick={onLinkClick}>Reports</Link></li>
      <li><Link to="/admin/users" onClick={onLinkClick}>Users</Link></li>
      <li><Link to="/admin/storage" onClick={onLinkClick}>Storage</Link></li>
    </>
  );
}
