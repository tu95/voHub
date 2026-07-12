import { type FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, Empty, Notice, PageHeader } from "../components/ui";
import { smsService } from "../services/sms";
import type { SmsThreadVM, SMSMessageDTO } from "../types/view-model";

export default function Sms() {
  const [searchParams] = useSearchParams();
  const [threads, setThreads] = useState<SmsThreadVM[]>([]);
  const [messages, setMessages] = useState<SMSMessageDTO[]>([]);
  const [selected, setSelected] = useState<SmsThreadVM | null>(null);
  const [devices, setDevices] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [deviceId, setDeviceId] = useState(searchParams.get("device") || "all");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const phoneInput = useRef<HTMLInputElement | null>(null);
  const messageList = useRef<HTMLDivElement | null>(null);

  const loadThreads = async () => {
    const result = await smsService.listContacts(deviceId);
    if (result.ok) setThreads(result.data);
    else setError(result.error.message);
  };
  useEffect(() => {
    void smsService
      .listDevices()
      .then((result) => result.ok && setDevices(result.data));
  }, []);
  useEffect(() => {
    void loadThreads();
  }, [deviceId]);
  useEffect(() => {
    if (!selected) return;
    const load = () => smsService.getThread({
        peer: selected.peer,
        imsi: selected.imsi,
        device_id: selected.deviceId,
        limit: 200,
      }).then((result) =>
        result.ok ? setMessages(result.data) : setError(result.error.message),
      );
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [selected]);
  useEffect(() => {
    if (!messageList.current) return;
    messageList.current.scrollTop = messageList.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    const timer = window.setInterval(() => void loadThreads(), 10_000);
    return () => window.clearInterval(timer);
  }, [deviceId]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!phone.trim() || !message.trim()) return;
    setError("");
    setSending(true);
    try {
      const result = await smsService.send({
        device_id: deviceId === "all" ? undefined : deviceId,
        phone: phone.trim(),
        message: message.trim(),
      });
      if (result.ok) {
        setMessage("");
        await loadThreads();
        if (selected?.peer === phone.trim()) {
          const thread = await smsService.getThread({
            peer: selected.peer,
            imsi: selected.imsi,
            device_id: selected.deviceId,
            limit: 200,
          });
          if (thread.ok) setMessages(thread.data);
        }
      } else setError(result.error.message);
    } finally {
      setSending(false);
    }
  };

  const startNewMessage = () => {
    setSelected(null);
    setMessages([]);
    setPhone("");
    setMessage("");
    window.requestAnimationFrame(() => phoneInput.current?.focus());
  };

  const formatThreadTime = (timestamp: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "2-digit", day: "2-digit" });
  };

  const visibleThreads = threads.filter(
    (item) =>
      !query ||
      `${item.peer} ${item.lastMessage} ${item.lastDeviceName || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="短信中心"
        description="统一查看与发送多设备短信"
        actions={
          <>
            <Button onClick={() => void loadThreads()}>刷新</Button>
            <Button variant="primary" onClick={startNewMessage}>新建短信</Button>
          </>
        }
      />
      {error && <Notice>{error}</Notice>}
      <div className="sms-layout">
        <Card className="thread-panel">
          <div className="thread-panel-head">
            <div>
              <h2>会话</h2>
              <span>{visibleThreads.length} 个联系人</span>
            </div>
          </div>
          <div className="panel-toolbar">
            <label>
              <span className="sr-only">设备</span>
              <select
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
              >
                <option value="all">全部设备</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="thread-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
              </svg>
              <span className="sr-only">搜索会话</span>
              <input
                placeholder="搜索号码或内容"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="thread-list">
            {visibleThreads.map((thread) => (
              <button
                key={thread.key}
                className={selected?.key === thread.key ? "selected" : ""}
                onClick={() => {
                  setSelected(thread);
                  setPhone(thread.peer);
                }}
              >
                <span className="thread-avatar" aria-hidden="true">
                  {thread.peer.slice(-2)}
                </span>
                <span className="thread-summary">
                  <span className="thread-title">
                    <strong>{thread.peer}</strong>
                    <time>{formatThreadTime(thread.lastTs)}</time>
                  </span>
                  <span className="thread-preview">
                    {thread.lastMessage || "暂无内容"}
                  </span>
                  <small>{thread.lastDeviceName || thread.imsi}</small>
                </span>
                {thread.unreadCount > 0 && (
                  <span className="thread-unread" aria-label={`${thread.unreadCount} 条未读`}>
                    {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                  </span>
                )}
              </button>
            ))}
            {visibleThreads.length === 0 && <Empty title="暂无会话" />}
          </div>
        </Card>
        <Card className="conversation">
          <header>
            <div className="conversation-identity">
              <span className="conversation-avatar" aria-hidden="true">
                {selected ? selected.peer.slice(-2) : "+"}
              </span>
              <div>
                <h2>{selected?.peer || "新短信"}</h2>
                <small>
                  {selected?.lastDeviceName || "填写收件号码开始新会话"}
                </small>
              </div>
            </div>
            {selected && (
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm("删除整个会话？")) return;
                  const result = await smsService.deleteThread({
                    peer: selected.peer,
                    imsi: selected.imsi,
                    device_id: selected.deviceId,
                  });
                  if (result.ok) {
                    setSelected(null);
                    setMessages([]);
                    await loadThreads();
                  }
                }}
              >
                删除会话
              </Button>
            )}
          </header>
          <div className="messages" ref={messageList} aria-live="polite">
            {messages.map((item) => (
              <div
                key={item.id}
                className={`message ${item.type === 2 ? "message-out" : "message-in"}`}
              >
                <p>{item.content}</p>
                <span className="message-meta">
                  <small>
                    {new Date(item.timestamp).toLocaleString()}
                    {item.type === 2 ? ` · ${item.status === 3 ? "发送失败" : "已发送"}` : ""}
                  </small>
                  <button
                    className="message-delete"
                    aria-label="删除此消息"
                    onClick={async () => {
                      if (!confirm("永久删除这条短信？")) return;
                      const result = await smsService.deleteMessage(item.id);
                      if (!result.ok) setError(result.error.message);
                      else {
                        setMessages((items) => items.filter((message) => message.id !== item.id));
                        await loadThreads();
                      }
                    }}
                  >
                    删除
                  </button>
                </span>
              </div>
            ))}
            {selected && messages.length === 0 && (
              <Empty title="暂无短信" detail="发送一条消息开始对话" />
            )}
            {!selected && (
              <Empty title="新短信" detail="在下方填写收件号码和短信内容" />
            )}
          </div>
          <form className="composer" onSubmit={send}>
            <label className="composer-recipient" htmlFor="sms-phone">
              <span>收件人</span>
              <input
                ref={phoneInput}
                id="sms-phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="请输入手机号码"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <label className="composer-message" htmlFor="sms-message">
              <span className="sr-only">短信内容</span>
              <textarea
                id="sms-message"
                rows={3}
                placeholder="输入短信内容…"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            <div className="composer-footer">
              <span>{message.length} 个字符</span>
              <Button
                variant="primary"
                disabled={sending || !phone.trim() || !message.trim()}
              >
                {sending ? "发送中…" : "发送短信"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
