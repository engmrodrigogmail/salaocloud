import { useEffect, useState, useCallback, useRef } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useParams } from "react-router-dom";

const TOUR_COMPLETED_KEY = "portal_tour_completed";
const TOUR_VERSION = "1.0"; // Increment to show tour again after updates

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
          description: "Vamos fazer um tour rápido pelas principais funcionalidades. Você pode pular a qualquer momento clicando no X.",
          side: "over",
          align: "center",
        },
      },
      {
        element: 'nav a[href*="/agenda"]',
        popover: {
          title: "📅 Agenda",
          description: "Aqui você visualiza e gerencia todos os agendamentos. Pode confirmar, cancelar ou reagendar atendimentos.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/profissionais"]',
        popover: {
          title: "👥 Profissionais",
          description: "Cadastre os profissionais da sua equipe. Cada um terá sua própria agenda e comissões configuráveis.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/servicos"]',
        popover: {
          title: "✂️ Serviços",
          description: "Adicione os serviços que você oferece, com preços, duração e quais profissionais executam cada um.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/clientes"]',
        popover: {
          title: "👤 Clientes",
          description: "Visualize a base de clientes, histórico de agendamentos e informações de contato.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/comissoes"]',
        popover: {
          title: "💰 Comissões",
          description: "Configure as regras de comissionamento para cada profissional e serviço. Acompanhe os ganhos em tempo real.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/fidelidade"]',
        popover: {
          title: "⭐ Fidelidade",
          description: "Crie programas de fidelidade para recompensar seus clientes mais assíduos.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/configuracoes"]',
        popover: {
          title: "⚙️ Configurações",
          description: "Configure horários de funcionamento, dados do estabelecimento e preferências gerais.",
          side: "right",
          align: "start",
        },
      },
      {
        element: "#internal-area-button",
        popover: {
          title: "🏪 Área Interna",
          description: "Acesse o painel de operações do dia a dia: comandas, fechamento de caixa e atendimentos presenciais.",
          side: "bottom",
          align: "end",
        },
      },
      {
        element: "#tour-help-button",
        popover: {
          title: "❓ Ajuda",
          description: "Clique aqui a qualquer momento para refazer este tour guiado.",
          side: "bottom",
          align: "end",
        },
      },
      {
        popover: {
          title: "🚀 Pronto para começar!",
          description: "Você completou o tour! Recomendamos começar cadastrando seus serviços e profissionais. Bom trabalho!",
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
