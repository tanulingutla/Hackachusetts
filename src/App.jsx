import { useState } from "react";
import ActivitiesPanel from "./components/ActivitiesPanel.jsx";
import CalendarPanel from "./components/CalendarPanel.jsx";
import DevicePage from "./components/DevicePage.jsx";
import HomeDashboard from "./components/HomeDashboard.jsx";
import InsightsPanel from "./components/InsightsPanel.jsx";
import LoadPanel from "./components/LoadPanel.jsx";
import NutritionPanel from "./components/NutritionPanel.jsx";
import PerformancePanel from "./components/PerformancePanel.jsx";
import RmrPanel from "./components/RmrPanel.jsx";
import PeriodPanel from "./components/PeriodPanel.jsx";
import ProfilePanel from "./components/ProfilePanel.jsx";
import SharePanel from "./components/SharePanel.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TodayPanel from "./components/TodayPanel.jsx";
import TrendsPanel from "./components/TrendsPanel.jsx";
import WearablePanel from "./components/WearablePanel.jsx";
import { ALL_ITEMS } from "./lib/nav.js";
import { findDevice } from "./lib/devices.js";
import SportsSketch from "./components/SportsSketch.jsx";

// Signed-in shell: left navigation plus the selected page. The API enforces data ownership.
export default function App({ user, onUserChange, onSignOut }) {
  const [active, setActive] = useState("home");
  const [deviceId, setDeviceId] = useState(null);
  const item = ALL_ITEMS.find((i) => i.id === active);

  // Choosing a sidebar item always leaves any open device page.
  function selectSection(id) {
    setDeviceId(null);
    setActive(id);
  }

  function renderHome() {
    const device = findDevice(deviceId);
    if (device) return <DevicePage device={device} onBack={() => setDeviceId(null)} />;
    return (
      <>
        <HomeDashboard user={user} onNavigate={selectSection} onSelectDevice={setDeviceId} />
        <TodayPanel />
      </>
    );
  }

  function renderPage() {
    switch (active) {
      case "home":
        return renderHome();
      case "calendar":
        return <CalendarPanel onNavigate={selectSection} />;
      case "activities":
        return <ActivitiesPanel />;
      case "import":
        return <WearablePanel />;
      case "health":
        return <TrendsPanel />;
      case "period":
        return <PeriodPanel user={user} />;
      case "nutrition":
        return <NutritionPanel user={user} />;
      case "performance":
        return <PerformancePanel />;
      case "load":
        return <LoadPanel />;
      case "rmr":
        return <RmrPanel user={user} onUserChange={onUserChange} />;
      case "insights":
        return <InsightsPanel />;
      case "reports":
        return <SharePanel />;
      case "profile":
        return <ProfilePanel user={user} onUserChange={onUserChange} />;
      default:
        return <TodayPanel />;
    }
  }

  return (
    <div className="shell">
      <Sidebar active={active} onSelect={selectSection} userName={user.displayName || user.username} />
      <main className="content">
        <div className="app-topbar">
          <span className="muted">Signed in as {user.displayName || user.username}</span>
          <button type="button" className="signout-button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
        <div className="page-banner" aria-hidden="true">
          <SportsSketch
            viewBox="0 100 1200 260"
            preserveAspectRatio="xMidYMid meet"
            className="sports-sketch page-banner-sketch"
          />
        </div>
        <h1 className="page-title">{item?.label ?? "Home"}</h1>
        {renderPage()}
      </main>
    </div>
  );
}
