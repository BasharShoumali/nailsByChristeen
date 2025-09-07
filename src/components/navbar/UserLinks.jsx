import { Link } from "react-router-dom";

export default function UserLinks({ isAdmin, onLinkClick }) {
  return (
    <>
      <li><Link to="/" onClick={onLinkClick}>Home</Link></li>
      <li><Link to="/myorders" onClick={onLinkClick}>My Appointments</Link></li>
      <li><Link to="/account" onClick={onLinkClick}>Profile</Link></li>
      {isAdmin && (
        <li><Link to="/admin/appointments" onClick={onLinkClick}>Admin</Link></li>
      )}
    </>
  );
}
