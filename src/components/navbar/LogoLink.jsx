import { Link } from "react-router-dom";

export default function LogoLink({ to, src, alt, onClick }) {
  return (
    <Link to={to} aria-label="Go home" onClick={onClick}>
      <img src={src} alt={alt} className="navbar-logo" />
    </Link>
  );
}
