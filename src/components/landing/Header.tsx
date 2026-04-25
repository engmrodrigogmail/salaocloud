import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-salaocloud-dark.png";

const navLinks = [
  { href: "#inicio", label: "Início" },
  { href: "#funcionalidades", label: "Recursos" },
  { href: "#planos", label: "Preços" },
  { href: "#suporte", label: "Suporte" },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-[hsl(0_0%_4%)]/95 backdrop-blur-md py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-6 lg:px-10 flex items-center justify-between">
        {/* Left nav */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.slice(0, 3).map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                i === 0
                  ? "text-[hsl(35_55%_55%)] font-semibold"
                  : "text-[hsl(35_20%_88%)] hover:text-[hsl(35_55%_55%)]"
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Center logo */}
        <Link to="/" className="flex items-center justify-center absolute left-1/2 -translate-x-1/2">
          <img
            src={logo}
            alt="Salão Cloud"
            className="h-12 md:h-14 w-auto drop-shadow-lg"
          />
        </Link>

        {/* Right nav + CTA */}
        <div className="hidden md:flex items-center gap-5">
          <a href="#suporte" className="text-sm text-[hsl(35_20%_88%)] hover:text-[hsl(35_55%_55%)] transition-colors">
            Suporte
          </a>
          <Button
            className="bg-[hsl(0_0%_92%)] hover:bg-white text-[hsl(0_0%_8%)] font-medium text-xs uppercase tracking-wider rounded-md h-9 px-4"
            asChild
          >
            <Link to="/auth">Já Tenho Cadastro</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 text-[hsl(35_20%_92%)] ml-auto"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[hsl(0_0%_4%)] border-b border-[hsl(0_0%_15%)] p-4 animate-fade-in">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[hsl(35_20%_88%)] hover:text-[hsl(35_55%_55%)] transition-colors py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-4 border-t border-[hsl(0_0%_15%)]">
              <Button variant="outline" className="border-[hsl(35_20%_88%)] text-[hsl(35_20%_92%)] bg-transparent" asChild>
                <Link to="/auth">Já tenho cadastro</Link>
              </Button>
              <Button className="bg-[hsl(35_55%_45%)] hover:bg-[hsl(35_55%_50%)] text-[hsl(0_0%_8%)] font-semibold" asChild>
                <Link to="/auth?mode=signup">Começar Grátis</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
