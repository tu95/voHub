import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Empty, Notice, PageHeader } from "../components/ui";
import { logsService, type LogEntry } from "../services/logs";
import { useEventStream } from "../useEventStream";

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState("all");
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [error, setError] = useState("");
  const container = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void logsService.history(500).then((result) => {
      if (result.ok) setLogs(result.data.slice(-1000));
      else setError(result.error.message);
    });
  }, []);

  const stream = useEventStream<LogEntry>({
    path: "/logs/stream",
    eventName: "log",
    enabled: !paused,
    query: { level: level === "all" ? "" : level },
    reconnectDelayMs: 3000,
    onEvent: (entry) => {
      setLogs((items) => [...items, entry].slice(-1000));
      if (autoScroll) {
        window.requestAnimationFrame(() => {
          if (container.current) container.current.scrollTop = container.current.scrollHeight;
        });
      }
    },
  });
  const entries = useMemo(
    () =>
      logs.filter(
        (entry) =>
          (level === "all" || entry.level.toLowerCase() === level) &&
          (!query ||
            `${entry.message} ${entry.caller} ${entry.fields || ""}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [logs, level, query],
  );
  const exportLogs = () => {
    const content = entries
      .map(
        (entry) =>
          `[${entry.time}] ${entry.level.toUpperCase().padEnd(5)} ${entry.caller} ${entry.message}${entry.fields ? ` ${entry.fields}` : ""}`,
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `logs-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        title="实时日志"
        description="查看系统运行日志，支持过滤、暂停和导出"
        actions={
          <>
            <Button onClick={() => setPaused((value) => !value)}>
              {paused ? "继续" : "暂停"}
            </Button>
            <Button onClick={() => setLogs([])}>清空</Button>
            <Button variant="primary" onClick={exportLogs}>导出</Button>
          </>
        }
      />
      <div className="stream-status">
        <span className={stream.connected ? "online" : "offline"} />
        {stream.connected ? "已连接" : paused ? "已暂停" : "未连接"} · {logs.length} 条日志
        <label>
          <input type="checkbox" checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} />
          自动追尾
        </label>
      </div>
      <Card className="toolbar">
        <input placeholder="搜索日志…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="all">全部级别</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <span>显示 {entries.length} / {logs.length} 条</span>
      </Card>
      {(error || stream.lastError) && <Notice>{error || stream.lastError}</Notice>}
      {entries.length === 0 ? (
        <Empty title={stream.connected ? "等待日志…" : "没有匹配的日志"} />
      ) : (
        <main ref={container} className="log-scroll">
          <Card className="log-panel">
            {entries.map((entry, index) => (
              <div className="log-row" key={`${entry.time}-${index}`}>
                <time>{entry.time}</time>
                <span className={`log-level level-${entry.level.toLowerCase()}`}>{entry.level}</span>
                <code>{entry.caller || "—"}</code>
                <p>{entry.message}{entry.fields && <small>{entry.fields}</small>}</p>
              </div>
            ))}
          </Card>
        </main>
      )}
    </>
  );
}
