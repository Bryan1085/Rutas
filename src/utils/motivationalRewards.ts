export type MilestoneTier = 25 | 50 | 75 | 100;

export const MILESTONE_TIERS: MilestoneTier[] = [25, 50, 75, 100];

export interface MilestoneCopy {
  tier: MilestoneTier;
  title: string;
  message: string;
}

const MILESTONE_MESSAGES: Record<MilestoneTier, { title: string; messages: string[] }> = {
  25: {
    title: '¡25% completado!',
    messages: [
      '¡Excelente arranque! Ya llevas un cuarto de la ruta, ¡vas con todo!',
      '¡Primer 25% listo! Gran comienzo de jornada, seguí con esa energía.',
      '¡Arrancaste con el pie derecho! Primer cuarto entregado sin parar.',
    ],
  },
  50: {
    title: '¡50% — Mitad de ruta!',
    messages: [
      '¡Mitad del camino alcanzada! Llevas un ritmo imparable hoy.',
      '¡50% entregado! Ya pasaste la mitad, cada entrega cuenta.',
      '¡Qué buen paso llevas! La mitad de tus paquetes ya están entregados.',
    ],
  },
  75: {
    title: '¡75% — Recta final!',
    messages: [
      '¡Ya falta muy poco! Completaste el 75%, el cierre de ruta es tuyo.',
      '¡Tres cuartos listos! Estás a nada de lograr el 100% de hoy.',
      '¡Imparable! 75% entregado, ya casi terminas tu día con éxito.',
    ],
  },
  100: {
    title: '¡100% — Ruta completada!',
    messages: [
      '¡Misión cumplida! Entregaste el 100% de los paquetes. ¡Sos un crack!',
      '¡Todo entregado al 100%! Excelente trabajo hoy, te luciste en la ruta.',
      '¡Meta alcanzada al 100%! Cerraste todas las entregas como un profesional.',
    ],
  },
};

export function getMilestoneCelebrationCopy(tier: MilestoneTier, seed = 0): MilestoneCopy {
  const entry = MILESTONE_MESSAGES[tier];
  const index = Math.abs(seed) % entry.messages.length;
  return {
    tier,
    title: entry.title,
    message: entry.messages[index],
  };
}

export function buildMilestoneSpeechText(tier: MilestoneTier, message: string): string {
  switch (tier) {
    case 25:
      return `¡Felicidades! ¡Llegaste al 25 por ciento de tu meta! ${message}`;
    case 50:
      return `¡Excelente! ¡Ya pasaste el 50 por ciento, mitad de recorrido! ${message}`;
    case 75:
      return `¡Vamos con todo! ¡75 por ciento completado, estás en la recta final! ${message}`;
    case 100:
      return `¡Bravo, misión cumplida! ¡Completaste el 100 por ciento de tu recorrido! ${message}`;
  }
}

export function getInlineMotivationalStatus(percentage: number, total: number, delivered: number): string {
  if (total === 0) {
    return 'Agrega tus paquetes para empezar a sumar progreso hoy.';
  }
  if (delivered === 0) {
    return '¡Buen día de ruta! Cada entrega te acerca al primer 25%.';
  }
  if (percentage < 25) {
    return '¡Buen inicio! Ya arrancaste, seguí sumando hacia el 25%.';
  }
  if (percentage < 50) {
    return '¡Primer 25% superado! Mantén ese ritmo hacia la mitad de ruta.';
  }
  if (percentage < 75) {
    return '¡Ya pasaste la mitad! Vas con excelente impulso hacia el 75%.';
  }
  if (percentage < 100) {
    return '¡Recta final! Ya pasaste el 75%, queda muy poco para el 100%.';
  }
  return '¡Ruta completada al 100%! Todos los paquetes entregados con éxito.';
}
