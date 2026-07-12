import { type FormEvent, useEffect, useState } from "react";
import { CarrierWebsheet } from "../components/CarrierWebsheet";
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
import { devicesService } from "../services/devices";
import { cardsService } from "../services/cards";
import { useEventStream } from "../useEventStream";
import type {
  CardPolicy,
  CarrierWebsheetInfo,
  DeviceConfigDTO,
  DeviceMgmtListItem,
  DeviceOverviewItem,
  DiscoveredDevice,
  EsimOverviewResponse,
  OperatorCandidate,
  OperatorScanResult,
  OperatorSelection,
  RealtimeTrafficSnapshot,
} from "../types/api";

type Tab = "overview" | "config" | "operator" | "esim" | "at" | "ussd";

export default function Devices() {
  const [devices, setDevices] = useState<DeviceMgmtListItem[]>([]);
  const [limit, setLimit] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<DeviceOverviewItem | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredDevice[] | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [sortKey, setSortKey] = useState<"name" | "signal">("name");
  const [websheet, setWebsheet] = useState<CarrierWebsheetInfo | null>(null);
  const [rxRate, setRxRate] = useState("");
  const [txRate, setTxRate] = useState("");

  const load = async () => {
    const result = await devicesService.listManaged();
    if (result.ok) {
      setDevices(result.data.devices);
      setLimit(result.data.deviceLimit);
      if (!selectedId && result.data.devices[0])
        setSelectedId(result.data.devices[0].id);
    } else setError(result.error.message);
  };
  const loadDetail = async (id: string) => {
    const result = await devicesService.getOverviewLite(id);
    if (result.ok) setDetail(result.data);
    else setError(result.error.message);
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  useEventStream<{ devices?: DeviceOverviewItem[] }>({
    path: selectedId ? `/devices/${selectedId}/overview/stream` : "",
    eventName: "overview",
    enabled: Boolean(selectedId),
    reconnectDelayMs: 3000,
    onEvent: (payload) => {
      const next = payload.devices?.[0];
      if (!next) return;
      setDetail(next);
      setDevices((current) =>
        current.map((item) => (item.id === next.id ? { ...item, ...next } : item)),
      );
    },
    onRawEvent: (eventName, payload) => {
      if (eventName !== "traffic") return;
      try {
        const traffic = JSON.parse(payload) as RealtimeTrafficSnapshot;
        if (traffic.status === "waiting_sample") {
          setRxRate("等待采样");
          setTxRate("等待采样");
        } else if (traffic.status === "error") {
          setRxRate("采样中断");
          setTxRate("采样中断");
        } else {
          setRxRate(formatRate(traffic.rx_bps));
          setTxRate(formatRate(traffic.tx_bps));
        }
      } catch {
        // Ignore one malformed traffic frame without dropping the overview stream.
      }
    },
  });

  const action = async (
    task: () => Promise<{ ok: boolean; error?: { message: string } }>,
  ) => {
    setBusy(true);
    const result = await task();
    if (!result.ok && result.error) setError(result.error.message);
    await load();
    if (selectedId) await loadDetail(selectedId);
    setBusy(false);
  };
  const scan = async () => {
    setBusy(true);
    await devicesService.rescanAll();
    const result = await devicesService.listDiscovered();
    if (result.ok) setDiscovered(result.data);
    else setError(result.error.message);
    setBusy(false);
  };
  const visibleDevices = devices
    .filter((device) => {
      if (statusFilter === "online" && !device.healthy) return false;
      if (statusFilter === "offline" && device.healthy) return false;
      const text = `${device.id} ${device.name} ${device.interface || ""}`.toLowerCase();
      return !query || text.includes(query.toLowerCase());
    })
    .sort((a, b) =>
      sortKey === "signal"
        ? Number(b.modem?.signal_dbm || -999) - Number(a.modem?.signal_dbm || -999)
        : (a.name || a.id).localeCompare(b.name || b.id),
    );

  return (
    <>
      <PageHeader
        title="设备管理"
        description={`已配置 ${devices.length}${limit ? ` / ${limit}` : ""} 台设备`}
        actions={
          <>
            <Button onClick={() => void load()}>刷新</Button>
            <Button onClick={async () => { setBusy(true); await devicesService.rescanAll(); await load(); setBusy(false); }} disabled={busy}>
              重新扫描
            </Button>
            <Button variant="primary" onClick={() => void scan()} disabled={busy}>
              添加设备
            </Button>
          </>
        }
      />
      {error && <Notice>{error}</Notice>}
      <div className="device-layout">
        <Card className="managed-list">
          <div className="managed-tools">
            <input placeholder="搜索设备 / ICCID / IMEI / 网卡" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option value="all">全部状态</option><option value="online">在线</option><option value="offline">离线</option>
              </select>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)}>
                <option value="name">排序：名称</option><option value="signal">排序：信号</option>
              </select>
            </div>
            <small>配额 {devices.length} / {limit || "—"}</small>
          </div>
          {visibleDevices.map((device) => (
            <button
              key={device.id}
              className={selectedId === device.id ? "selected" : ""}
              onClick={() => {
                setSelectedId(device.id);
                setTab("overview");
              }}
            >
              <div>
                <strong>{device.name}</strong>
                <small>{device.interface || device.id}</small>
              </div>
              <StatusDot
                ok={device.healthy}
                label={device.healthy ? "在线" : "离线"}
              />
            </button>
          ))}
          {visibleDevices.length === 0 && <Empty title="暂无已配置设备" />}
        </Card>
        <div className="device-detail">
          {detail ? (
            <>
              <Card className="detail-head">
                <span className="detail-device-mark">V</span>
                <div>
                  <h2>{detail.name}</h2>
                  <code>
                    {detail.id} · {detail.interface || "未绑定网卡"}
                  </code>
                </div>
                <div className="detail-actions">
                  <Button
                    onClick={() =>
                      void action(() => devicesService.rotateIP(detail.id))
                    }
                    disabled={busy}
                  >
                    换 IP
                  </Button>
                  <Button
                    onClick={() =>
                      void action(() => devicesService.rebootModem(detail.id))
                    }
                    disabled={busy}
                  >
                    重启模组
                  </Button>
                  <Button onClick={() => { window.location.hash = `#/sms?device=${detail.id}`; }}>短信</Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (confirm("删除该设备配置？"))
                        void action(() =>
                          devicesService.deleteManaged(detail.id),
                        );
                    }}
                  >
                    删除
                  </Button>
                </div>
              </Card>
              <div className="tabs">
                {(
                  [
                    "overview",
                    "config",
                    "operator",
                    "esim",
                    "at",
                    "ussd",
                  ] as Tab[]
                ).map((item) => (
                  <button
                    key={item}
                    className={tab === item ? "active" : ""}
                    onClick={() => setTab(item)}
                  >
                    {
                      {
                        overview: "概览",
                        config: "配置",
                        operator: "运营商",
                        esim: "eSIM",
                        at: "AT 调试",
                        ussd: "USSD",
                      }[item]
                    }
                  </button>
                ))}
              </div>
              {tab === "overview" && (
                <Overview
                  detail={detail}
                  busy={busy}
                  run={action}
                  rxRate={rxRate}
                  txRate={txRate}
                  openE911={async () => {
                    setBusy(true);
                    const result = await devicesService.startE911Websheet(detail.id);
                    if (result.ok) setWebsheet(result.data);
                    else setError(result.error.message);
                    setBusy(false);
                  }}
                />
              )}
              {tab === "config" && (
                <Config
                  deviceId={detail.id}
                  onError={setError}
                  onSaved={() => void loadDetail(detail.id)}
                />
              )}
              {tab === "operator" && (
                <OperatorPanel deviceId={detail.id} onError={setError} />
              )}
              {tab === "esim" && (
                <Esim
                  deviceId={detail.id}
                  deviceImei={detail.modem?.imei}
                  onError={setError}
                />
              )}
              {tab === "at" && <AT deviceId={detail.id} onError={setError} />}
              {tab === "ussd" && (
                <USSD deviceId={detail.id} onError={setError} />
              )}
            </>
          ) : (
            <Empty title="选择一台设备" />
          )}
        </div>
      </div>
      {discovered && (
        <Discovery
          items={discovered}
          onClose={() => setDiscovered(null)}
          onAdded={async () => {
            setDiscovered(null);
            await load();
          }}
          onError={setError}
        />
      )}
      {websheet && (
        <CarrierWebsheet
          websheet={websheet}
          onClose={() => setWebsheet(null)}
          onDone={() => {
            setWebsheet(null);
            if (selectedId) void loadDetail(selectedId);
          }}
        />
      )}
    </>
  );
}

function Overview({
  detail,
  busy,
  run,
  rxRate,
  txRate,
  openE911,
}: {
  detail: DeviceOverviewItem;
  busy: boolean;
  run: (task: () => Promise<any>) => Promise<void>;
  rxRate: string;
  txRate: string;
  openE911: () => Promise<void>;
}) {
  const modem = detail.modem || {};
  return (
    <Card className="detail-panel">
      <div className="overview-grid">
        <Info
          label="生命周期"
          value={
            detail.lifecycle_phase || (detail.running ? "运行中" : "已停止")
          }
        />
        <Info label="运营商" value={modem.operator} />
        <Info
          label="网络模式"
          value={[modem.network_mode, modem.network_duplex]
            .filter(Boolean)
            .join(" ")}
        />
        <Info
          label="信号"
          value={modem.signal_dbm ? `${modem.signal_dbm} dBm` : ""}
        />
        <Info label="IMEI" value={modem.imei} mono />
        <Info label="ICCID" value={modem.iccid} mono />
        <Info
          label="本地 IP"
          value={detail.private_ip || detail.private_ipv6}
          mono
        />
        <Info
          label="公网 IP"
          value={detail.public_ip || detail.public_ipv6}
          mono
        />
        <Info label="APN" value={modem.apn} />
        <Info label="实时下行" value={rxRate} />
        <Info label="实时上行" value={txRate} />
        <Info
          label="VoWiFi"
          value={
            detail.vowifi_active
              ? "已连接"
              : detail.vowifi_enabled
                ? "已启用"
                : "已关闭"
          }
        />
      </div>
      <div className="action-strip">
        <Button
          variant={detail.network_connected ? "danger" : "primary"}
          disabled={busy}
          onClick={() =>
            void run(() =>
              detail.network_connected
                ? devicesService.stopNetwork(detail.id)
                : devicesService.startNetwork(detail.id),
            )
          }
        >
          {detail.network_connected ? "断开数据网络" : "连接数据网络"}
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            void run(() =>
              detail.vowifi_enabled
                ? devicesService.disableVoWiFi(detail.id)
                : devicesService.enableVoWiFi(detail.id),
            )
          }
        >
          {detail.vowifi_enabled ? "关闭 VoWiFi" : "启用 VoWiFi"}
        </Button>
        {detail.vowifi_enabled && (
          <Button
            onClick={() =>
              void run(() => devicesService.reconnectVoWiFi(detail.id))
            }
          >
            重连 VoWiFi
          </Button>
        )}
        <Button
          onClick={() =>
            void run(() =>
              devicesService.setFlightMode(
                detail.id,
                modem.operating_mode !== 0,
              ),
            )
          }
        >
          切换飞行模式
        </Button>
        <Button
          onClick={() => void run(() => devicesService.refreshInfo(detail.id))}
        >
          刷新模组信息
        </Button>
        {detail.e911_setup_available && (
          <Button disabled={busy} onClick={() => void openE911()}>
            设置 E911 地址
          </Button>
        )}
      </div>
      {modem.iccid && <CardPolicyPanel iccid={modem.iccid} />}
    </Card>
  );
}

function formatRate(value: number) {
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let amount = Math.max(0, Number(value) || 0);
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | number;
  mono?: boolean;
}) {
  return (
    <div className="info">
      <small>{label}</small>
      <span className={mono ? "mono" : ""}>{value || "—"}</span>
    </div>
  );
}

function CardPolicyPanel({ iccid }: { iccid: string }) {
  const [policy, setPolicy] = useState<CardPolicy | null>(null);
  useEffect(() => {
    void cardsService
      .getPolicy(iccid)
      .then((result) => result.ok && setPolicy(result.data));
  }, [iccid]);
  if (!policy) return null;
  const save = async (patch: Partial<CardPolicy>) => {
    const result = await cardsService.putPolicy(iccid, patch);
    if (result.ok) setPolicy(result.data);
  };
  return (
    <section className="card-policy">
      <h3>SIM 卡策略</h3>
      <label>
        <input
          type="checkbox"
          checked={policy.network_enabled}
          onChange={(event) =>
            void save({ network_enabled: event.target.checked })
          }
        />
        自动连接数据网络
      </label>
      <label>
        <input
          type="checkbox"
          checked={policy.vowifi_enabled}
          onChange={(event) =>
            void save({ vowifi_enabled: event.target.checked })
          }
        />
        自动启用 VoWiFi
      </label>
      <label>
        <input
          type="checkbox"
          checked={policy.airplane_enabled}
          onChange={(event) =>
            void save({ airplane_enabled: event.target.checked })
          }
        />
        自动飞行模式
      </label>
      <select
        value={policy.ip_version}
        onChange={(event) =>
          void save({
            ip_version: event.target.value as CardPolicy["ip_version"],
          })
        }
      >
        <option value="v4">IPv4</option>
        <option value="v6">IPv6</option>
        <option value="v4v6">IPv4 + IPv6</option>
      </select>
      <input
        placeholder="APN"
        value={policy.apn}
        onChange={(event) => setPolicy({ ...policy, apn: event.target.value })}
        onBlur={() => void save({ apn: policy.apn })}
      />
    </section>
  );
}

function OperatorPanel({
  deviceId,
  onError,
}: {
  deviceId: string;
  onError: (value: string) => void;
}) {
  const [selection, setSelection] = useState<OperatorSelection | null>(null);
  const [scanResult, setScanResult] = useState<OperatorScanResult | null>(null);
  const [streamEnabled, setStreamEnabled] = useState(false);
  const candidates = scanResult?.candidates || [];
  const scanning = scanResult?.status === "running";
  useEffect(() => {
    void devicesService
      .getOperatorSelection(deviceId)
      .then((result) =>
        result.ok ? setSelection(result.data) : onError(result.error.message),
      );
  }, [deviceId]);
  useEventStream<OperatorScanResult>({
    path: `/devices/${deviceId}/operator_selection/scan/stream`,
    eventName: "operator_scan",
    enabled: streamEnabled,
    reconnectDelayMs: 2000,
    onEvent: (result) => {
      setScanResult(result);
      if (result.status !== "running") setStreamEnabled(false);
    },
  });
  const scan = () => {
    setScanResult({
      scan_id: "",
      status: "running",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      complete: false,
      retryable: false,
      message: "正在搜索周围网络，这可能需要 1-3 分钟…",
      candidates: [],
    });
    setStreamEnabled(true);
  };
  const choose = async (candidate?: OperatorCandidate) => {
    const result = await devicesService.setOperatorSelection(
      deviceId,
      candidate
        ? {
            mode: "manual",
            plmn: candidate.plmn,
            includes_pcs_digit: candidate.includes_pcs_digit,
            rat: candidate.rats?.[0] || "",
          }
        : { mode: "automatic" },
    );
    if (result.ok) setSelection(result.data);
    else onError(result.error.message);
  };
  return (
    <Card className="detail-panel">
      <div className="section-title">
        <div>
          <h3>运营商选择</h3>
          <small>
            当前：
            {selection?.mode === "manual"
              ? `${selection.operator_name || selection.plmn} (手动)`
              : "自动"}
          </small>
        </div>
        <div className="page-actions">
          <Button onClick={() => void choose()}>自动选择</Button>
          <Button
            variant="primary"
            onClick={scan}
            disabled={scanning}
          >
            {scanning ? "扫描中…" : "扫描网络"}
          </Button>
        </div>
      </div>
      {(scanResult?.message || scanResult?.error) && (
        <Notice type={scanResult.status === "failed" ? "error" : "info"}>
          {scanResult.error || scanResult.message}
        </Notice>
      )}
      {candidates.length === 0 ? (
        <Empty title="尚未扫描运营商" />
      ) : (
        candidates.map((candidate) => (
          <div
            className="operator-row"
            key={`${candidate.plmn}-${candidate.rats?.join()}`}
          >
            <div>
              <strong>{candidate.operator_name || candidate.plmn}</strong>
              <small>
                {candidate.plmn} · {candidate.rats?.join(", ") || "未知制式"}
              </small>
            </div>
            <span className="tag">{candidate.status}</span>
            <Button onClick={() => void choose(candidate)}>选择</Button>
          </div>
        ))
      )}
    </Card>
  );
}

function Config({
  deviceId,
  onError,
  onSaved,
}: {
  deviceId: string;
  onError: (value: string) => void;
  onSaved: () => void;
}) {
  const [config, setConfig] = useState<DeviceConfigDTO | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void devicesService
      .getConfig(deviceId)
      .then((result) =>
        result.ok ? setConfig(result.data) : onError(result.error.message),
      );
  }, [deviceId]);
  if (!config) return <Card className="detail-panel">正在加载配置…</Card>;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const result = await devicesService.updateConfig(deviceId, config);
    if (!result.ok) onError(result.error.message);
    else onSaved();
    setSaving(false);
  };
  return (
    <Card className="detail-panel">
      <form className="form-grid two-columns" onSubmit={submit}>
        <Field label="设备名称">
          <input
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
          />
        </Field>
        <Field label="后端模式">
          <select
            value={config.device_backend || "qmi"}
            onChange={(e) =>
              setConfig({
                ...config,
                device_backend: e.target
                  .value as DeviceConfigDTO["device_backend"],
              })
            }
          >
            <option value="qmi">QMI</option>
            <option value="mbim">MBIM</option>
            <option value="at">AT</option>
          </select>
        </Field>
        <Field label="网络接口">
          <input
            value={config.interface}
            onChange={(e) =>
              setConfig({ ...config, interface: e.target.value })
            }
          />
        </Field>
        <Field label="控制设备">
          <input
            value={config.control_device}
            onChange={(e) =>
              setConfig({ ...config, control_device: e.target.value })
            }
          />
        </Field>
        <Field label="AT 端口">
          <input
            value={config.at_port}
            disabled
            readOnly
          />
        </Field>
        <Field label="APN">
          <input
            value={config.apn || ""}
            onChange={(e) => setConfig({ ...config, apn: e.target.value })}
          />
        </Field>
        <Field label="IP 版本">
          <select
            value={config.ip_version || "v4"}
            onChange={(e) =>
              setConfig({
                ...config,
                ip_version: e.target.value as DeviceConfigDTO["ip_version"],
              })
            }
          >
            <option value="v4">IPv4</option>
            <option value="v6">IPv6</option>
            <option value="v4v6">IPv4 + IPv6</option>
          </select>
        </Field>
        <Field label="eSIM 通道">
          <select
            value={config.esim_transport || "at"}
            onChange={(e) =>
              setConfig({
                ...config,
                esim_transport: e.target
                  .value as DeviceConfigDTO["esim_transport"],
              })
            }
          >
            <option value="at">AT</option>
            <option value="qmi">QMI</option>
          </select>
        </Field>
        <div className="form-actions">
          <Button variant="primary" disabled={saving}>
            {saving ? "保存中…" : "保存配置"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Esim({
  deviceId,
  deviceImei,
  onError,
}: {
  deviceId: string;
  deviceImei?: string;
  onError: (value: string) => void;
}) {
  const [data, setData] = useState<{
    chipInfo: EsimOverviewResponse["chip_info"];
    profiles: EsimOverviewResponse["profiles"];
  } | null>(null);
  const [smdp, setSmdp] = useState("");
  const [matchingId, setMatchingId] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadMessage, setDownloadMessage] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    import("../types/api").EsimNotificationItem[]
  >([]);
  const load = async (refresh = false) => {
    const result = await devicesService.getEsimOverview(deviceId, { refresh });
    if (result.ok) setData(result.data);
    else onError(result.error.message);
  };
  useEffect(() => {
    void load();
  }, [deviceId]);
  const download = async (event: FormEvent) => {
    event.preventDefault();
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadMessage("正在连接…");
    const result = await devicesService.downloadEsimProfileStream(
      deviceId,
      {
        smdp,
        matching_id: matchingId || undefined,
        confirmation_code: confirmationCode || undefined,
        aid_hex: data?.profiles[0]?.aid_hex,
        imei: deviceImei,
      },
      (progress) => {
        setDownloadProgress(progress.pct);
        setDownloadMessage(progress.msg);
      },
    );
    if (!result.ok) onError(result.error.message);
    else {
      setSmdp("");
      setMatchingId("");
      setConfirmationCode("");
      await load(true);
    }
    setDownloading(false);
  };
  const openNotifications = async () => {
    const result = await devicesService.getEsimNotifications(deviceId);
    if (!result.ok) onError(result.error.message);
    else {
      setNotifications(result.data);
      setNotificationsOpen(true);
    }
  };
  return (
    <Card className="detail-panel">
      <div className="section-title">
        <div>
          <h3>{data?.chipInfo?.sku_name || "eSIM Profiles"}</h3>
          {data?.chipInfo && (
            <small>
              {data.chipInfo.firmware ? `固件 ${data.chipInfo.firmware}` : "eUICC"}
              {data.chipInfo.serial_number ? ` · SN ${data.chipInfo.serial_number}` : ""}
            </small>
          )}
        </div>
        <div className="page-actions">
          <Button onClick={() => void openNotifications()}>当前通知</Button>
          <Button onClick={() => void load(true)}>刷新芯片</Button>
        </div>
      </div>
      <form className="download-form" onSubmit={download}>
        <input
          required
          placeholder="SM-DP+ 地址或激活码"
          value={smdp}
          onChange={(event) => {
            const value = event.target.value;
            if (value.startsWith("LPA:")) {
              const parts = value.split("$");
              if (parts.length >= 3) {
                setSmdp(parts[1]);
                setMatchingId(parts[2]);
                return;
              }
            }
            setSmdp(value.replace(/^https?:\/\//i, ""));
          }}
        />
        <input
          placeholder="Matching ID（可选）"
          value={matchingId}
          onChange={(event) => setMatchingId(event.target.value)}
        />
        <input
          placeholder="确认码（可选）"
          value={confirmationCode}
          onChange={(event) => setConfirmationCode(event.target.value)}
        />
        <Button variant="primary" disabled={downloading}>
          {downloading ? "下载中…" : "下载 Profile"}
        </Button>
      </form>
      {(downloading || downloadMessage) && (
        <div className="esim-progress">
          <progress max={100} value={downloadProgress} />
          <span>{downloadMessage}</span>
        </div>
      )}
      {!data ? (
        <p>正在读取 eSIM…</p>
      ) : data.profiles.length === 0 ? (
        <Empty title="未找到 eSIM Profile" />
      ) : (
        data.profiles.flatMap((group) =>
          group.profiles.map((profile) => (
            <div className="esim-row" key={`${group.aid_hex}-${profile.iccid}`}>
              <div>
                <strong>
                  {profile.name ||
                    profile.service_provider_name ||
                    "未命名 Profile"}
                </strong>
                <code>{profile.iccid}</code>
              </div>
              <span>{profile.state_text}</span>
              <div>
                <Button
                  onClick={async () => {
                    const name = prompt("新名称", profile.name);
                    if (!name) return;
                    const result = await devicesService.renameEsimProfile(
                      deviceId,
                      profile.iccid,
                      { name, aid_hex: group.aid_hex },
                    );
                    if (!result.ok) onError(result.error.message);
                    else await load(true);
                  }}
                >
                  重命名
                </Button>
                <Button
                  onClick={async () => {
                    const result = await devicesService.switchEsimProfile(
                      deviceId,
                      { iccid: profile.iccid, aid_hex: group.aid_hex },
                    );
                    if (!result.ok) onError(result.error.message);
                    else await load(true);
                  }}
                >
                  切换
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    const last4 = profile.iccid.slice(-4);
                    if (prompt(`删除不可逆，请输入 ICCID 后 4 位 ${last4}`) !== last4)
                      return;
                    const result = await devicesService.deleteEsimProfile(
                      deviceId,
                      profile.iccid,
                      group.aid_hex,
                    );
                    if (!result.ok) onError(result.error.message);
                    else await load(true);
                  }}
                >
                  删除
                </Button>
              </div>
            </div>
          )),
        )
      )}
      {notificationsOpen && (
        <Modal title="当前 eSIM 通知" onClose={() => setNotificationsOpen(false)}>
          {notifications.length === 0 ? (
            <Empty title="暂无待处理通知" />
          ) : (
            notifications.map((item) => (
              <div className="notification-row" key={item.sequence_number}>
                <div>
                  <strong>{item.event || "eSIM 通知"}</strong>
                  <small>
                    #{item.sequence_number}
                    {item.iccid ? ` · ${item.iccid}` : ""}
                  </small>
                </div>
                {item.can_retry && (
                  <Button
                    onClick={async () => {
                      const result = await devicesService.retryEsimNotification(
                        deviceId,
                        item.sequence_number,
                        item.aid_hex,
                      );
                      if (!result.ok) onError(result.error.message);
                      else await openNotifications();
                    }}
                  >
                    重试发送
                  </Button>
                )}
              </div>
            ))
          )}
        </Modal>
      )}
    </Card>
  );
}

function AT({
  deviceId,
  onError,
}: {
  deviceId: string;
  onError: (value: string) => void;
}) {
  const [command, setCommand] = useState("AT");
  const [output, setOutput] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await devicesService.sendAT(deviceId, {
      cmd: command,
      timeout_ms: 10_000,
    });
    if (result.ok) setOutput(result.data.response);
    else onError(result.error.message);
  };
  return (
    <Card className="detail-panel">
      <form className="command-form" onSubmit={submit}>
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
        />
        <Button variant="primary">发送</Button>
      </form>
      <pre className="terminal">{output || "等待 AT 命令…"}</pre>
    </Card>
  );
}

function USSD({
  deviceId,
  onError,
}: {
  deviceId: string;
  onError: (value: string) => void;
}) {
  const [command, setCommand] = useState("*100#");
  const [timeoutMs, setTimeoutMs] = useState(45_000);
  const [sessionId, setSessionId] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<
    Array<{
      time: number;
      type: "request" | "response" | "error" | "system";
      content: string;
      dcs?: number;
      channel?: string;
    }>
  >([]);
  const endSession = () => setSessionId("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = command.trim();
    if (!input || sending) return;
    setHistory((items) => [
      ...items,
      { time: Date.now(), type: "request", content: input },
    ]);
    setCommand("");
    setSending(true);
    const result = sessionId
      ? await devicesService.continueUSSD(
          deviceId,
          { session_id: sessionId, input, timeout_ms: timeoutMs },
          timeoutMs + 2000,
        )
      : await devicesService.sendUSSD(
          deviceId,
          { command: input, timeout_ms: timeoutMs },
          timeoutMs + 2000,
        );
    if (!result.ok) {
      setHistory((items) => [
        ...items,
        { time: Date.now(), type: "error", content: result.error.message },
      ]);
      onError(result.error.message);
      endSession();
      setSending(false);
      return;
    }
    const response = result.data;
    const terminated = response.status === 2 || response.status === 5;
    setHistory((items) => [
      ...items,
      {
        time: Date.now(),
        type: terminated ? "error" : "response",
        content: `${response.status === 5 ? "[网络不支持/无响应]\n" : response.status === 2 ? "[被网络终止]\n" : ""}${response.text || response.rawText || "[空响应]"}`,
        dcs: response.dcs,
        channel: response.channel,
      },
    ]);
    if (response.status === 1 && response.sessionId) setSessionId(response.sessionId);
    else endSession();
    setSending(false);
  };
  const cancel = async () => {
    if (!sessionId) return;
    await devicesService.cancelUSSD(deviceId, sessionId);
    setHistory((items) => [
      ...items,
      { time: Date.now(), type: "system", content: "会话已手动取消" },
    ]);
    endSession();
  };
  return (
    <Card className="detail-panel">
      <div className="section-title">
        <div>
          <h3>USSD 交互终端</h3>
          <small>{sessionId ? "多轮会话中，请输入菜单选项" : "发送 USSD 代码并等待网络响应"}</small>
        </div>
        {sessionId && (
          <Button variant="danger" disabled={sending} onClick={() => void cancel()}>
            取消会话
          </Button>
        )}
      </div>
      <div className="ussd-history">
        {history.length === 0 && !sending && <span>暂无 USSD 会话记录</span>}
        {history.map((item, index) => (
          <div key={`${item.time}-${index}`} className={`ussd-message ${item.type}`}>
            <pre>{item.content}</pre>
            <small>
              {new Date(item.time).toLocaleTimeString()}
              {item.dcs !== undefined ? ` · DCS ${item.dcs}` : ""}
              {item.channel ? ` · ${item.channel === "vowifi" ? "VoWiFi" : "CS"}` : ""}
            </small>
          </div>
        ))}
        {sending && <span>等待网络响应…</span>}
      </div>
      <form className="command-form" onSubmit={submit}>
        <input
          value={command}
          placeholder={sessionId ? "输入菜单选项数字" : "例如 *100#"}
          onChange={(event) => setCommand(event.target.value)}
          disabled={sending}
        />
        <input
          type="number"
          value={timeoutMs}
          min={1000}
          onChange={(event) => setTimeoutMs(Number(event.target.value) || 45_000)}
        />
        <Button
          type="button"
          onClick={() => {
            setHistory([]);
            endSession();
          }}
        >
          清空
        </Button>
        <Button variant="primary" disabled={sending || !command.trim()}>
          {sessionId ? "回复" : "发送"}
        </Button>
      </form>
    </Card>
  );
}

function Discovery({
  items,
  onClose,
  onAdded,
  onError,
}: {
  items: DiscoveredDevice[];
  onClose: () => void;
  onAdded: () => void;
  onError: (value: string) => void;
}) {
  return (
    <Modal title="扫描到的设备" onClose={onClose}>
      {items.length === 0 ? (
        <Empty title="未发现新设备" />
      ) : (
        items.map((item) => (
          <div className="discovery-row" key={item.discovery_key}>
            <div>
              <strong>{item.imei || item.control_path}</strong>
              <small>
                {item.mode?.toUpperCase()} · {item.net_interface || "无网卡"} ·{" "}
                {item.at_port || "无 AT 端口"}
              </small>
            </div>
            {item.configured ? (
              <span className="tag">已添加</span>
            ) : (
              <Button
                variant="primary"
                onClick={async () => {
                  const result = await devicesService.addManaged({
                    id: `device-${Date.now()}`,
                    name: item.imei ? `Modem ${item.imei.slice(-4)}` : "新设备",
                    interface: item.net_interface,
                    at_port: item.at_port,
                    control_device: item.control_path,
                    usb_path: item.usb_path,
                    device_backend: item.mode === "mbim" ? "mbim" : "qmi",
                  });
                  if (result.ok) onAdded();
                  else onError(result.error.message);
                }}
              >
                添加
              </Button>
            )}
          </div>
        ))
      )}
    </Modal>
  );
}
