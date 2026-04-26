import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-salaocloud-v5.png";

const navLinks = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#planos", label: "Planos" },
  { href: "#faq", label: "FAQ" },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-background ${
        isScrolled ? "shadow-sm py-2" : "py-3 border-b border-border/40"
      }`}
    >
      <div className="container mx-auto px-6 lg:px-10 flex items-center justify-between">
        {/* Left nav */}
        <nav className="hidden md:flex items-center gap-8 flex-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-foreground/80 hover:text-primary transition-colors tracking-wide"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Center logo */}
        <Link
          to="/"
          className="flex items-center justify-center md:absolute md:left-1/2 md:-translate-x-1/2"
        >
          <img
            src={logo}
            alt="Salão Cloud"
            className="h-12 md:h-14 w-auto"
          />
        </Link>

        {/* Right CTAs */}
        <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
          <Button
            variant="outline"
            className="border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground bg-transparent text-xs uppercase tracking-premium h-9 px-4 rounded-sm font-medium"
            asChild
          >
            <Link to="/auth">Já tenho cadastro</Link>
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs uppercase tracking-premium h-9 px-5 rounded-sm font-medium"
            asChild
          >
            <Link to="/auth?mode=signup">Começar</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border p-4 animate-fade-in">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              <Button
                variant="outline"
                className="border-primary/40 text-primary bg-transparent rounded-sm uppercase tracking-premium text-xs"
                asChild
              >
                <Link to="/auth">Já tenho cadastro</Link>
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm uppercase tracking-premium text-xs"
                asChild
              >
                <Link to="/auth?mode=signup">Começar</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
