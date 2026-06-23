// Nominatim (OpenStreetMap) geocoding — confirms a place name resolves to a
// real, existing location before we let anything (chatbot, taxi booking) use it.
export const nominatimGeocode = async (query, { countryCodes = "lb" } = {}) => {
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      addressdetails: "0",
    });
    if (countryCodes) params.set("countrycodes", countryCodes);

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FYP-AYA Transit App (student project)", "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat:           parseFloat(data[0].lat),
      lng:           parseFloat(data[0].lon),
      display_name:  data[0].display_name ?? null,
    };
  } catch {
    return null;
  }
};
