import { type FormEvent, useEffect, useState } from "react";
import { Button, Card, Field, Notice, PageHeader } from "../components/ui";
import {
  systemService,
  type NotificationsSettingsResponse,
  type SystemInfo,
} from "../services/system";

export default function Settings() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [notifications, setNotifications] =
    useState<NotificationsSettingsResponse>({});
  const [notice, setNotice] = useState<{
    type: "error" | "success" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    void systemService
      .getInfo()
      .then((result) =>
        result.ok
          ? setInfo(result.data)
          : setNotice({ type: "error", text: result.error.message }),
      );
    void systemService
      .getNotifications()
      .then((result) =>
        result.ok
          ? setNotifications(result.data)
          : setNotice({ type: "error", text: result.error.message }),
      );
  }, []);

  return (
    <>
      <PageHeader
        title="系统设置"
        description="管理服务信息、通知渠道与安全选项"
      />
      {notice && <Notice type={notice.type}>{notice.text}</Notice>}
      <div className="settings-dashboard">
        <SecurityPanel notify={setNotice} />
        <SystemPanel info={info} notify={setNotice} />
        <div className="settings-notifications">
          <NotificationPanel
            value={notifications}
            setValue={setNotifications}
            notify={setNotice}
          />
        </div>
      </div>
    </>
  );
}

function SystemPanel({
  info,
  notify,
}: {
  info: SystemInfo | null;
  notify: (value: { type: "error" | "success" | "info"; text: string }) => void;
}) {
  const [update, setUpdate] = useState<import("../services/system").UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const checkUpdate = async () => {
    setChecking(true);
    const result = await systemService.checkUpdate();
    if (result.ok) {
      setUpdate(result.data);
      notify({
        type: "info",
        text: result.data.has_update
          ? `发现新版本 ${result.data.latest_version}`
          : "当前已是最新版本",
      });
    } else notify({ type: "error", text: result.error.message });
    setChecking(false);
  };
  const applyUpdate = async () => {
    if (!update) return;
    if (update.is_docker) {
      notify({ type: "info", text: "Docker 环境请拉取新镜像并重建容器，不能执行容器内热替换。" });
      return;
    }
    if (!confirm(`更新到 ${update.latest_version} 并重启服务？\n\n${update.release_note}`)) return;
    setApplying(true);
    const result = await systemService.applyUpdate();
    notify(
      result.ok
        ? { type: "success", text: result.data.message || "正在更新…" }
        : { type: "error", text: result.error.message },
    );
    if (result.ok) window.setTimeout(() => window.location.reload(), 5000);
    setApplying(false);
  };
  return (
    <Card className="settings-panel">
      <h2>系统信息</h2>
      <div className="overview-grid">
        <Info label="产品" value="voHub" />
        <Info label="版本" value={info?.version} />
        <Info label="构建时间" value={info?.build_time} />
        <Info label="配置文件" value={info?.config} />
      </div>
      <div className="settings-actions">
        <Button
          onClick={() =>
            info?.docs.swagger_ui && window.open(info.docs.swagger_ui, "_blank")
          }
        >
          打开 API 文档
        </Button>
        <Button
          disabled={checking}
          onClick={() => void checkUpdate()}
        >
          {checking ? "检查中…" : "检查更新"}
        </Button>
        {update?.has_update && (
          <Button variant="primary" disabled={applying} onClick={() => void applyUpdate()}>
            {applying ? "更新中…" : `更新到 ${update.latest_version}`}
          </Button>
        )}
      </div>
      {update?.has_update && update.release_note && (
        <pre className="release-note">{update.release_note}</pre>
      )}
      <div className="license-note">
        <strong>使用许可</strong>
        <p>本项目源代码遵循 PolyForm Noncommercial 1.0.0，仅限非商业用途。</p>
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="info">
      <small>{label}</small>
      <span>{value || "—"}</span>
    </div>
  );
}

function NotificationPanel({
  value,
  setValue,
  notify,
}: {
  value: NotificationsSettingsResponse;
  setValue: (value: NotificationsSettingsResponse) => void;
  notify: (value: { type: "error" | "success" | "info"; text: string }) => void;
}) {
  const [channel, setChannel] = useState<
    "telegram" | "feishu" | "qq" | "bark" | "email" | "pushplus" | "webhook"
  >("telegram");
  const update = (
    key: keyof NotificationsSettingsResponse,
    patch: Record<string, unknown>,
  ) => setValue({ ...value, [key]: { ...(value[key] || {}), ...patch } });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const telegram = value.telegram || {},
      feishu = value.feishu || {},
      qq = value.qq || {},
      email = value.email || {},
      pushplus = value.pushplus || {},
      webhook = value.webhook || {},
      bark = value.bark || {};
    const result = await systemService.saveNotifications({
      telegram: {
        enabled: !!telegram.enabled,
        bot_token: telegram.bot_token || "",
        chat_id: Number(telegram.chat_id || 0),
        admin_id: Number(telegram.admin_id || 0),
        base_url: telegram.base_url || "",
        proxy: telegram.proxy || "",
      },
      feishu: {
        enabled: !!feishu.enabled,
        app_id: feishu.app_id || "",
        app_secret: feishu.app_secret || "",
        chat_ids: feishu.chat_ids || [],
      },
      qq: {
        enabled: !!qq.enabled,
        app_id: qq.app_id || "",
        app_secret: qq.app_secret || "",
        group_ids: qq.group_ids || "",
        direct_ids: qq.direct_ids || "",
      },
      email: {
        enabled: !!email.enabled,
        use_ssl: !!email.use_ssl,
        smtp_host: email.smtp_host || "",
        smtp_port: Number(email.smtp_port || 465),
        username: email.username || "",
        password: email.password || "",
        from_address: email.from_address || "",
        to_addresses: email.to_addresses || [],
      },
      pushplus: {
        enabled: !!pushplus.enabled,
        token: pushplus.token || "",
        topic: pushplus.topic || "",
        channel: pushplus.channel || "",
      },
      webhook: {
        enabled: !!webhook.enabled,
        urls: webhook.urls || [],
        secret: webhook.secret || "",
        timeout_ms: Number(webhook.timeout_ms || 5000),
        retry_max: Number(webhook.retry_max || 2),
        text_template: webhook.text_template || "",
        headers: webhook.headers || {},
      },
      bark: {
        enabled: !!bark.enabled,
        urls: bark.urls || [],
        group: bark.group || "vohub",
        icon: bark.icon || "",
        level: bark.level || "active",
      },
    });
    notify(
      result.ok
        ? { type: "success", text: result.data.warning || "通知配置已保存" }
        : { type: "error", text: result.error.message },
    );
  };
  const testWebhook = async () => {
    const webhook = value.webhook || {};
    const result = await systemService.testWebhook({
      enabled: !!webhook.enabled,
      urls: webhook.urls || [],
      secret: webhook.secret || "",
      timeout_ms: Number(webhook.timeout_ms || 5000),
      retry_max: Number(webhook.retry_max || 2),
      text_template: webhook.text_template || "",
      headers: webhook.headers || {},
    });
    notify(result.ok ? { type: result.data.ok ? "success" : "error", text: result.data.message } : { type: "error", text: result.error.message });
  };
  const testBark = async () => {
    const bark = value.bark || {};
    const result = await systemService.testBark({
      enabled: !!bark.enabled,
      urls: bark.urls || [],
      group: bark.group || "vohub",
      icon: bark.icon || "",
      level: bark.level || "active",
    });
    notify(result.ok ? { type: result.data.ok ? "success" : "error", text: result.data.message } : { type: "error", text: result.error.message });
  };
  const testEmail = async () => {
    const email = value.email || {};
    const result = await systemService.testEmail({
      enabled: !!email.enabled,
      use_ssl: !!email.use_ssl,
      smtp_host: email.smtp_host || "",
      smtp_port: Number(email.smtp_port || 465),
      username: email.username || "",
      password: email.password || "",
      from_address: email.from_address || "",
      to_addresses: email.to_addresses || [],
    });
    notify(result.ok ? { type: result.data.ok ? "success" : "error", text: result.data.message } : { type: "error", text: result.error.message });
  };
  return (
    <Card className="settings-panel">
      <div className="settings-panel-title">
        <div><h2>通知</h2><small>Telegram / 飞书 / QQ / Webhook</small></div>
      </div>
      <form onSubmit={save} className="notification-sections">
        <div className="notification-tabs">
          {([
            ["telegram", "Telegram Bot"], ["feishu", "飞书 Bot"], ["qq", "QQ Bot"],
            ["bark", "Bark"], ["email", "Email"], ["pushplus", "Pushplus"], ["webhook", "Webhook"],
          ] as const).map(([key, label]) => (
            <button type="button" key={key} className={channel === key ? "active" : ""} onClick={() => setChannel(key)}>{label}</button>
          ))}
        </div>
        {channel === "telegram" && (
        <Channel
          title="Telegram"
          enabled={!!value.telegram?.enabled}
          onToggle={(enabled) => update("telegram", { enabled })}
        >
          <Field label="Bot Token">
            <input
              type="password"
              value={value.telegram?.bot_token || ""}
              onChange={(e) =>
                update("telegram", { bot_token: e.target.value })
              }
            />
          </Field>
          <Field label="Chat ID">
            <input
              value={value.telegram?.chat_id ?? ""}
              onChange={(e) =>
                update("telegram", { chat_id: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Admin ID">
            <input
              value={value.telegram?.admin_id ?? ""}
              onChange={(e) => update("telegram", { admin_id: Number(e.target.value) })}
            />
          </Field>
          <Field label="API Base URL">
            <input
              value={value.telegram?.base_url || ""}
              onChange={(e) => update("telegram", { base_url: e.target.value })}
            />
          </Field>
          <Field label="代理">
            <input
              value={value.telegram?.proxy || ""}
              onChange={(e) => update("telegram", { proxy: e.target.value })}
            />
          </Field>
        </Channel>
        )}
        {channel === "email" && (
        <Channel
          title="Email"
          enabled={!!value.email?.enabled}
          onToggle={(enabled) => update("email", { enabled })}
        >
          <Field label="SMTP 服务器">
            <input
              value={value.email?.smtp_host || ""}
              onChange={(e) => update("email", { smtp_host: e.target.value })}
            />
          </Field>
          <Field label="端口">
            <input
              type="number"
              value={value.email?.smtp_port || 465}
              onChange={(e) =>
                update("email", { smtp_port: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="用户名">
            <input
              value={value.email?.username || ""}
              onChange={(e) => update("email", { username: e.target.value })}
            />
          </Field>
          <Field label="密码">
            <input
              type="password"
              value={value.email?.password || ""}
              onChange={(e) => update("email", { password: e.target.value })}
            />
          </Field>
          <Field label="收件人（逗号分隔）">
            <input
              value={(value.email?.to_addresses || []).join(",")}
              onChange={(e) =>
                update("email", {
                  to_addresses: e.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="发件人">
            <input
              value={value.email?.from_address || ""}
              onChange={(e) => update("email", { from_address: e.target.value })}
            />
          </Field>
          <label className="check-row">
            <input
              type="checkbox"
              checked={!!value.email?.use_ssl}
              onChange={(e) => update("email", { use_ssl: e.target.checked })}
            />
            SSL/TLS
          </label>
          <Button type="button" onClick={() => void testEmail()}>发送测试邮件</Button>
        </Channel>
        )}
        {channel === "webhook" && (
        <Channel
          title="Webhook"
          enabled={!!value.webhook?.enabled}
          onToggle={(enabled) => update("webhook", { enabled })}
        >
          <Field label="URL（每行一个）">
            <textarea
              rows={3}
              value={(value.webhook?.urls || []).join("\n")}
              onChange={(e) =>
                update("webhook", {
                  urls: e.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="Secret">
            <input
              type="password"
              value={value.webhook?.secret || ""}
              onChange={(e) => update("webhook", { secret: e.target.value })}
            />
          </Field>
          <Field label="超时 (ms)">
            <input
              type="number"
              value={value.webhook?.timeout_ms || 5000}
              onChange={(e) => update("webhook", { timeout_ms: Number(e.target.value) })}
            />
          </Field>
          <Field label="重试次数">
            <input
              type="number"
              value={value.webhook?.retry_max || 2}
              onChange={(e) => update("webhook", { retry_max: Number(e.target.value) })}
            />
          </Field>
          <Field label="文本模板">
            <textarea
              value={value.webhook?.text_template || ""}
              onChange={(e) => update("webhook", { text_template: e.target.value })}
            />
          </Field>
          <Button type="button" onClick={() => void testWebhook()}>发送测试 Webhook</Button>
        </Channel>
        )}
        {channel === "bark" && (
        <Channel
          title="Bark"
          enabled={!!value.bark?.enabled}
          onToggle={(enabled) => update("bark", { enabled })}
        >
          <Field label="URL（每行一个）">
            <textarea
              rows={3}
              value={(value.bark?.urls || []).join("\n")}
              onChange={(e) =>
                update("bark", {
                  urls: e.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <Field label="Group">
            <input
              value={value.bark?.group || "vohub"}
              onChange={(e) => update("bark", { group: e.target.value })}
            />
          </Field>
          <Field label="Icon">
            <input
              value={value.bark?.icon || ""}
              onChange={(e) => update("bark", { icon: e.target.value })}
            />
          </Field>
          <Field label="级别">
            <select
              value={value.bark?.level || "active"}
              onChange={(e) => update("bark", { level: e.target.value })}
            >
              <option value="active">active</option>
              <option value="timeSensitive">timeSensitive</option>
              <option value="passive">passive</option>
            </select>
          </Field>
          <Button type="button" onClick={() => void testBark()}>发送测试 Bark</Button>
        </Channel>
        )}
        {channel === "feishu" && (
        <Channel
          title="飞书 / Lark"
          enabled={!!value.feishu?.enabled}
          onToggle={(enabled) => update("feishu", { enabled })}
        >
          <Field label="App ID">
            <input
              value={value.feishu?.app_id || ""}
              onChange={(e) => update("feishu", { app_id: e.target.value })}
            />
          </Field>
          <Field label="App Secret">
            <input
              type="password"
              value={value.feishu?.app_secret || ""}
              onChange={(e) => update("feishu", { app_secret: e.target.value })}
            />
          </Field>
          <Field label="Chat ID（逗号分隔）">
            <input
              value={(value.feishu?.chat_ids || []).join(",")}
              onChange={(e) =>
                update("feishu", {
                  chat_ids: e.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
        </Channel>
        )}
        {channel === "qq" && (
        <Channel
          title="QQ"
          enabled={!!value.qq?.enabled}
          onToggle={(enabled) => update("qq", { enabled })}
        >
          <Field label="App ID">
            <input
              value={value.qq?.app_id || ""}
              onChange={(e) => update("qq", { app_id: e.target.value })}
            />
          </Field>
          <Field label="App Secret">
            <input
              type="password"
              value={value.qq?.app_secret || ""}
              onChange={(e) => update("qq", { app_secret: e.target.value })}
            />
          </Field>
          <Field label="群 ID">
            <input
              value={value.qq?.group_ids || ""}
              onChange={(e) => update("qq", { group_ids: e.target.value })}
            />
          </Field>
          <Field label="私聊 ID">
            <input
              value={value.qq?.direct_ids || ""}
              onChange={(e) => update("qq", { direct_ids: e.target.value })}
            />
          </Field>
        </Channel>
        )}
        {channel === "pushplus" && (
        <Channel
          title="PushPlus"
          enabled={!!value.pushplus?.enabled}
          onToggle={(enabled) => update("pushplus", { enabled })}
        >
          <Field label="Token">
            <input
              type="password"
              value={value.pushplus?.token || ""}
              onChange={(e) => update("pushplus", { token: e.target.value })}
            />
          </Field>
          <Field label="Topic">
            <input
              value={value.pushplus?.topic || ""}
              onChange={(e) => update("pushplus", { topic: e.target.value })}
            />
          </Field>
          <Field label="Channel">
            <input
              value={value.pushplus?.channel || ""}
              onChange={(e) => update("pushplus", { channel: e.target.value })}
            />
          </Field>
        </Channel>
        )}
        <div className="form-actions">
          <Button variant="primary">保存通知设置</Button>
        </div>
      </form>
    </Card>
  );
}

function Channel({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="channel">
      <header>
        <h3>{title}</h3>
        <label className="switch">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span />
          {enabled ? "已启用" : "已关闭"}
        </label>
      </header>
      {enabled && <div className="form-grid two-columns">{children}</div>}
    </section>
  );
}

function SecurityPanel({
  notify,
}: {
  notify: (value: { type: "error" | "success" | "info"; text: string }) => void;
}) {
  const [oldPassword, setOldPassword] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await systemService.changePassword({
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    notify(
      result.ok
        ? { type: "success", text: "密码已更新" }
        : { type: "error", text: result.error.message },
    );
    if (result.ok) {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };
  return (
    <Card className="settings-panel">
      <h2>修改密码</h2>
      <form className="password-form" onSubmit={submit}>
        <Field label="当前密码">
          <input
            type="password"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
        </Field>
        <Field label="新密码">
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>
        <Field label="确认新密码">
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Field>
        <Button
          variant="primary"
          disabled={!newPassword || newPassword !== confirmPassword}
        >
          更新密码
        </Button>
      </form>
    </Card>
  );
}
