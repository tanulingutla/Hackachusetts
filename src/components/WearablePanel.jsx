import { useState } from "react";
import { DEVICES } from "../lib/devices.js";
import DevicePage from "./DevicePage.jsx";

// Import data: every device, always listed. Each name opens that device's own page.
export default function WearablePanel() {
  const [deviceId, setDeviceId] = useState(null);
  const device = DEVICES.find((d) => d.id === deviceId);

  if (device) return <DevicePage device={device} onBack={() => setDeviceId(null)} />;

  return (
    <section className="card" aria-labelledby="devices-list-heading">
      <h2 id="devices-list-heading">Devices</h2>
      <p className="muted">Pick a device to connect it or import its data.</p>
      <ul className="device-pills" role="list">
        {DEVICES.map((d) => (
          <li key={d.id}>
            <button type="button" className="device-pill" onClick={() => setDeviceId(d.id)}>
              {d.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
