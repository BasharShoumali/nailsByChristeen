export default function UserBox({ userName, onLogout }) {
  return (
    <div className="user-box">
      <span className="navbar-username">Hi, {userName}</span>
      <button className="logout-btn" onClick={onLogout}>
        <span className="logout-icn" aria-hidden>↗</span>
        <span className="logout-label">Logout</span>
      </button>
    </div>
  );
}
