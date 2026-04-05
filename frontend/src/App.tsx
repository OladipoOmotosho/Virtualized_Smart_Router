import { NavLink, Route, Routes } from "react-router-dom";
import { Shield, Wifi, Camera, Lock, BarChart2 } from "lucide-react";
import DevicesPage from "@/pages/DevicesPage";
import CapturePage from "@/pages/CapturePage";
import FirewallPage from "@/pages/FirewallPage";
import IpsPage from "@/pages/IpsPage";
import LogsPage from "@/pages/LogsPage";

const NAV = [
  { to: "/", label: "Devices", icon: Wifi },
  { to: "/capture", label: "Capture", icon: Camera },
  { to: "/firewall", label: "Firewall", icon: Lock },
  { to: "/ips", label: "IPS", icon: Shield },
  { to: "/logs", label: "Logs", icon: BarChart2 },
];

export default function App() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-700">
          <h1 className="text-lg font-semibold">IoT Gateway</h1>
          <p className="text-xs text-gray-400 mt-0.5">Security Dashboard</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        <Routes>
          <Route path="/" element={<DevicesPage />} />
          <Route path="/capture" element={<CapturePage />} />
          <Route path="/firewall" element={<FirewallPage />} />
          <Route path="/ips" element={<IpsPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </main>
    </div>
  );
}
