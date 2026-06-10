import AsyncStorage from '@react-native-async-storage/async-storage';

export const storeData = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) { console.error(e); }
};

export const getData = async (key) => {
  try {
    const val = await AsyncStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  } catch (e) { return null; }
};

export const removeData = async (key) => {
  try { await AsyncStorage.removeItem(key); } catch (e) {}
};