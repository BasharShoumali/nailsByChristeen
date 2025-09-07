import { Link } from "react-router-dom";

export default function GuestLinks({ onLinkClick }) {
  return (
    <li>
      <Link to="/login" className="login-button" onClick={onLinkClick}>
        Log In
      </Link>
    </li>
  );
}
