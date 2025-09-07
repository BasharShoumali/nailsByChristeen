export default function SectionTitle({ children, style }) {
  return (
    <h2 className="auth-sub" style={{ marginBottom: 8, ...(style || {}) }}>
      {children}
    </h2>
  );
}
