import { useEffect, useState, useCallback, useRef } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useParams } from "react-router-dom";

const TOUR_COMPLETED_KEY = "portal_tour_completed";
const TOUR_VERSION = "1.2"; // Increment to show tour again after updates

interface UsePortalTourOptions {
  autoStart?: boolean;
  onComplete?: () => void;
}

export function usePortalTour(options: UsePortalTourOptions = {}) {
  const { autoStart = true, onComplete } = options;
  const { slug } = useParams<{ slug: string }>();
  const driverRef = useRef<Driver | null>(null);
  const [isTourActive, setIsTourActive] = useState(false);
  const hasAutoStarted = useRef(false);

  const getTourKey = () => `${TOUR_COMPLETED_KEY}_${slug}_v${TOUR_VERSION}`;

  const isTourCompleted = useCallback(() => {
    return localStorage.getItem(getTourKey()) === "true";
  }, [slug]);

  const markTourCompleted = useCallback(() => {
    localStorage.setItem(getTourKey(), "true");
  }, [slug]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(getTourKey());
  }, [slug]);

  const createTourSteps = useCallback((): DriveStep[] => {
    return [
      {
        popover: {
          title: "🎉 Bem-vindo ao seu Portal!",
          description: "Vamos fazer um tour rápido pelas novas funcionalidades do SalãoCloud. Você pode pular a qualquer momento clicando no X.",
          side: "over",
          align: "center",
        },
      },
      {
        element: 'nav a[href*="/agenda"]',
        popover: {
          title: "📅 Agenda",
          description: "Gerencie todos os agendamentos. Confirme, cancele ou reagende atendimentos com facilidade.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/profissionais"]',
        popover: {
          title: "👥 Profissionais & Serviços",
          description: "Cadastre sua equipe, defina os serviços que cada um faz e os horários de trabalho.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/financeiro"]',
        popover: {
          title: "📈 Módulo Financeiro",
          description: "NOVO! Controle total do seu caixa. Comandas e comissões caem aqui automaticamente. Registre despesas e receitas avulsas.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/vitrine"]',
        popover: {
          title: "📸 Vitrine de Serviços",
          description: "Crie um portfólio com fotos dos seus melhores trabalhos para atrair mais clientes na sua página de agendamento.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/promocoes"]',
        popover: {
          title: "🎁 Marketing & Retenção",
          description: "Crie promoções, cupons de desconto e programas de fidelidade para fazer seus clientes voltarem mais vezes.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/edu"]',
        popover: {
          title: "✨ Consultor Edu (IA)",
          description: "Exclusividade! Nossa IA analisa fotos do cabelo das clientes e sugere os melhores tratamentos. Aumente seu ticket médio!",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/assistente-ia"]',
        popover: {
          title: "🤖 Recepcionista Virtual",
          description: "A Silvia atende seus clientes 24h por dia no portal, tira dúvidas e faz agendamentos automáticos.",
          side: "right",
          align: "start",
        },
      },
      {
        element: "#internal-area-button",
        popover: {
          title: "🏪 Área Interna",
          description: "Na hora do batente, clique aqui para acessar as Comandas e o fluxo de caixa do dia a dia.",
          side: "bottom",
          align: "end",
        },
      },
      {
        popover: {
          title: "🚀 Pronto para voar!",
          description: "Você completou o tour! Explore os novos módulos e impulsione seu salão. Bom trabalho!",
          side: "over",
          align: "center",
        },
      },
    ];
  }, []);

  const startTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
    }

    const newDriver = driver({
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      steps: createTourSteps(),
      nextBtnText: "Próximo",
      prevBtnText: "Anterior",
      doneBtnText: "Concluir",
      progressText: "{{current}} de {{total}}",
      popoverClass: "portal-tour-popover",
      onDestroyed: () => {
        setIsTourActive(false);
        markTourCompleted();
        onComplete?.();
      },
      onCloseClick: () => {
        newDriver.destroy();
      },
    });

    driverRef.current = newDriver;
    setIsTourActive(true);
    newDriver.drive();
  }, [createTourSteps, markTourCompleted, onComplete]);

  // Auto-start tour for new users (only once per mount)
  useEffect(() => {
    if (autoStart && !isTourCompleted() && slug && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      // Delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startTour();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [slug]); // Only depend on slug to prevent loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  return {
    startTour,
    resetTour,
    isTourActive,
    isTourCompleted: isTourCompleted(),
  };
}
