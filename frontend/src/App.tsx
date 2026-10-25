import { useApp } from "./lib/AppContext";
import AppProvider from "./lib/AppProvider";
import SiteLayout from "./components/SiteLayout";
import HomePage from "./pages/HomePage";
import PitchListPage from "./pages/PitchListPage";
import PitchDetailPage from "./pages/PitchDetailPage";
import BookingPage from "./pages/BookingPage";
import PaymentPage from "./pages/PaymentPage";
import CatalogPage from "./pages/CatalogPage";
import AdminSchedulePage from "./pages/AdminSchedulePage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import "./styles/app.css";

function CurrentPage() {
  const { page } = useApp();
  const screens = {
    home: HomePage,
    search: PitchListPage,
    detail: PitchDetailPage,
    booking: BookingPage,
    payment: PaymentPage,
    catalog: CatalogPage,
    schedule: AdminSchedulePage,
    dashboard: DashboardPage,
    login: LoginPage,
    register: RegisterPage,
  };
  const Screen = screens[page];
  return <Screen />;
}

export default function App() {
  return (
    <AppProvider>
      <SiteLayout>
        <CurrentPage />
      </SiteLayout>
    </AppProvider>
  );
}
