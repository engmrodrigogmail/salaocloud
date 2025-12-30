import { useEffect, useState, useCallback, useRef } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useParams } from "react-router-dom";

const TOUR_COMPLETED_KEY = "interno_tour_completed";
const TOUR_VERSION = "1.0";

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
          description: "Esta é a área de operações do dia a dia. Aqui você gerencia atendimentos presenciais e comandas. Vamos conhecer!",
          side: "over",
          align: "center",
        },
      },
      {
        element: 'nav a[href*="/interno"][href$="' + slug + '"]',
        popover: {
          title: "📊 Painel",
          description: "Visão geral do dia: agendamentos pendentes, confirmados, concluídos e comandas abertas. Acesso rápido às principais funções.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/agenda"]',
        popover: {
          title: "📅 Agenda do Dia",
          description: "Visualize os agendamentos de hoje. Confirme chegadas, inicie atendimentos e acompanhe o fluxo de clientes.",
          side: "right",
          align: "start",
        },
      },
      {
        element: 'nav a[href*="/comandas"]',
        popover: {
          title: "📋 Comandas",
          description: "Gerencie comandas abertas: adicione serviços, produtos, aplique descontos e finalize pagamentos com múltiplas formas.",
          side: "right",
          align: "start",
        },
      },
      {
        element: "#portal-admin-button",
        popover: {
          title: "⚙️ Portal Admin",
          description: "Acesse o portal administrativo para configurar serviços, profissionais, comissões e configurações gerais.",
          side: "bottom",
          align: "end",
        },
      },
      {
        element: "#interno-tour-help-button",
        popover: {
          title: "❓ Ajuda",
          description: "Clique aqui a qualquer momento para refazer este tour.",
          side: "bottom",
          align: "end",
        },
      },
      {
        popover: {
          title: "✅ Pronto para operar!",
          description: "Agora você conhece a área interna. Use as comandas para registrar consumos e fechar pagamentos. Bom trabalho!",
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
