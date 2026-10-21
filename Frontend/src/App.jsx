
import { Routes, Route } from "react-router-dom";

import "./styles/layout.css";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";

import Reports from "./pages/Reports/Reports";
import Dashboard from "./pages/Dashboard/Dashboard";
import Materials from "./pages/Materials/Materials";
import Risks from "./pages/Risks/Risks";
import MaterialDetails from "./pages/MaterialDetails/MaterialDetails";
import RiskDetails from "./pages/RiskDetails/RiskDetails";

function App() {
  return (
    <div className="layout">
      <Sidebar />

      <div className="main">
        <Header />

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />

            <Route path="/materials" element={<Materials />} />

            <Route
              path="/materials/:id"
              element={<MaterialDetails />}
            />

            <Route path="/risks" element={<Risks />} />

            <Route
              path="/risks/:id"
              element={<RiskDetails />}
            />

            <Route path="/reports" element={<Reports />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
