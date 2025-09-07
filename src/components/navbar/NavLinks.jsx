import AdminLinks from "./AdminLinks";
import UserLinks from "./UserLinks";
import GuestLinks from "./GuestLinks";

export default function NavLinks({ isLoggedIn, isAdmin, onAdminPage, menuOpen, onLinkClick }) {
  return (
    <ul id="navbar-links" className={`navbar-links ${menuOpen ? "open" : ""}`}>
      {isLoggedIn ? (
        onAdminPage && isAdmin ? (
          <AdminLinks onLinkClick={onLinkClick} />
        ) : (
          <UserLinks isAdmin={isAdmin} onLinkClick={onLinkClick} />
        )
      ) : (
        <GuestLinks onLinkClick={onLinkClick} />
      )}
    </ul>
  );
}
