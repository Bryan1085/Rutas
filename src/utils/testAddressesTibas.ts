import { DeliveryItem } from '../types';
import { validateGeographicalCoverage } from './coverageValidator';

export interface TibasTestStopSeed {
  recipientName: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  notes: string;
}

// 20 stops across Tibás (San Juan, Cinco Esquinas, Llorente, Colima, León XIII),
// intentionally shuffled in entry order so the circuit optimizer visibly forms an out-and-back loop.
export const TIBAS_TEST_STOPS: TibasTestStopSeed[] = [
  {
    recipientName: 'Carlos Valverde',
    phone: '8812-3401',
    address: 'Cinco Esquinas de Tibás, 100m norte de la bomba Uno',
    lat: 9.9512,
    lng: -84.0815,
    notes: 'Casa esquinera portón gris',
  },
  {
    recipientName: 'Sofía Mora',
    phone: '8723-4502',
    address: 'La Florida Norte, Tibás, 150m noreste del Estadio Saprissa',
    lat: 9.9685,
    lng: -84.0736,
    notes: 'Entregar en recepción',
  },
  {
    recipientName: 'Andrés Jiménez',
    phone: '8634-5603',
    address: 'León XIII, Tibás, contiguo al Ebais principal',
    lat: 9.9578,
    lng: -84.0942,
    notes: 'Llamar al llegar',
  },
  {
    recipientName: 'Mariela Solís',
    phone: '8545-6704',
    address: 'Anselmo Llorente, Tibás, 200m este de Jardines de Tibás',
    lat: 9.9609,
    lng: -84.0668,
    notes: 'Apartamento #2',
  },
  {
    recipientName: 'Diego Rojas',
    phone: '8856-7805',
    address: 'Copey de Cinco Esquinas, Tibás, frente a pulpería La Amistad',
    lat: 9.9489,
    lng: -84.0853,
    notes: 'Portón negro con rejas',
  },
  {
    recipientName: 'Valeria Quesada',
    phone: '8967-8906',
    address: 'San Gabriel de Tibás, 100m oeste del parque infantil',
    lat: 9.9678,
    lng: -84.0855,
    notes: 'Casa dos pisos blanca',
  },
  {
    recipientName: 'Esteban Chaves',
    phone: '8378-9007',
    address: 'Bajo Piuses, Llorente de Tibás, 75m sur de la plaza',
    lat: 9.9574,
    lng: -84.0638,
    notes: 'Dejar con guarda',
  },
  {
    recipientName: 'Laura Herrera',
    phone: '8489-0108',
    address: 'San Juan de Tibás, 50m norte del Parque Central',
    lat: 9.9614,
    lng: -84.0793,
    notes: 'Local comercial esquina',
  },
  {
    recipientName: 'Kevin Vargas',
    phone: '8690-1209',
    address: 'Colima de Tibás, 150m sur de EPA Colima',
    lat: 9.9562,
    lng: -84.0882,
    notes: 'Bodega #5',
  },
  {
    recipientName: 'Natalia Arias',
    phone: '8701-2310',
    address: 'Barrio El Roble, Cinco Esquinas de Tibás, 100m este del súper',
    lat: 9.9504,
    lng: -84.0762,
    notes: 'Casa verde al fondo',
  },
  {
    recipientName: 'Randall Castro',
    phone: '8812-3411',
    address: 'Cuatro Reinas de Tibás, frente a la escuela Miguel Obregón',
    lat: 9.9648,
    lng: -84.0878,
    notes: 'Tocar timbre superior',
  },
  {
    recipientName: 'Camila Fallas',
    phone: '8523-4512',
    address: 'Urbanización González Truque, Tibás, 200m oeste de la iglesia',
    lat: 9.9634,
    lng: -84.0709,
    notes: 'Casa muro beige',
  },
  {
    recipientName: 'José Pablo Méndez',
    phone: '8434-5613',
    address: 'Barrio El Carmen, Tibás, 100m sur de Clínica Clorito Picado',
    lat: 9.9547,
    lng: -84.0816,
    notes: 'Consultorio 3B',
  },
  {
    recipientName: 'Paola Ramírez',
    phone: '8345-6714',
    address: 'Barrio Los Ángeles, Llorente de Tibás, frente a residencial Miraflores',
    lat: 9.9642,
    lng: -84.0645,
    notes: 'Caseta de seguridad',
  },
  {
    recipientName: 'Daniela Alpízar',
    phone: '8956-7815',
    address: 'Santa Mónica de Tibás, 125m norte de la escuela Esmeralda Oreamuno',
    lat: 9.9672,
    lng: -84.0798,
    notes: 'Portón café',
  },
  {
    recipientName: 'Fabián Cordero',
    phone: '8667-8916',
    address: 'San Jerónimo, Llorente de Tibás, 150m suroeste de Plaza Tibás',
    lat: 9.9539,
    lng: -84.0705,
    notes: 'Entregar en oficina',
  },
  {
    recipientName: 'Gabriela Núñez',
    phone: '8778-9017',
    address: 'Sector Walmart Tibás, 100m oeste sobre Ruta 5',
    lat: 9.9624,
    lng: -84.0826,
    notes: 'Condominio Torre Norte',
  },
  {
    recipientName: 'Luis Fernando Arce',
    phone: '8889-0118',
    address: 'Barrio Jesús Jiménez, Tibás, 75m norte del Liceo Mauro Fernández',
    lat: 9.9589,
    lng: -84.0769,
    notes: 'Taller eléctrico',
  },
  {
    recipientName: 'Rebeca Chacón',
    phone: '8590-1219',
    address: 'Estadio Ricardo Saprissa, San Juan de Tibás, costado sur',
    lat: 9.9656,
    lng: -84.0754,
    notes: 'Soda esquina',
  },
  {
    recipientName: 'Óscar Brenes',
    phone: '8401-2320',
    address: 'Llorente de Tibás, contiguo a EPA Ruta 32',
    lat: 9.9577,
    lng: -84.0725,
    notes: 'Recepción bodega',
  },
];

export function buildTibasTestPackages(existingItems: DeliveryItem[]): DeliveryItem[] {
  const startNum = existingItems.reduce((max, item) => Math.max(max, item.originalNumber), 0) + 1;
  const baseOrder = existingItems.length;
  const timestamp = Date.now();

  return TIBAS_TEST_STOPS.map((seed, idx) => {
    const coverage = validateGeographicalCoverage(seed.lat, seed.lng);
    return {
      id: `test-tibas-${timestamp}-${idx}`,
      originalNumber: startNum + idx,
      address: seed.address,
      lat: seed.lat,
      lng: seed.lng,
      hasLocation: true,
      status: 'in_transit',
      coverageStatus: coverage.coverageStatus,
      province: coverage.province || 'San José',
      recipientName: seed.recipientName,
      phone: seed.phone,
      orderIndex: baseOrder + idx,
      notes: seed.notes,
    };
  });
}
