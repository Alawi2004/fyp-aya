import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import AuthNavigator from './AuthNavigator';
import PassengerNavigator from './PassengerNavigator';
import DriverNavigator from './DriverNavigator';
import Loader from '../components/common/Loader';

const AppNavigator = () => {
  const { user, loading, role } = useAuth();

  if (loading) return <Loader />;

  return (
    <NavigationContainer>
      {!user ? <AuthNavigator /> : role === 'driver' ? <DriverNavigator /> : <PassengerNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator;