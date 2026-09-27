import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="scaffold-note">
      <span className="phase-badge">404</span>
      <h1>Lost in the vault</h1>
      <p>The page you are looking for does not exist.</p>
      <p style={{ marginTop: 24 }}>
        <Link to="/" className="btn btn-primary">Back to MovieVault</Link>
      </p>
    </div>
  );
}
