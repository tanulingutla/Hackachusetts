import CsvImport from "./CsvImport.jsx";

// One page per device. Each shows only what applies to that device, under the device's own name.
export default function DevicePage({ device, onBack }) {
  return (
    <div className="stack">
      <div className="device-page-head">
        <button type="button" className="link-button" onClick={onBack}>
          Back to devices
        </button>
        <h2 className="device-page-title">{device.name}</h2>
      </div>

      {device.kind === "csv" && (
        <CsvImport
          title={`Import from ${device.name}`}
          intro={`Export your daily data as CSV from the ${device.name} app or website, if it's offered. Then upload the file here.`}
        />
      )}

      {device.kind === "soon" && (
        <section className="card">
          <h3>{device.name}</h3>
          <p className="muted">{device.note}</p>
        </section>
      )}
    </div>
  );
}
