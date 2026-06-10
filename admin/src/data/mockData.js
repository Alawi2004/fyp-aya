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
  // ── Buses ────────────────────────────────────────────────────────────────────
  { id: 1,  plate: 'BUS-01', type: 'Bus',     model: 'Toyota Coaster',      year: 2020, capacity: 40, status: 'Active',      driver: 'Karim Moussa',   lastService: '2024-11-15', km: 84200  },
  { id: 7,  plate: 'BUS-07', type: 'Bus',     model: 'Toyota Coaster',      year: 2020, capacity: 40, status: 'Active',      driver: 'Sara Khoury',    lastService: '2025-01-22', km: 89600  },
  { id: 9,  plate: 'BUS-09', type: 'Bus',     model: 'Hyundai County',      year: 2021, capacity: 40, status: 'Active',      driver: 'Joe Pharaon',    lastService: '2024-11-30', km: 55700  },
  { id: 10, plate: 'BUS-10', type: 'Bus',     model: 'Mercedes Tourismo',   year: 2022, capacity: 50, status: 'Inactive',    driver: '—',              lastService: '2024-07-18', km: 142000 },
  { id: 12, plate: 'BUS-12', type: 'Bus',     model: 'Toyota Coaster',      year: 2021, capacity: 45, status: 'Active',      driver: 'Fadi Gemayel',   lastService: '2024-12-28', km: 61100  },
  // ── Minibuses ────────────────────────────────────────────────────────────────
  { id: 2,  plate: 'MINI-01',type: 'Minibus', model: 'Mercedes Sprinter',   year: 2021, capacity: 22, status: 'Active',      driver: 'Maya Salameh',   lastService: '2024-10-20', km: 102500 },
  { id: 3,  plate: 'MINI-02',type: 'Minibus', model: 'Iveco Daily',         year: 2022, capacity: 18, status: 'Active',      driver: 'Hassan Nasser',  lastService: '2025-01-08', km: 43800  },
  { id: 4,  plate: 'MINI-03',type: 'Minibus', model: 'Hyundai County',      year: 2019, capacity: 29, status: 'Maintenance', driver: '—',              lastService: '2024-08-01', km: 178000 },
  { id: 5,  plate: 'MINI-04',type: 'Minibus', model: 'Mercedes Sprinter',   year: 2021, capacity: 20, status: 'Active',      driver: 'Lara Abi Nader', lastService: '2024-12-10', km: 67300  },
  { id: 6,  plate: 'MINI-05',type: 'Minibus', model: 'Mitsubishi Rosa',     year: 2018, capacity: 25, status: 'Inactive',    driver: '—',              lastService: '2024-06-14', km: 230400 },
  { id: 8,  plate: 'MINI-06',type: 'Minibus', model: 'Iveco Daily',         year: 2023, capacity: 18, status: 'Maintenance', driver: '—',              lastService: '2024-09-05', km: 29100  },
  { id: 11, plate: 'MINI-07',type: 'Minibus', model: 'Mercedes Sprinter',   year: 2020, capacity: 30, status: 'Active',      driver: 'Rami Khoury',    lastService: '2025-02-01', km: 72400  },
  { id: 13, plate: 'MINI-08',type: 'Minibus', model: 'Iveco Daily',         year: 2019, capacity: 18, status: 'Inactive',    driver: '—',              lastService: '2024-05-09', km: 198700 },
  // ── Vans ─────────────────────────────────────────────────────────────────────
  { id: 14, plate: 'VAN-01', type: 'Van',     model: 'Ford Transit',        year: 2022, capacity: 12, status: 'Active',      driver: 'Nadia Haddad',   lastService: '2026-02-28', km: 34700  },
  { id: 15, plate: 'VAN-02', type: 'Van',     model: 'Mercedes Vito',       year: 2020, capacity: 9,  status: 'Active',      driver: '—',              lastService: '2025-12-05', km: 67300  },
  { id: 16, plate: 'VAN-03', type: 'Van',     model: 'Volkswagen Crafter',  year: 2023, capacity: 14, status: 'Maintenance', driver: '—',              lastService: '2026-04-10', km: 18900  },
  // ── Taxis ─────────────────────────────────────────────────────────────────────
  { id: 17, plate: 'TAXI-01',type: 'Taxi',    model: 'Toyota Camry',        year: 2023, capacity: 4,  status: 'Active',      driver: 'Ziad Mansour',   lastService: '2026-03-15', km: 12400  },
  { id: 18, plate: 'TAXI-02',type: 'Taxi',    model: 'Kia Sportage',        year: 2022, capacity: 4,  status: 'Active',      driver: '—',              lastService: '2026-01-20', km: 28600  },
  { id: 19, plate: 'TAXI-03',type: 'Taxi',    model: 'Hyundai Tucson',      year: 2021, capacity: 4,  status: 'Inactive',    driver: '—',              lastService: '2025-11-10', km: 45200  },
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
  { id: 1,  name: 'Aline Haddad',     email: 'aline.h@example.com',     role: 'Passenger', joined: '2024-09-10', trips: 23,  status: 'Active'   },
  { id: 2,  name: 'Karim Moussa',     email: 'k.moussa@example.com',     role: 'Driver',    joined: '2023-01-15', trips: 312, status: 'Active'   },
  { id: 3,  name: 'Rania Saad',       email: 'rania.saad@example.com',   role: 'Passenger', joined: '2024-11-02', trips: 8,   status: 'Active'   },
  { id: 4,  name: 'Lara Abi Nader',   email: 'lara.an@example.com',      role: 'Driver',    joined: '2023-03-20', trips: 189, status: 'Active'   },
  { id: 5,  name: 'Omar Khalil',      email: 'omar.k@example.com',       role: 'Passenger', joined: '2025-01-05', trips: 4,   status: 'Active'   },
  { id: 6,  name: 'Maya Salameh',     email: 'maya.s@example.com',       role: 'Driver',    joined: '2023-06-11', trips: 97,  status: 'Active'   },
  { id: 7,  name: 'Joelle Karam',     email: 'joelle.k@example.com',     role: 'Passenger', joined: '2024-07-28', trips: 41,  status: 'Active'   },
  { id: 8,  name: 'Admin User',       email: 'admin@yallatransit.lb',    role: 'Admin',     joined: '2022-12-01', trips: 0,   status: 'Active'   },
  { id: 9,  name: 'Fadi Gemayel',     email: 'fadi.g@example.com',       role: 'Driver',    joined: '2023-08-14', trips: 228, status: 'Active'   },
  { id: 10, name: 'Nour Bitar',       email: 'nour.b@example.com',       role: 'Passenger', joined: '2024-12-19', trips: 6,   status: 'Active'   },
  { id: 11, name: 'Sara Khoury',      email: 'sara.k@example.com',       role: 'Driver',    joined: '2023-05-07', trips: 144, status: 'Inactive' },
  { id: 12, name: 'Tarek Mansour',    email: 'tarek.m@example.com',      role: 'Passenger', joined: '2024-04-14', trips: 17,  status: 'Active'   },
  { id: 21, name: 'Ahmed Khalil',     email: 'a.khalil@staff.lb',        role: 'Staff',     joined: '2024-01-10', trips: 0,   status: 'Active'   },
  { id: 22, name: 'Sara Mansour',     email: 's.mansour@staff.lb',       role: 'Staff',     joined: '2024-03-15', trips: 0,   status: 'Active'   },
  { id: 23, name: 'Rami Azar',        email: 'r.azar@staff.lb',          role: 'Staff',     joined: '2023-11-20', trips: 0,   status: 'Disabled' },
  { id: 24, name: 'Lina Khoury',      email: 'l.khoury@staff.lb',        role: 'Staff',     joined: '2024-06-01', trips: 0,   status: 'Active'   },
];

export const MOCK_STAFF = [
  { id: 21, name: 'Ahmed Khalil',   email: 'a.khalil@staff.lb',  status: 'Active',   joined: '2024-01-10', location: 'Cola Hub',        daily_limit: 5000, tx_limit: 500, today_count: 12, today_total: 1840, total_count: 312, total_amount: 48200, flagged: 0 },
  { id: 22, name: 'Sara Mansour',   email: 's.mansour@staff.lb', status: 'Active',   joined: '2024-03-15', location: 'Hamra Station',   daily_limit: 5000, tx_limit: 500, today_count: 8,  today_total: 1200, total_count: 198, total_amount: 31500, flagged: 4 },
  { id: 23, name: 'Rami Azar',      email: 'r.azar@staff.lb',    status: 'Disabled', joined: '2023-11-20', location: 'Dora Terminal',   daily_limit: 3000, tx_limit: 300, today_count: 0,  today_total: 0,    total_count: 87,  total_amount: 14300, flagged: 5 },
  { id: 24, name: 'Lina Khoury',    email: 'l.khoury@staff.lb',  status: 'Active',   joined: '2024-06-01', location: 'Airport Hub',     daily_limit: 5000, tx_limit: 500, today_count: 15, today_total: 2400, total_count: 145, total_amount: 22800, flagged: 0 },
  { id: 25, name: 'Hassan Barakat', email: 'h.barakat@staff.lb', status: 'Active',   joined: '2024-02-28', location: 'Jounieh Hub',     daily_limit: 5000, tx_limit: 500, today_count: 6,  today_total: 950,  total_count: 231, total_amount: 38700, flagged: 1 },
  { id: 26, name: 'Nadia Frem',     email: 'n.frem@staff.lb',    status: 'Active',   joined: '2025-01-05', location: 'Baabda Station',  daily_limit: 2000, tx_limit: 200, today_count: 4,  today_total: 600,  total_count: 52,  total_amount: 8900,  flagged: 0 },
];

export const MOCK_STAFF_TRANSACTIONS = [
  { id: 'TX-1001', staff_id: 21, staff: 'Ahmed Khalil',   passenger: 'Aline Haddad',  amount: 50.00,  method: 'Cash',            location: 'Cola Hub',       time: '2026-05-05T08:10:00', flags: []                              },
  { id: 'TX-1002', staff_id: 21, staff: 'Ahmed Khalil',   passenger: 'Rania Saad',    amount: 100.00, method: 'Card',            location: 'Cola Hub',       time: '2026-05-05T08:25:00', flags: []                              },
  { id: 'TX-1003', staff_id: 22, staff: 'Sara Mansour',   passenger: 'Aline Haddad',  amount: 150.00, method: 'Cash',            location: 'Hamra Station',  time: '2026-05-05T09:12:00', flags: []                              },
  { id: 'TX-1004', staff_id: 22, staff: 'Sara Mansour',   passenger: 'Aline Haddad',  amount: 150.00, method: 'Cash',            location: 'Hamra Station',  time: '2026-05-05T09:15:00', flags: ['repeat_user','rapid_sequence'] },
  { id: 'TX-1005', staff_id: 22, staff: 'Sara Mansour',   passenger: 'Aline Haddad',  amount: 200.00, method: 'Cash',            location: 'Hamra Station',  time: '2026-05-05T09:17:00', flags: ['repeat_user','rapid_sequence'] },
  { id: 'TX-1006', staff_id: 23, staff: 'Rami Azar',      passenger: 'Omar Khalil',   amount: 800.00, method: 'Card',            location: 'Dora Terminal',  time: '2026-05-04T14:30:00', flags: ['large_amount']                },
  { id: 'TX-1007', staff_id: 23, staff: 'Rami Azar',      passenger: 'Rania Saad',    amount: 750.00, method: 'Cash',            location: 'Dora Terminal',  time: '2026-05-04T14:32:00', flags: ['large_amount','rapid_sequence']},
  { id: 'TX-1008', staff_id: 23, staff: 'Rami Azar',      passenger: 'Joelle Karam',  amount: 600.00, method: 'Mobile Transfer', location: 'Dora Terminal',  time: '2026-05-04T14:35:00', flags: ['large_amount','rapid_sequence']},
  { id: 'TX-1009', staff_id: 24, staff: 'Lina Khoury',    passenger: 'Nour Bitar',    amount: 75.00,  method: 'Cash',            location: 'Airport Hub',    time: '2026-05-05T07:45:00', flags: []                              },
  { id: 'TX-1010', staff_id: 24, staff: 'Lina Khoury',    passenger: 'Tarek Mansour', amount: 120.00, method: 'Card',            location: 'Airport Hub',    time: '2026-05-05T08:00:00', flags: []                              },
  { id: 'TX-1011', staff_id: 24, staff: 'Lina Khoury',    passenger: 'Omar Khalil',   amount: 200.00, method: 'Cash',            location: 'Airport Hub',    time: '2026-05-05T08:15:00', flags: []                              },
  { id: 'TX-1012', staff_id: 25, staff: 'Hassan Barakat', passenger: 'Aline Haddad',  amount: 50.00,  method: 'Cash',            location: 'Jounieh Hub',    time: '2026-05-05T10:30:00', flags: []                              },
  { id: 'TX-1013', staff_id: 25, staff: 'Hassan Barakat', passenger: 'Rania Saad',    amount: 550.00, method: 'Card',            location: 'Jounieh Hub',    time: '2026-05-05T11:00:00', flags: ['large_amount']                },
  { id: 'TX-1014', staff_id: 26, staff: 'Nadia Frem',     passenger: 'Joelle Karam',  amount: 100.00, method: 'Cash',            location: 'Baabda Station', time: '2026-05-05T09:00:00', flags: []                              },
  { id: 'TX-1015', staff_id: 21, staff: 'Ahmed Khalil',   passenger: 'Nour Bitar',    amount: 80.00,  method: 'Cash',            location: 'Cola Hub',       time: '2026-05-05T10:10:00', flags: []                              },
  { id: 'TX-1016', staff_id: 21, staff: 'Ahmed Khalil',   passenger: 'Tarek Mansour', amount: 200.00, method: 'Card',            location: 'Cola Hub',       time: '2026-05-05T10:45:00', flags: []                              },
  { id: 'TX-1017', staff_id: 22, staff: 'Sara Mansour',   passenger: 'Omar Khalil',   amount: 300.00, method: 'Mobile Transfer', location: 'Hamra Station',  time: '2026-05-05T13:20:00', flags: []                              },
  { id: 'TX-1018', staff_id: 22, staff: 'Sara Mansour',   passenger: 'Omar Khalil',   amount: 200.00, method: 'Cash',            location: 'Hamra Station',  time: '2026-05-05T13:22:00', flags: ['repeat_user','rapid_sequence'] },
  { id: 'TX-1019', staff_id: 24, staff: 'Lina Khoury',    passenger: 'Aline Haddad',  amount: 350.00, method: 'Card',            location: 'Airport Hub',    time: '2026-05-05T14:00:00', flags: []                              },
  { id: 'TX-1020', staff_id: 25, staff: 'Hassan Barakat', passenger: 'Rania Saad',    amount: 90.00,  method: 'Cash',            location: 'Jounieh Hub',    time: '2026-05-05T15:00:00', flags: []                              },
];

// Today = 2026-05-06. Two intentional conflicts seeded for demonstration:
// 1) Driver conflict: Karim Moussa at 09:00 (Route 12A, 55 min → ends 09:55) + 09:30 (Route 7B)
// 2) Driver conflict: Rami Khoury  at 14:30 (Route 9E, 110 min → ends 16:20) + 15:00 (Route 5D)
export const MOCK_TIMETABLE_TRIPS = [
  { id: 'TRP-T01', route: 'Route 12A', driver: 'Karim Moussa',   vehicle: 'BUS-01', date: '2026-05-06', time: '05:45', seats: '22/30', status: 'Completed' },
  { id: 'TRP-T02', route: 'Route 7B',  driver: 'Lara Abi Nader', vehicle: 'BUS-05', date: '2026-05-06', time: '06:00', seats: '15/20', status: 'Completed' },
  { id: 'TRP-T03', route: 'Route 3C',  driver: 'Joe Pharaon',    vehicle: 'BUS-09', date: '2026-05-06', time: '06:30', seats: '38/40', status: 'Completed' },
  { id: 'TRP-T04', route: 'Route 5D',  driver: 'Maya Salameh',   vehicle: 'BUS-02', date: '2026-05-06', time: '07:00', seats: '12/22', status: 'Completed' },
  { id: 'TRP-T05', route: 'Route 9E',  driver: 'Rami Khoury',    vehicle: 'BUS-11', date: '2026-05-06', time: '07:00', seats: '25/30', status: 'Completed' },
  { id: 'TRP-T06', route: 'Route 12A', driver: 'Hassan Nasser',  vehicle: 'BUS-03', date: '2026-05-06', time: '07:30', seats: '28/30', status: 'Ongoing'   },
  { id: 'TRP-T07', route: 'Route 7B',  driver: 'Fadi Gemayel',   vehicle: 'BUS-12', date: '2026-05-06', time: '07:45', seats: '18/45', status: 'Ongoing'   },
  { id: 'TRP-T08', route: 'Route 5D',  driver: 'Nadia Haddad',   vehicle: 'BUS-07', date: '2026-05-06', time: '08:00', seats: '0/40',  status: 'Ongoing'   },
  { id: 'TRP-T09', route: 'Route 12A', driver: 'Karim Moussa',   vehicle: 'BUS-01', date: '2026-05-06', time: '09:00', seats: '0/30',  status: 'Scheduled' }, // ← conflict ①
  { id: 'TRP-T10', route: 'Route 7B',  driver: 'Karim Moussa',   vehicle: 'BUS-05', date: '2026-05-06', time: '09:30', seats: '0/20',  status: 'Scheduled' }, // ← conflict ① (driver overlap)
  { id: 'TRP-T11', route: 'Route 3C',  driver: 'Joe Pharaon',    vehicle: 'BUS-09', date: '2026-05-06', time: '09:00', seats: '0/40',  status: 'Scheduled' },
  { id: 'TRP-T12', route: 'Route 9E',  driver: 'Ziad Mansour',   vehicle: 'BUS-11', date: '2026-05-06', time: '09:30', seats: '0/30',  status: 'Scheduled' },
  { id: 'TRP-T13', route: 'Route 5D',  driver: 'Maya Salameh',   vehicle: 'BUS-02', date: '2026-05-06', time: '10:00', seats: '0/22',  status: 'Scheduled' },
  { id: 'TRP-T14', route: 'Route 12A', driver: 'Ziad Mansour',   vehicle: 'BUS-03', date: '2026-05-06', time: '12:00', seats: '0/30',  status: 'Scheduled' },
  { id: 'TRP-T15', route: 'Route 7B',  driver: 'Lara Abi Nader', vehicle: 'BUS-05', date: '2026-05-06', time: '12:30', seats: '0/20',  status: 'Scheduled' },
  { id: 'TRP-T16', route: 'Route 3C',  driver: 'Hassan Nasser',  vehicle: 'BUS-09', date: '2026-05-06', time: '14:00', seats: '0/40',  status: 'Scheduled' },
  { id: 'TRP-T17', route: 'Route 9E',  driver: 'Rami Khoury',    vehicle: 'BUS-11', date: '2026-05-06', time: '14:30', seats: '0/30',  status: 'Scheduled' }, // ← conflict ②
  { id: 'TRP-T18', route: 'Route 5D',  driver: 'Rami Khoury',    vehicle: 'BUS-02', date: '2026-05-06', time: '15:00', seats: '0/22',  status: 'Scheduled' }, // ← conflict ② (driver overlap)
  { id: 'TRP-T19', route: 'Route 12A', driver: 'Karim Moussa',   vehicle: 'BUS-01', date: '2026-05-06', time: '17:00', seats: '0/30',  status: 'Scheduled' },
  { id: 'TRP-T20', route: 'Route 7B',  driver: 'Fadi Gemayel',   vehicle: 'BUS-12', date: '2026-05-06', time: '17:30', seats: '0/45',  status: 'Scheduled' },
  { id: 'TRP-T21', route: 'Route 5D',  driver: 'Maya Salameh',   vehicle: 'BUS-02', date: '2026-05-06', time: '18:00', seats: '0/22',  status: 'Scheduled' },
  { id: 'TRP-T22', route: 'Route 9E',  driver: 'Ziad Mansour',   vehicle: 'BUS-11', date: '2026-05-06', time: '18:30', seats: '0/30',  status: 'Scheduled' },
];

export const MOCK_RECURRING_SCHEDULES = [
  { id: 1, route: 'Route 12A', driver: 'Karim Moussa',   vehicle: 'BUS-01', time: '05:45', recurrence: 'daily',    days: [],                    status: 'Active',  active_from: '2026-01-01', next_run: '2026-05-07' },
  { id: 2, route: 'Route 7B',  driver: 'Lara Abi Nader', vehicle: 'BUS-05', time: '06:00', recurrence: 'weekdays', days: [],                    status: 'Active',  active_from: '2026-01-01', next_run: '2026-05-07' },
  { id: 3, route: 'Route 3C',  driver: 'Joe Pharaon',    vehicle: 'BUS-09', time: '06:30', recurrence: 'weekdays', days: [],                    status: 'Active',  active_from: '2026-01-01', next_run: '2026-05-07' },
  { id: 4, route: 'Route 5D',  driver: 'Maya Salameh',   vehicle: 'BUS-02', time: '07:00', recurrence: 'custom',   days: ['Mon','Wed','Fri'],   status: 'Active',  active_from: '2026-02-01', next_run: '2026-05-08' },
  { id: 5, route: 'Route 9E',  driver: 'Rami Khoury',    vehicle: 'BUS-11', time: '07:00', recurrence: 'weekends', days: [],                    status: 'Active',  active_from: '2026-01-01', next_run: '2026-05-10' },
  { id: 6, route: 'Route 12A', driver: 'Hassan Nasser',  vehicle: 'BUS-03', time: '17:00', recurrence: 'daily',    days: [],                    status: 'Paused', active_from: '2026-03-01', next_run: '—'          },
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

// Cash = amounts from MOCK_STAFF_TRANSACTIONS where method === 'Cash', grouped by staff
export const MOCK_RECONCILIATION = [
  { id: 1, staff_id: 21, staff: 'Ahmed Khalil',   date: '2026-05-08', station: 'Cola Hub',       cash_txns: 2, total_txns: 6,  expected: 130,  reported: 130,  discrepancy: 0,   status: 'matched'  },
  { id: 2, staff_id: 22, staff: 'Sara Mansour',   date: '2026-05-08', station: 'Hamra Station',  cash_txns: 3, total_txns: 5,  expected: 550,  reported: 520,  discrepancy: -30, status: 'shortage' },
  { id: 3, staff_id: 23, staff: 'Rami Azar',      date: '2026-05-08', station: 'Dora Terminal',  cash_txns: 1, total_txns: 3,  expected: 750,  reported: null, discrepancy: null,status: 'pending'  },
  { id: 4, staff_id: 24, staff: 'Lina Khoury',    date: '2026-05-08', station: 'Airport Hub',    cash_txns: 2, total_txns: 5,  expected: 275,  reported: 280,  discrepancy: 5,   status: 'excess'   },
  { id: 5, staff_id: 25, staff: 'Hassan Barakat', date: '2026-05-08', station: 'Jounieh Hub',    cash_txns: 2, total_txns: 3,  expected: 140,  reported: 140,  discrepancy: 0,   status: 'matched'  },
  { id: 6, staff_id: 26, staff: 'Nadia Frem',     date: '2026-05-08', station: 'Baabda Station', cash_txns: 1, total_txns: 2,  expected: 100,  reported: null, discrepancy: null,status: 'pending'  },
];

export const MOCK_COMPLAINTS = [
  { id: 'CMP-001', title: 'Driver using phone while driving',       category: 'Driver Behavior', priority: 'Critical', status: 'Open',        passenger: 'Aline Haddad',  driver: 'Hassan Nasser', route: 'Route 9E',  description: 'The driver was clearly visible using his mobile phone during the entire trip on Route 9E. This is a serious safety concern that put all passengers at risk.',                   assigned_to: null,        created_at: '2026-05-08T09:30:00', updated_at: '2026-05-08T09:30:00', comments: [] },
  { id: 'CMP-002', title: 'Bus arrived 25 minutes late',            category: 'Route Issue',     priority: 'High',     status: 'In Progress', passenger: 'Omar Khalil',   driver: 'Lara Abi Nader',route: 'Route 7B',  description: 'The bus was significantly delayed with no prior notification sent to passengers waiting at the stop. Many passengers missed their connections.',                              assigned_to: 'Admin User', created_at: '2026-05-07T14:20:00', updated_at: '2026-05-08T08:00:00', comments: [{ author: 'Admin User', text: 'Contacted the driver. Heavy traffic on coastal road confirmed as cause. Escalating to operations team.', time: '2026-05-08T08:00:00' }] },
  { id: 'CMP-003', title: 'Wallet balance not updated after top-up',category: 'Payment',         priority: 'High',     status: 'Resolved',    passenger: 'Rania Saad',    driver: null,            route: null,        description: 'Topped up wallet at Hamra Station (OMR 150) but balance did not reflect in the app after 2 hours. Staff member confirmed the transaction was processed.',                   assigned_to: 'Admin User', created_at: '2026-05-06T11:00:00', updated_at: '2026-05-07T15:30:00', comments: [{ author: 'Admin User', text: 'Investigated — duplicate transaction entry in DB. Rolled back and re-applied correct balance.', time: '2026-05-06T16:00:00' }, { author: 'Admin User', text: 'Balance corrected to OMR 162.50. Passenger notified via app notification.', time: '2026-05-07T15:30:00' }] },
  { id: 'CMP-004', title: 'Bus overcrowded beyond capacity',        category: 'Safety',          priority: 'High',     status: 'Open',        passenger: 'Joelle Karam',  driver: 'Joe Pharaon',   route: 'Route 3C',  description: 'Bus BUS-09 was carrying an estimated 50+ passengers on a vehicle rated for 40. Standing room only and some passengers were hanging by the doors.',                          assigned_to: null,        created_at: '2026-05-08T07:45:00', updated_at: '2026-05-08T07:45:00', comments: [] },
  { id: 'CMP-005', title: 'App crashes when viewing trip history',  category: 'App Issue',       priority: 'Medium',   status: 'In Progress', passenger: 'Nour Bitar',    driver: null,            route: null,        description: 'The passenger app crashes every time I open the trip history tab. Happens on both Android and iOS. Reinstalling the app did not fix the issue.',                           assigned_to: 'Admin User', created_at: '2026-05-05T16:30:00', updated_at: '2026-05-07T09:00:00', comments: [{ author: 'Admin User', text: 'Bug reproduced on Android 14. Ticket raised with dev team. Fix expected in next release.', time: '2026-05-06T10:00:00' }] },
  { id: 'CMP-006', title: 'Driver rude and dismissive to passengers',category:'Driver Behavior', priority: 'Medium',   status: 'Closed',      passenger: 'Tarek Mansour', driver: 'Sara Khoury',   route: 'Route 7B',  description: 'Driver refused to answer questions about the route and was dismissive when passengers asked for stop information. Unprofessional behavior.',                               assigned_to: 'Admin User', created_at: '2026-05-03T13:00:00', updated_at: '2026-05-04T17:00:00', comments: [{ author: 'Admin User', text: 'Spoken with driver directly. Formal verbal warning logged. Behaviour training scheduled.', time: '2026-05-04T17:00:00' }] },
  { id: 'CMP-007', title: 'QR code scanner error at boarding',      category: 'App Issue',       priority: 'Low',      status: 'Resolved',    passenger: 'Aline Haddad',  driver: null,            route: null,        description: 'QR scanner on BUS-07 could not read my ticket. Driver manually verified but asked me to resolve the issue before the next trip.',                                       assigned_to: 'Admin User', created_at: '2026-05-04T08:15:00', updated_at: '2026-05-05T12:00:00', comments: [{ author: 'Admin User', text: 'Scanner firmware updated to v2.3.1. Tested and confirmed working.', time: '2026-05-05T12:00:00' }] },
  { id: 'CMP-008', title: 'Incorrect fare deducted from wallet',    category: 'Payment',         priority: 'High',     status: 'Open',        passenger: 'Omar Khalil',   driver: null,            route: 'Route 5D',  description: 'Charged OMR 3.50 instead of the standard OMR 2.00 for Route 5D. No discount was applied despite my registered Senior Citizen status.',                                     assigned_to: null,        created_at: '2026-05-08T10:15:00', updated_at: '2026-05-08T10:15:00', comments: [] },
  { id: 'CMP-009', title: 'Bus skipped scheduled stop',            category: 'Route Issue',     priority: 'Medium',   status: 'In Progress', passenger: 'Rania Saad',    driver: 'Maya Salameh',  route: 'Route 5D',  description: 'The bus passed stop #4 (Adliyeh Roundabout) without stopping even though multiple passengers signalled and the stop indicator was active.',                             assigned_to: 'Admin User', created_at: '2026-05-07T17:30:00', updated_at: '2026-05-08T08:30:00', comments: [{ author: 'Admin User', text: 'GPS log reviewed — driver veered off route by 400m. Driver contacted for explanation. Report pending.', time: '2026-05-08T08:30:00' }] },
  { id: 'CMP-010', title: 'Air conditioning not functioning',       category: 'Vehicle',         priority: 'Low',      status: 'Open',        passenger: 'Nour Bitar',    driver: 'Karim Moussa',  route: 'Route 12A', description: 'AC was completely non-functional for the full 55-minute journey in 34°C heat. Driver acknowledged the issue but could not fix it.',                                       assigned_to: null,        created_at: '2026-05-08T11:00:00', updated_at: '2026-05-08T11:00:00', comments: [] },
];

export const MOCK_NOTIFICATION_TEMPLATES = [
  { id: 1, name: 'Bus Delay Alert',        type: 'delay',     target: 'route_passengers', title: 'Bus Delay on {route}',          body: 'Your bus on {route} is delayed by approximately {minutes} minutes due to {reason}. We apologise for the inconvenience.' },
  { id: 2, name: 'Service Disruption',     type: 'emergency', target: 'all_passengers',   title: 'Service Disruption — {route}',  body: 'Service on {route} is temporarily suspended. Please use alternative transportation. We will provide updates shortly.' },
  { id: 3, name: 'Welcome New Passenger',  type: 'info',      target: 'specific_user',    title: 'Welcome to Yalla Transit!',        body: 'Your account is ready. Top up your wallet to start riding. Enjoy fast, safe, and affordable transport across Lebanon.' },
  { id: 4, name: 'Low Balance Warning',    type: 'info',      target: 'specific_user',    title: 'Low Wallet Balance',            body: 'Your wallet balance is running low. Please visit any top-up station or contact staff to recharge before your next trip.' },
  { id: 5, name: 'Trip Completed',         type: 'success',   target: 'specific_user',    title: 'Trip Completed ✓',             body: 'Your trip on {route} is complete. Thank you for riding with Yalla Transit! Please take a moment to rate your experience.' },
  { id: 6, name: 'Driver Emergency Alert', type: 'emergency', target: 'all_drivers',      title: 'Emergency Alert — {driver}',   body: 'Driver {driver} on {vehicle} has triggered an emergency alert. All nearby units please respond. Dispatch has been notified.' },
  { id: 7, name: 'Holiday Schedule',       type: 'info',      target: 'all_users',        title: 'Modified Holiday Schedule',     body: 'During the upcoming holiday ({date}), buses will operate on a reduced schedule. Please check the app for updated timings.' },
  { id: 8, name: 'Route Change Notice',    type: 'delay',     target: 'route_passengers', title: 'Temporary Route Change',        body: 'Due to road works, {route} is temporarily rerouted. Journey times may be affected. Normal service resumes {date}.' },
];

export const MOCK_SCHEDULED_NOTIFICATIONS = [
  { id: 101, title: 'Weekend Service Update',   body: 'Reduced service on Saturday and Sunday. Buses will run every 30 minutes instead of the usual 15-minute frequency.', type: 'info',      target: 'all_passengers',   target_label: 'All Passengers',          scheduled_at: '2026-05-07T08:00:00', status: 'pending' },
  { id: 102, title: 'Route 3C Maintenance',     body: 'Route 3C will be suspended from 10:00 to 14:00 for scheduled track maintenance. Please plan accordingly.',           type: 'delay',     target: 'route_passengers', target_label: 'Route 3C Passengers',     scheduled_at: '2026-05-06T06:00:00', status: 'pending' },
  { id: 103, title: 'Eid Holiday Schedule',     body: 'Modified timetable during the Eid holiday period. All routes will operate on Sunday schedule from May 10–12.',       type: 'info',      target: 'all_users',        target_label: 'All Users',               scheduled_at: '2026-05-10T07:00:00', status: 'pending' },
  { id: 104, title: 'Driver Safety Reminder',   body: 'Reminder to all drivers: mandatory safety check due before starting your shift today. Contact dispatch if issues.',   type: 'info',      target: 'all_drivers',      target_label: 'All Drivers',             scheduled_at: '2026-05-05T05:30:00', status: 'sent'    },
  { id: 105, title: 'System Maintenance Alert', body: 'The Yalla Transit app will undergo scheduled maintenance on May 4 from 02:00–04:00. Wallet top-ups will be unavailable.', type: 'emergency', target: 'all_users',        target_label: 'All Users',               scheduled_at: '2026-05-04T01:00:00', status: 'sent'    },
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

export const MOCK_PERFORMANCE = [
  { driver_id: 1,  name: 'Karim Moussa',   trips_week: 45, on_time_pct: 94, complaints: 0, avg_rating: 4.9, idle_hours: 2.1 },
  { driver_id: 2,  name: 'Lara Abi Nader', trips_week: 38, on_time_pct: 88, complaints: 1, avg_rating: 4.5, idle_hours: 3.4 },
  { driver_id: 3,  name: 'Joe Pharaon',    trips_week: 32, on_time_pct: 79, complaints: 2, avg_rating: 4.3, idle_hours: 4.2 },
  { driver_id: 4,  name: 'Maya Salameh',   trips_week: 28, on_time_pct: 96, complaints: 0, avg_rating: 4.7, idle_hours: 1.8 },
  { driver_id: 5,  name: 'Rami Khoury',    trips_week: 35, on_time_pct: 85, complaints: 1, avg_rating: 4.6, idle_hours: 2.9 },
  { driver_id: 6,  name: 'Sara Khoury',    trips_week: 20, on_time_pct: 70, complaints: 3, avg_rating: 4.2, idle_hours: 5.6 },
  { driver_id: 7,  name: 'Fadi Gemayel',   trips_week: 42, on_time_pct: 91, complaints: 1, avg_rating: 4.8, idle_hours: 2.3 },
  { driver_id: 8,  name: 'Hassan Nasser',  trips_week: 30, on_time_pct: 82, complaints: 2, avg_rating: 4.4, idle_hours: 3.7 },
  { driver_id: 9,  name: 'Nadia Haddad',   trips_week: 18, on_time_pct: 75, complaints: 1, avg_rating: 4.1, idle_hours: 6.0 },
  { driver_id: 10, name: 'Ziad Mansour',   trips_week: 40, on_time_pct: 90, complaints: 0, avg_rating: 4.6, idle_hours: 2.5 },
];

export const MOCK_SCHEDULES = [
  { driver_id: 1,  driver_name: 'Karim Moussa',   Mon:'morning',   Tue:'morning',   Wed:'off',       Thu:'morning',   Fri:'morning',   Sat:'afternoon', Sun:'off'      },
  { driver_id: 2,  driver_name: 'Lara Abi Nader', Mon:'morning',   Tue:'morning',   Wed:'morning',   Thu:'off',       Fri:'morning',   Sat:'off',       Sun:'off'      },
  { driver_id: 3,  driver_name: 'Joe Pharaon',    Mon:'night',     Tue:'night',     Wed:'night',     Thu:'night',     Fri:'off',       Sat:'off',       Sun:'night'    },
  { driver_id: 4,  driver_name: 'Maya Salameh',   Mon:'morning',   Tue:'morning',   Wed:'afternoon', Thu:'morning',   Fri:'morning',   Sat:'morning',   Sun:'vacation' },
  { driver_id: 5,  driver_name: 'Rami Khoury',    Mon:'afternoon', Tue:'afternoon', Wed:'afternoon', Thu:'off',       Fri:'afternoon', Sat:'afternoon', Sun:'off'      },
  { driver_id: 6,  driver_name: 'Sara Khoury',    Mon:'vacation',  Tue:'vacation',  Wed:'vacation',  Thu:'vacation',  Fri:'vacation',  Sat:'vacation',  Sun:'vacation' },
  { driver_id: 7,  driver_name: 'Fadi Gemayel',   Mon:'morning',   Tue:'morning',   Wed:'morning',   Thu:'morning',   Fri:'off',       Sat:'morning',   Sun:'off'      },
  { driver_id: 8,  driver_name: 'Hassan Nasser',  Mon:'night',     Tue:'night',     Wed:'off',       Thu:'night',     Fri:'night',     Sat:'off',       Sun:'night'    },
  { driver_id: 9,  driver_name: 'Nadia Haddad',   Mon:'off',       Tue:'morning',   Wed:'morning',   Thu:'morning',   Fri:'morning',   Sat:'off',       Sun:'off'      },
  { driver_id: 10, driver_name: 'Ziad Mansour',   Mon:'afternoon', Tue:'afternoon', Wed:'afternoon', Thu:'afternoon', Fri:'off',       Sat:'afternoon', Sun:'off'      },
];

// Heatmap: 7 days × 24 hours (deterministic, no Math.random)
export const MOCK_HEATMAP_DATA = Array.from({ length: 7 }, (_, d) =>
  Array.from({ length: 24 }, (_, h) => {
    const isWE = d >= 5;
    const base = isWE ? 12 : 30;
    let mult = 1;
    if (h >= 7  && h <= 9)  mult = isWE ? 1.9 : 3.5;
    if (h >= 12 && h <= 13) mult = isWE ? 1.4 : 1.8;
    if (h >= 17 && h <= 19) mult = isWE ? 2.1 : 3.0;
    if (h < 5   || h > 22)  mult = 0.08;
    const noise = ((d * 24 + h) * 137 + 59) % 13;
    return Math.round(base * mult + noise);
  })
);

export const MOCK_ROUTE_POPULARITY = [
  { route: 'Route 12A', Regular: 284, Student: 142, 'Senior Citizen': 67,  Staff: 38 },
  { route: 'Route 7B',  Regular: 198, Student: 89,  'Senior Citizen': 41,  Staff: 22 },
  { route: 'Route 3C',  Regular: 156, Student: 234, 'Senior Citizen': 28,  Staff: 17 },
  { route: 'Route 5D',  Regular: 312, Student: 76,  'Senior Citizen': 94,  Staff: 45 },
  { route: 'Route 9E',  Regular: 89,  Student: 167, 'Senior Citizen': 52,  Staff: 29 },
];

export const MOCK_PEAK_HOURS = [
  { hour: '05', label: '5am',  count: 38  },
  { hour: '06', label: '6am',  count: 112 },
  { hour: '07', label: '7am',  count: 287 },
  { hour: '08', label: '8am',  count: 342 },
  { hour: '09', label: '9am',  count: 198 },
  { hour: '10', label: '10am', count: 134 },
  { hour: '11', label: '11am', count: 98  },
  { hour: '12', label: '12pm', count: 156 },
  { hour: '13', label: '1pm',  count: 142 },
  { hour: '14', label: '2pm',  count: 123 },
  { hour: '15', label: '3pm',  count: 145 },
  { hour: '16', label: '4pm',  count: 187 },
  { hour: '17', label: '5pm',  count: 312 },
  { hour: '18', label: '6pm',  count: 298 },
  { hour: '19', label: '7pm',  count: 234 },
  { hour: '20', label: '8pm',  count: 167 },
  { hour: '21', label: '9pm',  count: 98  },
  { hour: '22', label: '10pm', count: 56  },
  { hour: '23', label: '11pm', count: 23  },
];

// Vehicle document expiry dates — relative to project date 2026-05-10
// Urgency tiers: expired(<0d) | critical(0-14d) | warning(15-30d) | ok(>30d)
export const MOCK_VEHICLE_DOCS = [
  // Buses
  { plate: 'BUS-01',  reg_expiry: '2026-05-20', ins_expiry: '2026-08-15', road_expiry: '2026-07-01' }, // reg critical(10d)
  { plate: 'BUS-07',  reg_expiry: '2026-12-01', ins_expiry: '2026-11-15', road_expiry: '2026-10-20' }, // all ok
  { plate: 'BUS-09',  reg_expiry: '2026-08-30', ins_expiry: '2026-08-15', road_expiry: '2026-09-01' }, // all ok
  { plate: 'BUS-10',  reg_expiry: '2026-06-15', ins_expiry: '2026-05-17', road_expiry: '2026-07-15' }, // ins critical(7d)
  { plate: 'BUS-12',  reg_expiry: '2026-07-20', ins_expiry: '2026-08-05', road_expiry: '2026-09-30' }, // all ok
  // Minibuses
  { plate: 'MINI-01', reg_expiry: '2026-06-30', ins_expiry: '2026-05-12', road_expiry: '2026-09-15' }, // ins critical(2d)
  { plate: 'MINI-02', reg_expiry: '2026-09-01', ins_expiry: '2026-09-10', road_expiry: '2026-11-01' }, // all ok
  { plate: 'MINI-03', reg_expiry: '2026-05-24', ins_expiry: '2026-04-30', road_expiry: '2026-06-15' }, // reg critical(14d), ins expired(-10d)
  { plate: 'MINI-04', reg_expiry: '2026-07-15', ins_expiry: '2026-06-22', road_expiry: '2026-08-10' }, // all ok
  { plate: 'MINI-05', reg_expiry: '2026-04-01', ins_expiry: '2026-05-28', road_expiry: '2026-05-05' }, // reg expired(-39d), road expired(-5d), ins warning(18d)
  { plate: 'MINI-06', reg_expiry: '2026-05-25', ins_expiry: '2026-07-01', road_expiry: '2026-05-08' }, // reg warning(15d), road expired(-2d)
  { plate: 'MINI-07', reg_expiry: '2026-10-01', ins_expiry: '2026-09-20', road_expiry: '2026-11-15' }, // all ok
  { plate: 'MINI-08', reg_expiry: '2026-05-13', ins_expiry: '2026-03-01', road_expiry: '2026-05-30' }, // reg critical(3d), ins expired(-70d), road warning(20d)
  // Vans
  { plate: 'VAN-01',  reg_expiry: '2026-11-15', ins_expiry: '2026-10-01', road_expiry: '2027-02-28' }, // all ok
  { plate: 'VAN-02',  reg_expiry: '2026-06-20', ins_expiry: '2026-05-22', road_expiry: '2026-08-15' }, // ins warning(12d → critical)
  { plate: 'VAN-03',  reg_expiry: '2027-04-10', ins_expiry: '2027-03-01', road_expiry: '2027-04-10' }, // all ok (new)
  // Taxis
  { plate: 'TAXI-01', reg_expiry: '2027-03-15', ins_expiry: '2027-01-20', road_expiry: '2027-03-15' }, // all ok
  { plate: 'TAXI-02', reg_expiry: '2026-05-18', ins_expiry: '2026-07-10', road_expiry: '2026-06-01' }, // reg critical(8d)
  { plate: 'TAXI-03', reg_expiry: '2025-11-10', ins_expiry: '2026-04-15', road_expiry: '2026-09-20' }, // reg expired, ins expired
];

export const MOCK_DRIVER_LICENSE_ALERTS = [
  { name: 'Karim Moussa',   license: 'LB-20341', expiry: '2026-06-08' },
  { name: 'Lara Abi Nader', license: 'LB-19874', expiry: '2026-05-24' },
  { name: 'Joe Pharaon',    license: 'LB-21103', expiry: '2026-05-17' },
  { name: 'Maya Salameh',   license: 'LB-18560', expiry: '2026-07-15' },
  { name: 'Rami Khoury',    license: 'LB-22087', expiry: '2026-05-09' },
  { name: 'Sara Khoury',    license: 'LB-17432', expiry: '2026-05-11' },
  { name: 'Fadi Gemayel',   license: 'LB-23451', expiry: '2026-06-01' },
  { name: 'Hassan Nasser',  license: 'LB-16789', expiry: '2026-08-20' },
  { name: 'Nadia Haddad',   license: 'LB-24562', expiry: '2026-05-30' },
  { name: 'Ziad Mansour',   license: 'LB-15123', expiry: '2026-05-20' },
];

export const MOCK_MAINTENANCE_LOG = [
  // BUS fleet
  { id: 1,  plate: 'BUS-01',  date: '2024-11-15', type: 'Oil Change',      mechanic: 'Al-Amine Garage',     cost: 45,  odometer: 84200,  notes: 'Engine oil and air filter replaced',                              next_service: '2025-05-15' },
  { id: 2,  plate: 'BUS-01',  date: '2024-08-10', type: 'Tire Rotation',   mechanic: 'City Tires LB',       cost: 30,  odometer: 79500,  notes: 'Rotated all 4 tires, pressure checked',                           next_service: '2025-02-10' },
  { id: 3,  plate: 'BUS-01',  date: '2026-02-01', type: 'Full Inspection', mechanic: 'MOT Centre Beirut',   cost: 120, odometer: 84000,  notes: 'Annual roadworthiness inspection — passed all checks',             next_service: '2027-02-01' },
  { id: 9,  plate: 'BUS-07',  date: '2025-01-22', type: 'Full Inspection', mechanic: 'MOT Centre Beirut',   cost: 120, odometer: 89600,  notes: 'Annual inspection — all clear',                                    next_service: '2026-01-22' },
  { id: 10, plate: 'BUS-07',  date: '2024-12-01', type: 'Engine Service',  mechanic: 'MidEast Motors LB',   cost: 350, odometer: 89000,  notes: 'Spark plugs, coolant flush, timing belt replaced',                 next_service: '2026-12-01' },
  { id: 11, plate: 'BUS-09',  date: '2024-11-30', type: 'Tire Rotation',   mechanic: 'City Tires LB',       cost: 30,  odometer: 55700,  notes: 'Rotated all tires — 2 at minimum tread, flagged for replacement',  next_service: '2025-05-30' },
  { id: 13, plate: 'BUS-12',  date: '2024-12-28', type: 'Brake Check',     mechanic: 'Brake Masters LB',    cost: 95,  odometer: 61100,  notes: 'Front brake pads worn — replaced. Rear checked OK.',               next_service: '2025-12-28' },
  // MINI fleet
  { id: 4,  plate: 'MINI-01', date: '2024-10-20', type: 'Oil Change',      mechanic: 'Al-Amine Garage',     cost: 45,  odometer: 102500, notes: 'Engine oil and oil filter replaced',                               next_service: '2025-04-20' },
  { id: 5,  plate: 'MINI-01', date: '2024-07-05', type: 'Brake Check',     mechanic: 'Brake Masters LB',    cost: 180, odometer: 98200,  notes: 'Front brake pads replaced. Rear discs checked OK.',                next_service: '2025-07-05' },
  { id: 6,  plate: 'MINI-02', date: '2025-01-08', type: 'Full Inspection', mechanic: 'MOT Centre Beirut',   cost: 120, odometer: 43800,  notes: 'Annual inspection — minor wiper issue fixed on site',              next_service: '2026-01-08' },
  { id: 7,  plate: 'MINI-02', date: '2024-11-02', type: 'AC Service',      mechanic: 'Cool Air Workshop',   cost: 90,  odometer: 43200,  notes: 'Refrigerant topped up, cabin filter replaced',                    next_service: '2025-11-02' },
  { id: 8,  plate: 'MINI-04', date: '2024-12-10', type: 'Oil Change',      mechanic: 'Al-Amine Garage',     cost: 45,  odometer: 67300,  notes: 'Routine oil change, belt tension checked',                         next_service: '2025-06-10' },
  { id: 12, plate: 'MINI-07', date: '2025-02-01', type: 'Oil Change',      mechanic: 'Al-Amine Garage',     cost: 45,  odometer: 72400,  notes: 'Oil change and air filter',                                        next_service: '2025-08-01' },
  { id: 14, plate: 'MINI-03', date: '2024-08-01', type: 'Engine Service',  mechanic: 'MidEast Motors LB',   cost: 480, odometer: 177800, notes: 'Major engine service: head gasket, coolant, drive belt',            next_service: '2025-08-01' },
  { id: 15, plate: 'MINI-05', date: '2024-06-14', type: 'Body Work',       mechanic: 'Flash Panel Repairs', cost: 620, odometer: 230000, notes: 'Rear panel dent repair, rust treatment, repaint',                  next_service: null },
  // VAN fleet
  { id: 16, plate: 'VAN-01',  date: '2026-02-28', type: 'Oil Change',      mechanic: 'Al-Amine Garage',     cost: 40,  odometer: 34700,  notes: 'Oil change, tyre pressure check, cabin filter replaced',           next_service: '2026-08-28' },
  { id: 17, plate: 'VAN-02',  date: '2025-12-05', type: 'Brake Check',     mechanic: 'Brake Masters LB',    cost: 130, odometer: 67300,  notes: 'Front pads replaced, rear drums adjusted',                        next_service: '2026-06-05' },
  { id: 18, plate: 'VAN-03',  date: '2026-04-10', type: 'Full Inspection', mechanic: 'MOT Centre Beirut',   cost: 110, odometer: 18900,  notes: 'Pre-registration inspection — AC fault found, being repaired',     next_service: '2027-04-10' },
  // TAXI fleet
  { id: 19, plate: 'TAXI-01', date: '2026-03-15', type: 'Oil Change',      mechanic: 'Quick Lube Hamra',    cost: 35,  odometer: 12400,  notes: 'Synthetic oil change, windscreen washer refilled',                 next_service: '2026-09-15' },
  { id: 20, plate: 'TAXI-02', date: '2026-01-20', type: 'Tire Rotation',   mechanic: 'City Tires LB',       cost: 25,  odometer: 28600,  notes: 'All 4 tyres rotated, pressure balanced',                           next_service: '2026-07-20' },
  { id: 21, plate: 'TAXI-03', date: '2025-11-10', type: 'Full Inspection', mechanic: 'MOT Centre Beirut',   cost: 100, odometer: 45200,  notes: 'Failed on rear brake wear — vehicle placed on inactive status',    next_service: null },
];

export const MOCK_FUEL_LOG = [
  { id: 1,  plate: 'BUS-01',  date: '2026-04-28', liters: 120, cost: 162, odometer: 84120, station: 'Medco Dora', notes: 'Depot refill before airport route' },
  { id: 2,  plate: 'BUS-01',  date: '2026-05-08', liters: 110, cost: 149, odometer: 84930, station: 'Coral Nahr El Mot', notes: 'Urban rotation week' },
  { id: 3,  plate: 'BUS-07',  date: '2026-04-25', liters: 135, cost: 183, odometer: 89120, station: 'Total Jounieh', notes: 'Highway-heavy schedule' },
  { id: 4,  plate: 'BUS-07',  date: '2026-05-09', liters: 128, cost: 174, odometer: 90080, station: 'Total Jounieh', notes: 'Normal refill' },
  { id: 5,  plate: 'MINI-01', date: '2026-04-29', liters: 62,  cost: 84,  odometer: 102220, station: 'IPT Sin El Fil', notes: 'School shuttle coverage' },
  { id: 6,  plate: 'MINI-01', date: '2026-05-07', liters: 58,  cost: 79,  odometer: 102960, station: 'IPT Sin El Fil', notes: 'Traffic-heavy week' },
  { id: 7,  plate: 'MINI-03', date: '2026-04-27', liters: 60,  cost: 81,  odometer: 177050, station: 'Coral Baabda', notes: 'Ageing engine efficiency dip' },
  { id: 8,  plate: 'MINI-03', date: '2026-05-06', liters: 63,  cost: 85,  odometer: 177650, station: 'Coral Baabda', notes: 'Watch fuel burn' },
  { id: 9,  plate: 'VAN-02',  date: '2026-04-30', liters: 52,  cost: 70,  odometer: 66840, station: 'Medco Hazmieh', notes: 'Suburban connector' },
  { id: 10, plate: 'VAN-02',  date: '2026-05-08', liters: 49,  cost: 66,  odometer: 67460, station: 'Medco Hazmieh', notes: 'Steady usage' },
  { id: 11, plate: 'TAXI-02', date: '2026-05-01', liters: 34,  cost: 46,  odometer: 28310, station: 'Wardieh Cola', notes: 'Airport runs' },
  { id: 12, plate: 'TAXI-02', date: '2026-05-09', liters: 33,  cost: 45,  odometer: 28790, station: 'Wardieh Cola', notes: 'Better city mileage' },
];

export const MOCK_WALLET_STATUS = [
  { user_id: 1,  name: 'Aline Haddad',  email: 'aline.h@example.com',   balance: 45.50,  status: 'Frozen', reason: 'Fraud Investigation',          notes: 'Multiple top-ups from unverified third-party accounts detected within 2 hours.', frozen_at: '2026-05-08T10:30:00', frozen_by: 'Admin User' },
  { user_id: 3,  name: 'Rania Saad',    email: 'rania.saad@example.com', balance: 78.25,  status: 'Active', reason: null, notes: null, frozen_at: null, frozen_by: null },
  { user_id: 5,  name: 'Omar Khalil',   email: 'omar.k@example.com',     balance: 12.00,  status: 'Frozen', reason: 'Account Verification Required', notes: 'Government-issued ID verification pending since account creation.',              frozen_at: '2026-05-07T14:00:00', frozen_by: 'Admin User' },
  { user_id: 7,  name: 'Joelle Karam',  email: 'joelle.k@example.com',   balance: 156.75, status: 'Active', reason: null, notes: null, frozen_at: null, frozen_by: null },
  { user_id: 10, name: 'Nour Bitar',    email: 'nour.b@example.com',     balance: 23.00,  status: 'Active', reason: null, notes: null, frozen_at: null, frozen_by: null },
  { user_id: 12, name: 'Tarek Mansour', email: 'tarek.m@example.com',    balance: 89.50,  status: 'Active', reason: null, notes: null, frozen_at: null, frozen_by: null },
];

export const MOCK_FREEZE_LOG = [
  { id: 1, user_id: 1,  user: 'Aline Haddad',  action: 'frozen',   reason: 'Fraud Investigation',          by: 'Admin User', at: '2026-05-08T10:30:00', notes: 'Multiple unverified top-ups' },
  { id: 2, user_id: 5,  user: 'Omar Khalil',   action: 'frozen',   reason: 'Account Verification Required', by: 'Admin User', at: '2026-05-07T14:00:00', notes: 'Awaiting ID docs' },
  { id: 3, user_id: 7,  user: 'Joelle Karam',  action: 'unfrozen', reason: 'Verification completed',        by: 'Admin User', at: '2026-05-06T09:00:00', notes: 'Identity confirmed' },
  { id: 4, user_id: 10, user: 'Nour Bitar',    action: 'frozen',   reason: 'Suspicious Activity',           by: 'Admin User', at: '2026-05-05T16:00:00', notes: 'Reported by staff' },
  { id: 5, user_id: 10, user: 'Nour Bitar',    action: 'unfrozen', reason: 'Investigation cleared',         by: 'Admin User', at: '2026-05-05T18:30:00', notes: 'No fraud found' },
];

// Wallets with balance below $25 threshold — triggers low-balance alerts
export const MOCK_WALLET_LOW_BALANCE_ALERTS = [
  { user_id: 3,  name: 'Rania Saad',    email: 'rania.saad@example.com', balance: 8.50,  last_topup: '2026-04-28', days_since_topup: 12, threshold: 25, notified: false },
  { user_id: 10, name: 'Nour Bitar',    email: 'nour.b@example.com',    balance: 4.25,  last_topup: '2026-04-15', days_since_topup: 25, threshold: 25, notified: true  },
  { user_id: 5,  name: 'Omar Khalil',   email: 'omar.k@example.com',    balance: 12.00, last_topup: '2026-05-02', days_since_topup: 8,  threshold: 25, notified: false },
  { user_id: 12, name: 'Tarek Mansour', email: 'tarek.m@example.com',   balance: 18.75, last_topup: '2026-04-30', days_since_topup: 10, threshold: 25, notified: false },
];

export const MOCK_WALLET_SPEND_SUMMARY = {
  current:  { label: 'May 2026',  total: 284.50, transactions: 38, avg_per_trip: 2.80 },
  previous: { label: 'Apr 2026',  total: 318.20, transactions: 44, avg_per_trip: 2.95 },
  per_passenger: [
    { user_id: 1,  name: 'Aline Haddad',   current: 42.50,  previous: 58.00,  trips_current: 15, trips_previous: 20 },
    { user_id: 3,  name: 'Rania Saad',      current: 8.50,   previous: 24.00,  trips_current: 3,  trips_previous: 8  },
    { user_id: 5,  name: 'Omar Khalil',     current: 7.00,   previous: 9.50,   trips_current: 2,  trips_previous: 3  },
    { user_id: 7,  name: 'Joelle Karam',    current: 125.50, previous: 142.30, trips_current: 41, trips_previous: 48 },
    { user_id: 10, name: 'Nour Bitar',      current: 17.00,  previous: 31.40,  trips_current: 6,  trips_previous: 11 },
    { user_id: 12, name: 'Tarek Mansour',   current: 84.00,  previous: 53.00,  trips_current: 28, trips_previous: 17 },
  ],
};

export const MOCK_DASHBOARD_STATS = {
  totalUsers: 1284,
  activeTrips: 6,
  activeVehicles: 8,
  avgRating: 4.4,
};
