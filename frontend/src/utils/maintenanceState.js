/**
 * Maintenance-mode event bridge
 *
 * A plain module-level notifier so the Axios interceptor (which has no
 * React context access) can signal the navigation tree when the backend
 * returns HTTP 503 + code: "MAINTENANCE_MODE".
 *
 * Usage:
 *   // interceptor — sets the listener's state
 *   import { triggerMaintenance } from '../utils/maintenanceState';
 *   triggerMaintenance(error.response.data);
 *
 *   // AppNavigator — registers once on mount
 *   import { setMaintenanceListener, clearMaintenanceListener } from '../utils/maintenanceState';
 *   useEffect(() => {
 *     setMaintenanceListener((data) => setMaintenance(data));
 *     return () => clearMaintenanceListener();
 *   }, []);
 */

let _listener = null;

export function setMaintenanceListener(fn) {
  _listener = fn;
}

export function clearMaintenanceListener() {
  _listener = null;
}

export function triggerMaintenance(data) {
  _listener?.(data);
}
