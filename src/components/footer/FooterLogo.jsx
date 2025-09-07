export default function FooterLogo({ src, alt }) {
  return (
    <section className="footer-section logo">
      <img src={src} alt={alt} className="footer-logo-img" />
    </section>
  );
}
