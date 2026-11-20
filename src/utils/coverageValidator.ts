import { CoverageStatus } from '../types';

interface ValidationResult {
  coverageStatus: CoverageStatus;
  province?: string;
  reason?: string;
}

export function validateGeographicalCoverage(lat: number, lng: number): ValidationResult {
  // Costa Rica general bounding box check
  if (lat < 8.0 || lat > 11.3 || lng < -86.0 || lng > -82.3) {
    return {
      coverageStatus: 'out_of_coverage',
      province: 'Fuera de Costa Rica',
      reason: 'La ubicación se encuentra fuera del territorio nacional de Costa Rica.'
    };
  }

  // 1. San José Province Bounding Box (GAM & surrounding San Jose territory)
  // Approx: lat 9.35 to 10.15, lng -84.55 to -83.45
  const isSanJose =
    lat >= 9.35 &&
    lat <= 10.15 &&
    lng >= -84.55 &&
    lng <= -83.45;

  // 2. Heredia Province Bounding Box
  // Approx: lat 9.95 to 10.60, lng -84.25 to -83.80
  const isHeredia =
    lat >= 9.92 &&
    lat <= 10.60 &&
    lng >= -84.25 &&
    lng <= -83.80;

  // 3. Cartago Province Bounding Box
  // Approx: lat 9.55 to 10.05, lng -84.05 to -83.50
  const isCartago =
    lat >= 9.55 &&
    lat <= 10.05 &&
    lng >= -84.05 &&
    lng <= -83.50;

  if (isSanJose) {
    return {
      coverageStatus: 'in_coverage',
      province: 'San José'
    };
  }

  if (isHeredia) {
    return {
      coverageStatus: 'in_coverage',
      province: 'Heredia'
    };
  }

  if (isCartago) {
    return {
      coverageStatus: 'in_coverage',
      province: 'Cartago'
    };
  }

  // If inside Costa Rica but outside San Jose, Heredia, Cartago (e.g. Alajuela, Puntarenas, Guanacaste, Limón)
  return {
    coverageStatus: 'out_of_coverage',
    province: 'Fuera de zona autorizada',
    reason: 'Solo se permiten entregas en las provincias de San José, Heredia y Cartago.'
  };
}
