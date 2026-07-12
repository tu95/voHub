import { useEffect, useState } from "react";
import { Card, Empty, Notice, PageHeader, StatusDot } from "../components/ui";
import { formatBytes, useAsyncData } from "../hooks";
import { dashboardService } from "../services/dashboard";
import { trafficService, type TrafficRange } from "../services/traffic";

export default function Dashboard() {
  const state = useAsyncData(() => dashboardService.listDevices(), []);
  const [range, setRange] = useState<TrafficRange>("day");
  const traffic = useAsyncData(
    () => trafficService.getAnalysis(range),
    [range],
  );
  useEffect(() => {
    const timer = window.setInterval(() => void state.reload(), 15_000);
    return () => window.clearInterval(timer);
  }, [state.reload]);

  const devices = state.data || [];
  const online = devices.filter((item) => item.healthy).length;
  const offline = Math.max(0, devices.length - online);

  return (
    <>
      <PageHeader
        title="设备监控"
        description="实时查看设备状态与出口 IP"
        actions={<button className="button" onClick={() => void state.reload()}>↻ 刷新</button>}
      />
      <div className="metrics">
        <Card>
          <small>设备总数</small>
          <strong>{devices.length}</strong>
          <span>{online} 台在线</span>
        </Card>
        <Card>
          <small>在线</small>
          <strong>{online}</strong>
        </Card>
        <Card>
          <small>离线</small>
          <strong className="metric-danger">{offline}</strong>
        </Card>
        <Card>
          <small>最近刷新</small>
          <strong className="metric-time">{new Date().toLocaleTimeString()}</strong>
        </Card>
      </div>
      {state.error && <Notice>{state.error}</Notice>}
      <div className="section-title">
        <h2>设备概览</h2>
      </div>
      {!state.loading && devices.length === 0 ? (
        <Empty title="暂无设备" detail="请前往设备管理添加或扫描模组" />
      ) : (
        <div className="device-grid">
          {devices.map((device) => (
            <Card key={device.id} className="device-card">
              <div className="device-card-head">
                <span className="device-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="7" y="4" width="10" height="16" rx="2" strokeWidth="1.8"/><path d="M10 8h4v6h-4zM10 17h4" strokeWidth="1.5"/></svg></span>
                <div>
                  <h3>{device.name || device.id}</h3>
                  <StatusDot ok={device.healthy} label={device.healthy ? "在线" : "离线"} />
                </div>
              </div>
              <div className="device-radio-strip"><strong>{device.network_mode || "—"}</strong><span>{device.operator || "—"}</span><b>{device.signal_dbm ? `${device.signal_dbm}dBm` : "—"}</b></div>
              <div className="device-public-ip"><span>◎ 公网 IP</span><code>{device.public_ip || device.public_ipv6 || "—"}</code></div>
            </Card>
          ))}
        </div>
      )}
      <div className="section-title traffic-title">
        <h2>流量分析</h2>
        <select
          value={range}
          onChange={(event) => setRange(event.target.value as TrafficRange)}
        >
          <option value="day">今日</option>
          <option value="week">本周</option>
          <option value="month">本月</option>
        </select>
      </div>
      <TrafficChart buckets={traffic.data?.buckets || []} />
    </>
  );
}

function TrafficChart({
  buckets,
}: {
  buckets: Array<{
    bucket: string;
    total_bytes: number;
    rx_bytes: number;
    tx_bytes: number;
  }>;
}) {
  const max = Math.max(1, ...buckets.map((item) => item.total_bytes));
  const total = buckets.reduce((sum, item) => sum + item.total_bytes, 0);
  const rx = buckets.reduce((sum, item) => sum + item.rx_bytes, 0);
  const tx = buckets.reduce((sum, item) => sum + item.tx_bytes, 0);
  const points = buckets.map((item, index) => {
    const x = buckets.length === 1 ? 0 : (index / (buckets.length - 1)) * 1000;
    const y = 190 - (item.total_bytes / max) * 165;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const area = points.length ? `M0,190 L${points.join(" L")} L1000,190 Z` : "";
  return (
    <Card className="traffic-card">
      <div className="traffic-metrics">
        <div><span>本日下载</span><strong>{formatBytes(rx)}</strong></div>
        <div><span>本日上传</span><strong>{formatBytes(tx)}</strong></div>
        <div><span>本日合计</span><strong>{formatBytes(total)}</strong></div>
      </div>
      {buckets.length === 0 ? (
        <Empty title="暂无流量样本" />
      ) : (
        <div className="traffic-line-chart">
          <div className="chart-legend"><i /> 总流量</div>
          <svg viewBox="0 0 1000 210" preserveAspectRatio="none" role="img" aria-label="流量趋势图">
            <defs><linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#91d72c" stopOpacity=".68"/><stop offset="1" stopColor="#91d72c" stopOpacity=".08"/></linearGradient></defs>
            <path d={area} fill="url(#traffic-fill)" />
            <polyline points={points.join(" ")} fill="none" stroke="#86c922" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="chart-labels">{buckets.filter((_, index) => index % Math.max(1, Math.ceil(buckets.length / 12)) === 0).map((item) => <small key={item.bucket}>{item.bucket.slice(-5)}</small>)}</div>
        </div>
      )}
    </Card>
  );
}
