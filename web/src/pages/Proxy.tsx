import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Empty,
  Field,
  Modal,
  Notice,
  PageHeader,
  StatusDot,
} from "../components/ui";
import { useAsyncData } from "../hooks";
import { proxyService } from "../services/proxy";
import { upstreamProxyService } from "../services/upstream-proxy";
import type {
  ProxyInstance,
  UpstreamProxy,
  UpstreamProxyCountry,
  UpstreamProxyCountryRule,
} from "../types/api";

const blank: ProxyInstance = {
  id: "",
  name: "",
  device_id: "",
  enabled: true,
  mode: "socks5",
  listen_addr: "0.0.0.0",
  listen_port: 1080,
  auth_enabled: false,
  username: "",
  password: "",
};

export default function Proxy() {
  const state = useAsyncData(() => proxyService.overview(), []);
  const [editing, setEditing] = useState<ProxyInstance | null>(null);
  const [notice, setNotice] = useState("");
  const statuses = useMemo(
    () => new Map((state.data?.status || []).map((item) => [item.id, item])),
    [state.data],
  );

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || !state.data) return;
    const instances = state.data.instances.filter(
      (item) => item.id !== editing.id,
    );
    instances.push({ ...editing, id: editing.id || `proxy-${Date.now()}` });
    const result = await proxyService.saveConfig(instances);
    if (result.ok) {
      setEditing(null);
      setNotice("代理配置已保存");
      await state.reload();
    }
  };
  const act = async (id: string, action: "start" | "stop" | "restart") => {
    const result =
      action === "start"
        ? await proxyService.startInstance(id)
        : action === "stop"
          ? await proxyService.stopInstance(id)
          : await proxyService.restartInstance(id);
    if (!result.ok) setNotice(result.error.message);
    await state.reload();
  };

  return (
    <>
      <PageHeader
        title="代理服务"
        description="管理按移动网卡绑定的 SOCKS5 与 HTTP 代理"
        actions={
          <>
            <Button onClick={() => void state.reload()}>刷新</Button>
            <Button variant="primary" onClick={() => setEditing({ ...blank })}>
              新建实例
            </Button>
          </>
        }
      />
      {(state.error || notice) && (
        <Notice type={state.error ? "error" : "success"}>
          {state.error || notice}
        </Notice>
      )}
      <div className="section-title">
        <h2>出口代理实例</h2>
      </div>
      {!state.loading && !state.data?.instances.length ? (
        <Empty title="暂无代理实例" />
      ) : (
        <div className="proxy-grid">
          {state.data?.instances.map((instance) => {
            const status = statuses.get(instance.id);
            return (
              <Card key={instance.id} className="proxy-card">
                <header>
                  <div>
                    <h2>{instance.name}</h2>
                    <code>
                      {instance.mode.toUpperCase()} · {instance.listen_addr}:
                      {instance.listen_port}
                    </code>
                  </div>
                  <StatusDot
                    ok={status?.running === true}
                    label={status?.running ? "运行中" : "已停止"}
                  />
                </header>
                <dl>
                  <div>
                    <dt>绑定设备</dt>
                    <dd>
                      {state.data?.devices.find(
                        (item) => item.id === instance.device_id,
                      )?.name || instance.device_id}
                    </dd>
                  </div>
                  <div>
                    <dt>认证</dt>
                    <dd>{instance.auth_enabled ? instance.username : "无"}</dd>
                  </div>
                  {status?.last_error && (
                    <div className="wide">
                      <dt>最近错误</dt>
                      <dd>{status.last_error}</dd>
                    </div>
                  )}
                </dl>
                <footer>
                  <Button onClick={() => setEditing({ ...instance })}>
                    编辑
                  </Button>
                  {status?.running ? (
                    <>
                      <Button onClick={() => void act(instance.id, "restart")}>
                        重启
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => void act(instance.id, "stop")}
                      >
                        停止
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => void act(instance.id, "start")}
                    >
                      启动
                    </Button>
                  )}
                </footer>
              </Card>
            );
          })}
        </div>
      )}
      <UpstreamPanel onError={setNotice} />
      {editing && (
        <Modal
          title={editing.id ? "编辑代理实例" : "新建代理实例"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>取消</Button>
              <Button variant="primary" type="submit" form="proxy-form">
                保存
              </Button>
            </>
          }
        >
          <form id="proxy-form" className="form-grid" onSubmit={save}>
            <Field label="名称">
              <input
                required
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </Field>
            <Field label="绑定设备">
              <select
                required
                value={editing.device_id}
                onChange={(event) =>
                  setEditing({ ...editing, device_id: event.target.value })
                }
              >
                <option value="">请选择</option>
                {state.data?.devices.map((device) => (
                  <option value={device.id} key={device.id}>
                    {device.name} ({device.interface})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="协议">
              <select
                value={editing.mode}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    mode: event.target.value as "socks5" | "http",
                  })
                }
              >
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
              </select>
            </Field>
            <Field label="监听地址">
              <input
                value={editing.listen_addr}
                onChange={(event) =>
                  setEditing({ ...editing, listen_addr: event.target.value })
                }
              />
            </Field>
            <Field label="监听端口">
              <input
                type="number"
                min={1}
                max={65535}
                value={editing.listen_port}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    listen_port: Number(event.target.value),
                  })
                }
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={editing.auth_enabled}
                onChange={(event) =>
                  setEditing({ ...editing, auth_enabled: event.target.checked })
                }
              />
              启用账号认证
            </label>
            {editing.auth_enabled && (
              <>
                <Field label="用户名">
                  <input
                    value={editing.username}
                    onChange={(event) =>
                      setEditing({ ...editing, username: event.target.value })
                    }
                  />
                </Field>
                <Field label="密码">
                  <input
                    type="password"
                    value={editing.password || ""}
                    onChange={(event) =>
                      setEditing({ ...editing, password: event.target.value })
                    }
                  />
                </Field>
              </>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}

const blankUpstream: UpstreamProxy = {
  id: "",
  name: "",
  addr: "",
  username: "",
  password: "",
  enabled: true,
};

function UpstreamPanel({ onError }: { onError: (value: string) => void }) {
  const [items, setItems] = useState<UpstreamProxy[]>([]);
  const [countries, setCountries] = useState<UpstreamProxyCountry[]>([]);
  const [rules, setRules] = useState<UpstreamProxyCountryRule[]>([]);
  const [editing, setEditing] = useState<UpstreamProxy | null>(null);
  const load = async () => {
    const [proxyResult, countryResult, ruleResult] = await Promise.all([
      upstreamProxyService.list(),
      upstreamProxyService.listCountries(),
      upstreamProxyService.listCountryRules(),
    ]);
    if (proxyResult.ok) setItems(proxyResult.data);
    else onError(proxyResult.error.message);
    if (countryResult.ok) setCountries(countryResult.data);
    if (ruleResult.ok) setRules(ruleResult.data);
  };
  useEffect(() => {
    void load();
  }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const result = editing.id
      ? await upstreamProxyService.update(editing.id, editing)
      : await upstreamProxyService.create({
          ...editing,
          id: `upstream-${Date.now()}`,
        });
    if (!result.ok) onError(result.error.message);
    else {
      setEditing(null);
      await load();
    }
  };
  return (
    <div className="upstream-section">
      <div className="section-title">
        <h2>VoWiFi 前置 SOCKS5</h2>
        <Button onClick={() => setEditing({ ...blankUpstream })}>
          添加前置代理
        </Button>
      </div>
      <div className="proxy-grid">
        {items.map((item) => (
          <Card className="upstream-card" key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <code>{item.addr}</code>
            </div>
            <StatusDot
              ok={item.enabled}
              label={item.enabled ? "已启用" : "已停用"}
            />
            <footer>
              <Button onClick={() => setEditing({ ...item })}>编辑</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm("删除该前置代理？")) return;
                  const result = await upstreamProxyService.remove(item.id);
                  if (!result.ok) onError(result.error.message);
                  else await load();
                }}
              >
                删除
              </Button>
            </footer>
          </Card>
        ))}
      </div>
      <Card className="country-rules">
        <h3>国家路由规则</h3>
        {countries.map((country) => {
          const rule = rules.find(
            (item) => item.country_code === country.country_code,
          );
          return (
            <div key={country.country_code}>
              <span>
                {country.country_name} <small>{country.mccs.join(", ")}</small>
              </span>
              <select
                value={rule?.upstream_proxy_id || ""}
                onChange={async (event) => {
                  const proxyId = event.target.value;
                  const result = proxyId
                    ? await upstreamProxyService.upsertCountryRule(
                        country.country_code,
                        { upstream_proxy_id: proxyId, enabled: true },
                      )
                    : await upstreamProxyService.deleteCountryRule(
                        country.country_code,
                      );
                  if (!result.ok) onError(result.error.message);
                  else await load();
                }}
              >
                <option value="">直连</option>
                {items
                  .filter((item) => item.enabled)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </div>
          );
        })}
      </Card>
      {editing && (
        <Modal
          title={editing.id ? "编辑前置代理" : "添加前置代理"}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>取消</Button>
              <Button variant="primary" form="upstream-form">
                保存
              </Button>
            </>
          }
        >
          <form id="upstream-form" onSubmit={save} className="form-grid">
            <Field label="名称">
              <input
                required
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </Field>
            <Field label="SOCKS5 地址" hint="host:port">
              <input
                required
                value={editing.addr}
                onChange={(event) =>
                  setEditing({ ...editing, addr: event.target.value })
                }
              />
            </Field>
            <Field label="用户名">
              <input
                value={editing.username}
                onChange={(event) =>
                  setEditing({ ...editing, username: event.target.value })
                }
              />
            </Field>
            <Field label="密码">
              <input
                type="password"
                value={editing.password || ""}
                onChange={(event) =>
                  setEditing({ ...editing, password: event.target.value })
                }
              />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(event) =>
                  setEditing({ ...editing, enabled: event.target.checked })
                }
              />
              启用
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
}
