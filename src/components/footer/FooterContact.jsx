import { FaInstagram, FaWhatsapp, FaEnvelope, FaPhoneAlt } from "react-icons/fa";
import SocialLink from "./SocialLink";

export default function FooterContact({ phone, instagram, whatsapp, email }) {
  return (
    <section className="footer-section contact">
      <h3>Contact</h3>
      <SocialLink href={`tel:${phone}`} icon={<FaPhoneAlt />} label="Call Me" />
      <SocialLink href={instagram} icon={<FaInstagram />} label="Instagram" external />
      <SocialLink href={whatsapp} icon={<FaWhatsapp />} label="WhatsApp" external />
      <SocialLink href={`mailto:${email}`} icon={<FaEnvelope />} label="Email" />
    </section>
  );
}
