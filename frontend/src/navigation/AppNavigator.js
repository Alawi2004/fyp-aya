import React, { useState, useEffect, useCallback } from 'react';
import { NavigationContainer }   from '@react-navigation/native';
import { useAuth }               from '../context/AuthContext';
import AuthNavigator             from './AuthNavigator';
import PassengerNavigator        from './PassengerNavigator';
import DriverNavigator           from './DriverNavigator';
import Loader                    from '../components/common/Loader';
import MaintenanceScreen         from '../screens/MaintenanceScreen';
import {
  setMaintenanceListener,
  clearMaintenanceListener,
} from '../utils/maintenanceState';
import apiClient from '../api/apiClient';

const AppNavigator = () => {
  const { user, loading, role } = useAuth();
  const [maintenance, setMaintenance] = useState(null);
  // maintenance = null (normal) | { message, error } (503 response data)

  // Register the module-level listener so the Axios interceptor can
  // set maintenance mode from outside React's tree.
  useEffect(() => {
    setMaintenanceListener((data) => setMaintenance(data));
    return () => clearMaintenanceListener();
  }, []);

  // Retry: send a lightweight ping; on success clear maintenance state.
  const handleRetry = useCallback(async () => {
    try {
      await apiClient.get('/health');
      setMaintenance(null);
    } catch (err) {
      // If it's still a 503 MAINTENANCE_MODE the interceptor will call
      // triggerMaintenance again, which re-sets maintenance state.
      // For any other error (network down, etc.) just clear so the user
      // can try navigating again.
      if (err?.response?.status !== 503) setMaintenance(null);
    }
  }, []);

  if (loading) return <Loader />;

  if (maintenance) {
    return (
      <MaintenanceScreen
        message={maintenance.message}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <NavigationContainer>
      {!user
        ? <AuthNavigator />
        : role === 'driver'
          ? <DriverNavigator />
          : <PassengerNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator;
