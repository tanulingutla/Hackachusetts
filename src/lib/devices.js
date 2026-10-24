// Devices shown in the connect list. Each name opens its own page.
// kind decides what that page offers:
//   csv    - CSV export and import
//   soon   - not supported yet
export const DEVICES = [
  { id: "coros", name: "COROS", kind: "csv" },
  { id: "garmin", name: "Garmin", kind: "csv" },
  { id: "whoop", name: "WHOOP", kind: "csv" },
  { id: "oura", name: "Oura", kind: "csv" },
  { id: "polar", name: "Polar", kind: "csv" },
  { id: "suunto", name: "Suunto", kind: "csv" },
  { id: "amazfit", name: "Amazfit", kind: "csv" },
  { id: "wahoo", name: "Wahoo", kind: "csv" },
  { id: "apple", name: "Apple Health", kind: "soon", note: "Apple Health exports XML, which the importer doesn't read yet." },
  { id: "samsung", name: "Samsung Health", kind: "soon", note: "Samsung Health isn't supported yet." },
  { id: "google", name: "Google Health", kind: "soon", note: "Google Health isn't supported yet." },
  { id: "huawei", name: "Huawei", kind: "soon", note: "Huawei isn't supported yet." },
];

export function findDevice(id) {
  return DEVICES.find((d) => d.id === id) ?? null;
}
