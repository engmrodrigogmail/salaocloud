import { Link } from "react-router-dom";
import { Instagram, Facebook, Linkedin, Mail, Phone, MapPin } from "lucide-react";
import logo from "@/assets/logo.webp";

const footerLinks = {
  produto: [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Planos e Preços", href: "#planos" },
    { label: "FAQ", href: "#faq" },
  ],
  empresa: [
    { label: "Sobre Nós", href: "/sobre" },
    { label: "Blog", href: "/blog" },
    { label: "Contato", href: "/contato" },
  ],
  legal: [
    { label: "Termos de Uso", href: "/termos" },
    { label: "Política de Privacidade", href: "/privacidade" },
  ],
};

const socialLinks = [
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Facebook, href: "https://facebook.com", label: "Facebook" },
  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
];

export function Footer() {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <img src={logo} alt="Salão Cloud" className="h-10 w-auto mb-4 brightness-0 invert" />
            <p className="text-background/70 mb-6 max-w-sm">
              Menos preocupação. Mais clientes. O sistema completo para gestão de salões e barbearias.
            </p>
            <div className="space-y-3 text-sm text-background/70">
              <div className="flex items-center gap-3">
                <Mail size={16} />
                <span>contato@salaocloud.com.br</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} />
                <span>(11) 99999-9999</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={16} />
                <span>São Paulo, SP - Brasil</span>
              </div>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="font-display font-semibold mb-4">Produto</h4>
            <ul className="space-y-3">
              {footerLinks.produto.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-background/70 hover:text-background transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="font-display font-semibold mb-4">Empresa</h4>
            <ul className="space-y-3">
              {footerLinks.empresa.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-background/70 hover:text-background transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="font-display font-semibold mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-background/70 hover:text-background transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-background/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-background/50">
            © {new Date().getFullYear()} Salão Cloud. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-full bg-background/10 hover:bg-background/20 transition-colors"
                aria-label={social.label}
              >
                <social.icon size={18} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
