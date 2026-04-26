import { Link } from "react-router-dom";
import { Instagram, Facebook, Linkedin, Mail, MapPin, MessageCircle } from "lucide-react";
import logo from "@/assets/logo-salaocloud-v5.png";

const footerLinks = {
  produto: [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Planos", href: "#planos" },
    { label: "FAQ", href: "#faq" },
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
    <footer className="bg-secondary text-foreground py-16 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <img src={logo} alt="Salão Cloud" className="h-14 w-auto mb-4" />
            <p className="text-muted-foreground mb-6 max-w-sm text-sm leading-relaxed">
              Menos preocupação. Mais clientes. O sistema completo para gestão de salões e barbearias.
            </p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-primary" />
                <span>contato@salaocloud.com.br</span>
              </div>
              <a
                href="https://wa.me/5511947551416"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:text-primary transition-colors"
              >
                <MessageCircle size={16} className="text-primary" />
                <span>11 94755-1416</span>
              </a>
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-primary" />
                <span>São Paulo, SP - Brasil</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-premium text-foreground mb-5">
              Produto
            </h4>
            <ul className="space-y-3">
              {footerLinks.produto.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-premium text-foreground mb-5">
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            © {new Date().getFullYear()} Salão Cloud. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-sm border border-border flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                aria-label={social.label}
              >
                <social.icon size={16} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
