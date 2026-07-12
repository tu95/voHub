import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Icon } from "../components/icons";
import { authStore } from "../stores/auth";

const nav = [
  { to: "/", label: "仪表盘", icon: "dashboard" as const, end: true },
  { to: "/devices", label: "设备管理", icon: "devices" as const },
  { to: "/proxy", label: "代理管理", icon: "proxy" as const },
  { to: "/sms", label: "短信中心", icon: "sms" as const },
  { to: "/logs", label: "实时日志", icon: "logs" as const },
  { to: "/settings", label: "系统设置", icon: "settings" as const },
];

export function Shell() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(
    () => localStorage.getItem("vohub_theme") === "dark",
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("vohub_theme", dark ? "dark" : "light");
  }, [dark]);

  const logout = () => {
    authStore.logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      {mobileOpen && (
        <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">V</span>
          <div>
            <strong>voHub</strong>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="account-card">
            <span className="account-icon"><Icon name="settings" /></span>
            <div><strong>Admin</strong><small>Administrator</small></div>
            <button onClick={logout} aria-label="退出登录">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 6H6.8A1.8 1.8 0 0 0 5 7.8v8.4A1.8 1.8 0 0 0 6.8 18H10m4-3 3-3-3-3m3 3H9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <button className="topbar-menu" onClick={() => setMobileOpen(true)} aria-label="展开菜单">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 7h8M8 12h8M8 17h8" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
          <div className="topbar-actions">
            <button onClick={() => setDark((value) => !value)} aria-label={dark ? "切换亮色" : "切换暗色"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18.5 15.2A7 7 0 0 1 8.8 5.5 7.1 7.1 0 1 0 18.5 15.2Z" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <span className="service-light" title="服务在线" />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
