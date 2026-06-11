import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sun, Moon } from "@phosphor-icons/react";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { SharedReport } from "./pages/SharedReport";
import { PublicProfile } from "./pages/PublicProfile";
import { ChallengePage } from "./pages/ChallengePage";
import { Login } from "./pages/Login";
import { ReportsPage } from "./pages/ReportsPage";
import { AchievementsPage } from "./pages/AchievementsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SharePage } from "./pages/SharePage";
import { SettingsPage } from "./pages/SettingsPage";
import { LandingPage } from "./pages/LandingPage";
import { useAuth } from "./context/AuthContext";
import "./index.css";

function IndexRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <LandingPage />
  );
}

// ── Theme hook — persisted in localStorage ────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = localStorage.getItem("gr-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("gr-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, toggle };
}

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <BrowserRouter>
      {/* AuthProvider inside BrowserRouter so it can useNavigate */}
      <AuthProvider>
        <Routes>
          {/* ── Public routes — no auth, no sidebar ─────────────────────── */}
          <Route path="/" element={<IndexRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/u/:username" element={<PublicProfile />} />
          <Route path="/u/:username/:period" element={<SharedReport />} />
          <Route
            path="/challenge/:username/:period"
            element={<ChallengePage />}
          />

          {/* ── Authenticated app shell — sidebar + main ─────────────────── */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div
                  className="flex min-h-screen bg-[#090909]"
                >
                  <Sidebar />
                  <main className="flex-1 ml-[260px] relative">
                    {/* Theme toggle — top-right corner */}
                    <button
                      id="theme-toggle"
                      onClick={toggle}
                      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                      className="fixed top-4 right-5 z-50 flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.borderColor = "var(--border-strong)";
                        (e.currentTarget as HTMLButtonElement).style.color =
                          "var(--text-primary)";
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.borderColor = "var(--border-default)";
                        (e.currentTarget as HTMLButtonElement).style.color =
                          "var(--text-secondary)";
                      }}
                    >
                      {theme === "dark" ? (
                        <Sun size={15} weight="duotone" />
                      ) : (
                        <Moon size={15} weight="duotone" />
                      )}
                    </button>

                    <Routes>
                      <Route path="/" element={<Navigate replace to="/dashboard" />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/achievements" element={<AchievementsPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/share" element={<SharePage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                  </main>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
