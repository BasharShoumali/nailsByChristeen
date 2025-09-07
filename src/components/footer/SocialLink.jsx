export default function SocialLink({ href, icon, label, external = false }) {
  const props = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <a className="footer-link" href={href} {...props}>
      <span className="footer-link-icon">{icon}</span>
      <span className="footer-link-text">{label}</span>
    </a>
  );
}
