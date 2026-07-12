import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./layouts/Shell";
import { authStore } from "./stores/auth";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Devices = lazy(() => import("./pages/Devices"));
const Proxy = lazy(() => import("./pages/Proxy"));
const Sms = lazy(() => import("./pages/Sms"));
const Logs = lazy(() => import("./pages/Logs"));
const Settings = lazy(() => import("./pages/Settings"));
const DISCLAIMER_KEY = "vohive_disclaimer_agreed_at";
const DISCLAIMER_INTERVAL = 7 * 24 * 60 * 60 * 1000;

function Protected() {
  const location = useLocation();
  const authenticated = useSyncExternalStore(
    authStore.subscribe,
    authStore.isAuthenticated,
    authStore.isAuthenticated,
  );
  return authenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  );
}

export default function App() {
  const authenticated = useSyncExternalStore(
    authStore.subscribe,
    authStore.isAuthenticated,
    authStore.isAuthenticated,
  );
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [manualConfirmation, setManualConfirmation] = useState(true);
  useEffect(() => {
    if (!authenticated) {
      setDisclaimerOpen(false);
      return;
    }
    const stored = localStorage.getItem(DISCLAIMER_KEY);
    const agreedAt = stored === null ? null : Number(stored);
    if (agreedAt === null || Number.isNaN(agreedAt) || Date.now() - agreedAt >= DISCLAIMER_INTERVAL) {
      setConfirmation("");
      setManualConfirmation(agreedAt === null || Number.isNaN(agreedAt));
      setDisclaimerOpen(true);
    }
  }, [authenticated]);
  const acceptDisclaimer = () => {
    if (manualConfirmation && confirmation !== "我同意并确认") return;
    localStorage.setItem(DISCLAIMER_KEY, String(Date.now()));
    setDisclaimerOpen(false);
  };
  const rejectDisclaimer = () => {
    if (!window.confirm("拒绝协议将立即卸载 voHub，确定继续吗？")) return;
    void fetch("/api/system/uninstall", {
      method: "POST",
      headers: { Authorization: `Bearer ${authStore.getToken()}` },
    }).finally(() => {
      document.body.innerHTML =
        '<div style="display:grid;height:100vh;background:#0a0a0a;place-items:center;font:700 24px sans-serif;color:#ef4444">软件已被卸载 / 服务已终止</div>';
    });
  };
  return (
    <Suspense
      fallback={
        <div className="app-loading">
          <span className="spinner" />
          正在加载 voHub…
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Protected />}>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="devices" element={<Devices />} />
            <Route path="proxy" element={<Proxy />} />
            <Route path="sms" element={<Sms />} />
            <Route path="logs" element={<Logs />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {disclaimerOpen && (
        <div className="disclaimer-overlay">
          <section className="disclaimer-dialog">
            <div className="disclaimer-accent" aria-hidden="true" />
            <div className="disclaimer-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 9v3.5m0 3.5h.01M10.3 4.9 3.6 16.5A2 2 0 0 0 5.3 19h13.4a2 2 0 0 0 1.7-2.5L13.7 4.9a2 2 0 0 0-3.4 0Z" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>voHub 最终用户许可与免责声明</h2>
            <div className="disclaimer-body">
              <div className="disclaimer-item">
                <span>1</span>
                <p>本软件（voHub）属于个人开发者业余时间开发的工具软件，仅供技术研究、学习交流和个人内部测试使用。<strong className="emphasis-primary">严禁用于任何商业用途</strong>，严禁作为生产环境的基础设施。</p>
              </div>
              <div className="disclaimer-item">
                <span>2</span>
                <p>使用者承诺将严格遵守所在国家或地区的相关法律法规。<strong className="emphasis-danger">严禁将本软件用于电信诈骗、垃圾短信发送、非法网络代理、渗透测试等任何非法或违规场景。</strong></p>
              </div>
              <div className="disclaimer-item">
                <span>3</span>
                <p>本软件涉及底层 Modem 通信操作，可能包含未知缺陷。对于因使用本软件引发的硬件损坏、通信资费异常、隐私泄露等直接或间接损失，<strong>由使用者自行承担所有责任。</strong></p>
              </div>
              <div className="disclaimer-item">
                <span>4</span>
                <p>一旦点击继续即表示无条件接受本协议。如果您拒绝，本软件将立即触发自毁与环境清理机制以确保设备安全。</p>
              </div>
            </div>
            <div className="disclaimer-footer">
              <p>
                {manualConfirmation ? "请输入" : "本次为周期性确认，点击"}「<strong>我同意并确认</strong>」
                {manualConfirmation ? "以解锁按钮" : "即可继续"}
              </p>
              {manualConfirmation && (
                <input
                  aria-label="确认文本"
                  value={confirmation}
                  onPaste={(event) => event.preventDefault()}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="请输入：我同意并确认"
                  autoComplete="off"
                />
              )}
              <div className="disclaimer-actions">
                <button onClick={rejectDisclaimer}>拒绝并卸载</button>
                <button
                  className="primary"
                  disabled={manualConfirmation && confirmation !== "我同意并确认"}
                  onClick={acceptDisclaimer}
                >
                  {manualConfirmation ? "同意并继续" : "我同意并确认"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </Suspense>
  );
}
