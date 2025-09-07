import "../../cssFiles/ForgotPassword.css"; // reuse your form styles
import useCurrentUser from "./hooks/useCurrentUser";
import PhoneForm from "./components/PhoneForm";
import PasswordForm from "./components/PasswordForm";

export default function UpdateProfilePage() {
  const user = useCurrentUser();

  if (!user) {
    return (
      <div className="auth-wrap is-in">
        <div className="auth-card">
          <h1 className="auth-title">Update Profile</h1>
          <p className="auth-sub">Please log in to edit your information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap is-in">
      <div className="auth-card">
        <h1 className="auth-title">Update Profile</h1>
        <p className="auth-sub">
          Signed in as <b>{user.userName}</b> (ID: {user.userID})
        </p>

        <PhoneForm userID={user.userID} />

        <hr style={{ margin: "20px 0", border: 0, borderTop: "1px solid var(--ring)" }} />

        <PasswordForm userID={user.userID} />
      </div>
    </div>
  );
}
