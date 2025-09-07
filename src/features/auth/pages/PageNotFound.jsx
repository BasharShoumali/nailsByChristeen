import { Link, useNavigate, useLocation } from "react-router-dom";
import "../../../cssFiles/PageNotFound.css";

export default function PageNotFound() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <main className="error-container" role="main" aria-labelledby="pnf-title">
      <div className="error-content">
        <h1 id="pnf-title">404</h1>
        <p>Oops! The page you're looking for doesn't exist.</p>
        <p className="error-path">
          Missing route: <code>{pathname}</code>
        </p>
        <div className="error-actions">
          <button type="button" className="home-link" onClick={() => navigate(-1)}>
            ⟵ Go back
          </button>
          <Link to="/" className="home-link">
            Go to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
