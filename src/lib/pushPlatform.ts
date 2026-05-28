export function getPushPlatform() {
  if (typeof window === "undefined") {
    return { isIOS: false, isStandalone: false };
  }

  const nav = window.navigator as Navigator & { standalone?: boolean };
  const ua = nav.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    nav.standalone === true;

  return { isIOS, isStandalone };
}

export function getIOSInstallPushInstruction() {
  return "No iPhone, push só funciona abrindo pelo ícone instalado na Tela de Início. No Safari, toque em Compartilhar → Adicionar à Tela de Início; depois abra pelo ícone SalãoCloud/Hair Company e toque em Ativar. O cadeado do Safari não libera push.";
}

export function getIOSSettingsPushInstruction() {
  return "No iPhone, as notificações deste app estão bloqueadas no iOS. Abra Ajustes → Notificações → SalãoCloud/Hair Company → Permitir Notificações; marque Tela Bloqueada, Central de Notificações e Faixas. Depois volte pelo ícone instalado e toque em Ativar.";
}

export function getPushFailureInstruction() {
  const platform = getPushPlatform();
  if (platform.isIOS && !platform.isStandalone) return getIOSInstallPushInstruction();
  if (platform.isIOS) return getIOSSettingsPushInstruction();
  return "Não foi possível ativar. Verifique se as notificações deste site estão liberadas nas permissões do navegador.";
}

export function getPushBlockedInstruction() {
  const platform = getPushPlatform();
  if (platform.isIOS) return getIOSSettingsPushInstruction();
  return "Abra as configurações/permissões do site no navegador e libere Notificações.";
}