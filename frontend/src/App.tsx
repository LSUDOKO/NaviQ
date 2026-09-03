import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout";
import AboutPage from "./pages/AboutPage";
import CompliancePage from "./pages/CompliancePage";
import DashboardPage from "./pages/DashboardPage";
import FleetPage from "./pages/FleetPage";
import OptimizationPage from "./pages/OptimizationPage";
import PredictionPage from "./pages/PredictionPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="prediction" element={<PredictionPage />} />
          <Route path="optimization" element={<OptimizationPage />} />
          <Route path="compliance" element={<CompliancePage />} />
          <Route path="fleet" element={<FleetPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
