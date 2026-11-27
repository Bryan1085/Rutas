export type DeliveryStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';
export type CoverageStatus = 'in_coverage' | 'out_of_coverage' | 'incomplete' | 'pending_validation';

export interface DeliveryItem {
  id: string;
  originalNumber: number; // e.g. 3, 8, 12, 25, etc.
  address: string;
  lat: number;
  lng: number;
  hasLocation?: boolean;
  status: DeliveryStatus;
  coverageStatus: CoverageStatus;
  province?: string;
  recipientName?: string;
  phone?: string;
  notes?: string;
  orderIndex: number; // Visit sequence index (0, 1, 2...)
  distanceFromPrevKm?: number;
  estimatedMinutes?: number;
  failureReason?: string;
  deliveryPhoto?: string;
  deliveryPhotoAt?: string;
}

export interface RouteSession {
  id: string;
  name: string;
  date: string;
  items: DeliveryItem[];
  status: 'active' | 'paused' | 'completed' | 'saved';
  totalDistanceKm: number;
  totalMinutes: number;
  createdAt: number;
}

export interface GpsPosition {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface DriverProfile {
  id: string;
  driverName: string;
  active: boolean;
  createdAtMs?: number;
}

