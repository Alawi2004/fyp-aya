// src/data/mockData.js
// Shared mock data used as fallback when the backend API is unavailable

export const MOCK_DRIVERS = [
  { id: 1, name: 'Karim Moussa',    license: 'LB-20341', phone: '+961 3 112 233', trips: 12, rating: 4.9, status: 'Active' },
  { id: 2, name: 'Lara Abi Nader',  license: 'LB-19874', phone: '+961 3 445 566', trips: 9,  rating: 4.5, status: 'Active' },
  { id: 3, name: 'Joe Pharaon',     license: 'LB-21103', phone: '+961 3 778 899', trips: 7,  rating: 4.3, status: 'Active' },
  { id: 4, name: 'Maya Salameh',    license: 'LB-18560', phone: '+961 3 223 344', trips: 5,  rating: 4.7, status: 'Active' },
  { id: 5, name: 'Rami Khoury',     license: 'LB-22087', phone: '+961 3 556 677', trips: 8,  rating: 4.6, status: 'Active' },
  { id: 6, name: 'Sara Khoury',     license: 'LB-17432', phone: '+961 3 889 900', trips: 4,  rating: 4.2, status: 'Inactive' },
  { id: 7, name: 'Fadi Gemayel',    license: 'LB-23451', phone: '+961 3 334 455', trips: 11, rating: 4.8, status: 'Active' },
  { id: 8, name: 'Hassan Nasser',   license: 'LB-16789', phone: '+961 3 667 788', trips: 6,  rating: 4.4, status: 'Active' },
  { id: 9, name: 'Nadia Haddad',    license: 'LB-24562', phone: '+961 3 990 011', trips: 3,  rating: 4.1, status: 'Active' },
  { id: 10, name: 'Ziad Mansour',   license: 'LB-15123', phone: '+961 3 221 332', trips: 10, rating: 4.6, status: 'Active' },
];

export const MOCK_VEHICLES = [
  { id: 1,  plate: 'BUS-01', model: 'Mercedes Sprinter', year: 2021, capacity: 30, status: 'Active',      driver: 'Karim Moussa',   lastService: '2024-11-15', km: 84200 },
  { id: 2,  plate: 'BUS-02', model: 'Toyota Coaster',    year: 2020, capacity: 22, status: 'Active',      driver: 'Maya Salameh',   lastService: '2024-10-20', km: 102500 },
  { id: 3,  plate: 'BUS-03', model: 'Iveco Daily',       year: 2022, capacity: 18, status: 'Active',      driver: 'Hassan Nasser',  lastService: '2025-01-08', km: 43800 },
  { id: 4,  plate: 'BUS-04', model: 'Hyundai County',    year: 2019, capacity: 29, status: 'Maintenance', driver: '—',              lastService: '2024-08-01', km: 178000 },
  { id: 5,  plate: 'BUS-05', model: 'Mercedes Sprinter', year: 2021, capacity: 20, status: 'Active',      driver: 'Lara Abi Nader', lastService: '2024-12-10', km: 67300 },
  { id: 6,  plate: 'BUS-06', model: 'Mitsubishi Rosa',   year: 2018, capacity: 25, status: 'Inactive',    driver: '—',              lastService: '2024-06-14', km: 230400 },
  { id: 7,  plate: 'BUS-07', model: 'Toyota Coaster',    year: 2020, capacity: 40, status: 'Active',      driver: 'Sara Khoury',    lastService: '2025-01-22', km: 89600 },
  { id: 8,  plate: 'BUS-08', model: 'Iveco Daily',       year: 2023, capacity: 18, status: 'Maintenance', driver: '—',              lastService: '2024-09-05', km: 29100 },
  { id: 9,  plate: 'BUS-09', model: 'Hyundai County',    year: 2021, capacity: 40, status: 'Active',      driver: 'Joe Pharaon',    lastService: '2024-11-30', km: 55700 },
  { id: 10, plate: 'BUS-10', model: 'Mercedes Tourismo', year: 2022, capacity: 50, status: 'Inactive',    driver: '—',              lastService: '2024-07-18', km: 142000 },
  { id: 11, plate: 'BUS-11', model: 'Mercedes Sprinter', year: 2020, capacity: 30, status: 'Active',      driver: 'Rami Khoury',    lastService: '2025-02-01', km: 72400 },
  { id: 12, plate: 'BUS-12', model: 'Toyota Coaster',    year: 2021, capacity: 45, status: 'Active',      driver: 'Fadi Gemayel',   lastService: '2024-12-28', km: 61100 },
  { id: 13, plate: 'BUS-13', model: 'Iveco Daily',       year: 2019, capacity: 18, status: 'Inactive',    driver: '—',              lastService: '2024-05-09', km: 198700 },
];

export const MOCK_TRIPS = [
  { id: 'TRP-041',  route: 'Route 12A', driver: 'Karim Moussa',   vehicle: 'BUS-01', date: '2025-04-14', time: '08:00', seats: '24/30', status: 'Ongoing' },
  { id: 'TRP-038',  route: 'Route 7B',  driver: 'Lara Abi Nader', vehicle: 'BUS-05', date: '2025-04-14', time: '08:15', seats: '18/20', status: 'Delayed' },
  { id: 'TRP-029',  route: 'Route 3C',  driver: 'Joe Pharaon',    vehicle: 'BUS-09', date: '2025-04-14', time: '07:45', seats: '40/40', status: 'Ongoing' },
  { id: 'TRP-033',  route: 'Route 5D',  driver: 'Maya Salameh',   vehicle: 'BUS-02', date: '2025-04-14', time: '09:00', seats: '11/22', status: 'Scheduled' },
  { id: 'TRP-045',  route: 'Route 9E',  driver: 'Rami Khoury',    vehicle: 'BUS-11', date: '2025-04-14', time: '08:30', seats: '22/30', status: 'Ongoing' },
  { id: 'TRP-041B', route: 'Route 12A', driver: 'Hassan Nasser',  vehicle: 'BUS-03', date: '2025-04-14', time: '07:30', seats: '19/18', status: 'Ongoing' },
  { id: 'TRP-047',  route: 'Route 3C',  driver: 'Sara Khoury',    vehicle: 'BUS-07', date: '2025-04-14', time: '09:15', seats: '25/40', status: 'Delayed' },
  { id: 'TRP-050',  route: 'Route 7B',  driver: 'Fadi Gemayel',   vehicle: 'BUS-12', date: '2025-04-14', time: '08:45', seats: '30/45', status: 'Ongoing' },
  { id: 'TRP-022',  route: 'Route 5D',  driver: 'Nadia Haddad',   vehicle: 'BUS-07', date: '2025-04-14', time: '06:00', seats: '38/40', status: 'Completed' },
  { id: 'TRP-018',  route: 'Route 9E',  driver: 'Ziad Mansour',   vehicle: 'BUS-11', date: '2025-04-14', time: '06:30', seats: '28/30', status: 'Completed' },
  { id: 'TRP-015',  route: 'Route 12A', driver: 'Karim Moussa',   vehicle: 'BUS-01', date: '2025-04-14', time: '05:45', seats: '22/30', status: 'Completed' },
];

export const MOCK_USERS = [
  { id: 1,  name: 'Aline Haddad',     email: 'aline.h@example.com',     role: 'Passenger', joined: '2024-09-10', trips: 23, status: 'Active' },
  { id: 2,  name: 'Karim Moussa',     email: 'k.moussa@example.com',     role: 'Driver',    joined: '2023-01-15', trips: 312, status: 'Active' },
  { id: 3,  name: 'Rania Saad',       email: 'rania.saad@example.com',   role: 'Passenger', joined: '2024-11-02', trips: 8,  status: 'Active' },
  { id: 4,  name: 'Lara Abi Nader',   email: 'lara.an@example.com',      role: 'Driver',    joined: '2023-03-20', trips: 189, status: 'Active' },
  { id: 5,  name: 'Omar Khalil',      email: 'omar.k@example.com',       role: 'Passenger', joined: '2025-01-05', trips: 4,  status: 'Active' },
  { id: 6,  name: 'Maya Salameh',     email: 'maya.s@example.com',       role: 'Driver',    joined: '2023-06-11', trips: 97, status: 'Active' },
  { id: 7,  name: 'Joelle Karam',     email: 'joelle.k@example.com',     role: 'Passenger', joined: '2024-07-28', trips: 41, status: 'Active' },
  { id: 8,  name: 'Admin User',       email: 'admin@bustracker.lb',      role: 'Admin',     joined: '2022-12-01', trips: 0,  status: 'Active' },
  { id: 9,  name: 'Fadi Gemayel',     email: 'fadi.g@example.com',       role: 'Driver',    joined: '2023-08-14', trips: 228, status: 'Active' },
  { id: 10, name: 'Nour Bitar',       email: 'nour.b@example.com',       role: 'Passenger', joined: '2024-12-19', trips: 6,  status: 'Active' },
  { id: 11, name: 'Sara Khoury',      email: 'sara.k@example.com',       role: 'Driver',    joined: '2023-05-07', trips: 144, status: 'Inactive' },
  { id: 12, name: 'Tarek Mansour',    email: 'tarek.m@example.com',      role: 'Passenger', joined: '2024-04-14', trips: 17, status: 'Active' },
];

export const MOCK_TICKETS = [
  { id: 'TKT-001', passenger: 'Aline Haddad',   trip: 'TRP-041',  route: 'Route 12A', seat: '12A', date: '2025-04-14', time: '08:00', amount: '$2.50', status: 'Confirmed' },
  { id: 'TKT-002', passenger: 'Rania Saad',      trip: 'TRP-038',  route: 'Route 7B',  seat: '4B',  date: '2025-04-14', time: '08:15', amount: '$2.50', status: 'Confirmed' },
  { id: 'TKT-003', passenger: 'Omar Khalil',     trip: 'TRP-029',  route: 'Route 3C',  seat: '7C',  date: '2025-04-14', time: '07:45', amount: '$3.00', status: 'Confirmed' },
  { id: 'TKT-004', passenger: 'Joelle Karam',    trip: 'TRP-041',  route: 'Route 12A', seat: '15A', date: '2025-04-14', time: '08:00', amount: '$2.50', status: 'Confirmed' },
  { id: 'TKT-005', passenger: 'Nour Bitar',      trip: 'TRP-045',  route: 'Route 9E',  seat: '2D',  date: '2025-04-14', time: '08:30', amount: '$3.50', status: 'Confirmed' },
  { id: 'TKT-006', passenger: 'Tarek Mansour',   trip: 'TRP-050',  route: 'Route 7B',  seat: '8B',  date: '2025-04-14', time: '08:45', amount: '$2.50', status: 'Confirmed' },
  { id: 'TKT-007', passenger: 'Aline Haddad',    trip: 'TRP-022',  route: 'Route 5D',  seat: '6A',  date: '2025-04-14', time: '06:00', amount: '$2.00', status: 'Used' },
  { id: 'TKT-008', passenger: 'Omar Khalil',     trip: 'TRP-018',  route: 'Route 9E',  seat: '11C', date: '2025-04-14', time: '06:30', amount: '$3.50', status: 'Used' },
  { id: 'TKT-009', passenger: 'Rania Saad',      trip: 'TRP-033',  route: 'Route 5D',  seat: '3B',  date: '2025-04-14', time: '09:00', amount: '$2.00', status: 'Confirmed' },
  { id: 'TKT-010', passenger: 'Joelle Karam',    trip: 'TRP-047',  route: 'Route 3C',  seat: '9A',  date: '2025-04-14', time: '09:15', amount: '$3.00', status: 'Confirmed' },
  { id: 'TKT-011', passenger: 'Nour Bitar',      trip: 'TRP-041B', route: 'Route 12A', seat: '1A',  date: '2025-04-14', time: '07:30', amount: '$2.50', status: 'Cancelled' },
  { id: 'TKT-012', passenger: 'Tarek Mansour',   trip: 'TRP-015',  route: 'Route 12A', seat: '18B', date: '2025-04-14', time: '05:45', amount: '$2.50', status: 'Used' },
];

export const MOCK_RATINGS = [
  { id: 1, passenger: 'Aline Haddad',  route: 'Route 12A', driver: 'Karim Moussa',   rating: 5, comment: 'Very punctual and smooth ride.',         date: '2025-04-14' },
  { id: 2, passenger: 'Rania Saad',    route: 'Route 7B',  driver: 'Joe Pharaon',    rating: 3, comment: 'Bus was overcrowded today.',              date: '2025-04-14' },
  { id: 3, passenger: 'Omar Khalil',   route: 'Route 3C',  driver: 'Lara Abi Nader', rating: 5, comment: 'Great driver, very professional.',        date: '2025-04-13' },
  { id: 4, passenger: 'Joelle Karam',  route: 'Route 9E',  driver: 'Rami Khoury',    rating: 4, comment: 'Comfortable ride, slight delay.',         date: '2025-04-13' },
  { id: 5, passenger: 'Nour Bitar',    route: 'Route 5D',  driver: 'Maya Salameh',   rating: 5, comment: 'Best bus driver in Lebanon!',             date: '2025-04-12' },
  { id: 6, passenger: 'Tarek Mansour', route: 'Route 7B',  driver: 'Fadi Gemayel',   rating: 4, comment: 'On time, clean bus.',                    date: '2025-04-12' },
  { id: 7, passenger: 'Aline Haddad',  route: 'Route 9E',  driver: 'Hassan Nasser',  rating: 2, comment: 'Driver was talking on the phone.',       date: '2025-04-11' },
  { id: 8, passenger: 'Omar Khalil',   route: 'Route 12A', driver: 'Karim Moussa',   rating: 5, comment: 'Perfect service as always.',             date: '2025-04-11' },
];

export const MOCK_NOTIFICATIONS = [
  { id: 1, text: 'Driver K. Moussa sent emergency alert — Trip #TRP-041',       type: 'emergency', time: '2025-04-14T13:58:00', read: false },
  { id: 2, text: 'Trip #TRP-038 reporting 15 min delay — heavy traffic',        type: 'delay',     time: '2025-04-14T13:49:00', read: false },
  { id: 3, text: 'Driver Sara Khoury flagged as DISTRACTED on BUS-07',          type: 'emergency', time: '2025-04-14T13:40:00', read: false },
  { id: 4, text: 'Vehicle BUS-07 flagged for maintenance check',                type: 'delay',     time: '2025-04-14T13:26:00', read: true  },
  { id: 5, text: 'New passenger registration spike — 38 today',                 type: 'info',      time: '2025-04-14T13:00:00', read: true  },
  { id: 6, text: 'Trip TRP-022 completed — Route 5D',                          type: 'info',      time: '2025-04-14T09:45:00', read: true  },
  { id: 7, text: 'Driver Fadi Gemayel phone detected on BUS-12 — TRP-050',     type: 'emergency', time: '2025-04-14T09:30:00', read: true  },
  { id: 8, text: 'BUS-04 engine warning — scheduled for service',               type: 'delay',     time: '2025-04-14T08:15:00', read: true  },
];

export const MOCK_ROUTES = [
  { id: 1, name: 'Route 12A', origin: 'Beirut (Downtown)',  destination: 'Jounieh',  stops: 6, distance: '28 km', duration: '55 min', status: 'Active' },
  { id: 2, name: 'Route 7B',  origin: 'Beirut (Hamra)',     destination: 'Byblos',   stops: 8, distance: '42 km', duration: '80 min', status: 'Active' },
  { id: 3, name: 'Route 3C',  origin: 'Beirut (Cola)',      destination: 'Zahlé',    stops: 5, distance: '55 km', duration: '90 min', status: 'Active' },
  { id: 4, name: 'Route 5D',  origin: 'Beirut (Airport)',   destination: 'Sidon',    stops: 7, distance: '45 km', duration: '75 min', status: 'Active' },
  { id: 5, name: 'Route 9E',  origin: 'Beirut (Dora)',      destination: 'Batroun',  stops: 9, distance: '68 km', duration: '110 min', status: 'Active' },
];

export const MOCK_DASHBOARD_STATS = {
  totalUsers: 1284,
  activeTrips: 6,
  activeVehicles: 8,
  avgRating: 4.4,
};
