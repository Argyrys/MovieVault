export default function ScaffoldPage({ title, phase, note }) {
  return (
    <div className="scaffold-note">
      <span className="phase-badge">Phase {phase} of 8</span>
      <h1>{title}</h1>
      <p>{note}</p>
    </div>
  );
}
