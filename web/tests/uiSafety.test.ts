import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("短信表单缺少号码或内容时禁用发送按钮", () => {
  const source = readFileSync(new URL("../src/pages/Sms.tsx", import.meta.url), "utf8");
  assert.match(
    source,
    /disabled=\{sending \|\| !phone\.trim\(\) \|\| !message\.trim\(\)\}/,
  );
});

test("拒绝免责声明触发卸载前要求二次确认", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const confirmIndex = source.indexOf("window.confirm");
  const uninstallIndex = source.indexOf('fetch("/api/system/uninstall"');
  assert.ok(confirmIndex >= 0, "缺少卸载确认");
  assert.ok(uninstallIndex > confirmIndex, "卸载请求必须发生在确认之后");
});
