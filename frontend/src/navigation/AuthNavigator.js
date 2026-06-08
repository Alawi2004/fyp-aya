import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/auth/SplashScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import PassengerRegisterScreen from '../screens/auth/PassengerRegisterScreen';
import OtpVerifyScreen from '../screens/auth/OtpVerifyScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="PassengerRegister" component={PassengerRegisterScreen} />
    <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </Stack.Navigator>
);

export default AuthNavigator;
