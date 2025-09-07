export default function MenuToggle({ open, onToggle }) {
  return (
    <button
      className={`menu-toggle ${open ? "is-open" : ""}`}
      onClick={onToggle}
      aria-label="Toggle menu"
      aria-expanded={open}
      aria-controls="navbar-links"
    >
      <span />
      <span />
      <span />
    </button>
  );
}
