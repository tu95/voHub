import { type FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authStore } from "../stores/auth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authStore.login(username, password);
      const redirect =
        sessionStorage.getItem("post_login_redirect") ||
        (location.state as { from?: string } | null)?.from ||
        "/";
      sessionStorage.removeItem("post_login_redirect");
      navigate(redirect, { replace: true });
    } catch {
      setError("账号或密码错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-mark">V</span>
          <h1>voHub</h1>
          <p>移动网络设备管理平台</p>
        </div>
        <form onSubmit={submit}>
          <label>
            用户名
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            密码
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </label>
          {error && <div className="notice notice-error">{error}</div>}
          <button
            className="button button-primary login-submit"
            disabled={loading}
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
        <small>voHub © 2026</small>
      </section>
    </main>
  );
}
