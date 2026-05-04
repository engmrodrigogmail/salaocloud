import { useEffect, useState, useCallback, useRef } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useParams } from "react-router-dom";

const TOUR_COMPLETED_KEY = "interno_tour_completed";
const TOUR_VERSION = "1.1";

interface UseInternoTourOptions {
  autoStart?: boolean;
  onComplete?: () => void;
}

export function useInternoTour(options: UseInternoTourOptions = {}) {
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
          title: "🏪 Bem-vindo à Área Interna!",
          description: "Esta é a tela que fica aberta no balcão do salão. Focada em agilidade para o dia a dia.",
          side: "over",
          align: "center",
        },
      },
      {
        element: 'nav a[href*="/agenda"]',
        popover: {
          title: "📅 Agenda do Dia",
          description: "Acompanhe quem está chegando. Inicie os atendimentos direto por aqui.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/comandas"]',
        popover: {
          title: "📋 Comandas & Caixa",
          description: "Abra comandas, adicione serviços/produtos e feche o pagamento. Tudo vai direto para o novo Módulo Financeiro!",
          side: "right",
          align: "start",
        },
      },
      {
        element: "#portal-admin-button",
        popover: {
          title: "⚙️ Voltar ao Portal",
          description: "Precisa configurar algo ou ver relatórios gerenciais? Volte para o Portal Admin por aqui.",
          side: "bottom",
          align: "end",
        },
      },
      {
        popover: {
          title: "✅ Mão na massa!",
          description: "Agora é com você. Excelente dia de trabalho!",
          side: "over",
          align: "center",
        },
      },
    ];
  }, [slug]);

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
      const timer = setTimeout(() => {
        startTour();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [slug]);

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
