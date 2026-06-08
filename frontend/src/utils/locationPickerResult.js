// Lightweight inter-screen store for MapLocationPicker → TaxiReservation
let _result = null;

export const setPickerResult  = (data) => { _result = data; };
export const getPickerResult  = ()     => _result;
export const clearPickerResult = ()    => { _result = null; };
