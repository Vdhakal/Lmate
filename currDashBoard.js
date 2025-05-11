// LmateDashboard.jsx – L‑Mate Demo Dashboard (live‑first, mock‑fallback)
// -----------------------------------------------------------------------------
// ✓ Three fixed columns: Provision/On‑Board, Activation/Config, Metrics Rail
// ✓ Mock values auto‑kick‑in when PHP endpoints are down or 4s timeout elapses
// ✓ No switch/flag needed – the moment your backend responds, UI shows it
// ✓ Styling + CSS modules unchanged – we only touched data‑layer logic
// -----------------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Table,
  ProgressBar,
  Badge,
} from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

import styles from "./LmateDashboard.module.css";

// -----------------------------------------------------------------------------
// 1. LIVE‑FIRST API HELPERS with graceful fallback to mock
// -----------------------------------------------------------------------------
const API_BASE   = "/api";          // ← tweak if PHP lives elsewhere
const API_TIMEOUT = 4_000;          // ms before we assume backend is down

const fetchJSON = async (path, options = {}, mockFn = () => ({})) => {
  // unified fetch with timeout + mock fallback
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (err) {
    // console.info("⇢ mock fallback for", path, err?.message);
    return mockFn();
  }
};

// ---------- Endpoint wrappers -------------------------------------------------
const api = {
  dhcp:           (serial)      => fetchJSON(
    `/ztp/dhcp?serial=${serial}`,
    {},
    () => ({
      ip         : `192.168.0.${rand(2, 254)}`,
      macAddress : mockMac(),
      leaseStart : new Date(Date.now() - rand(1, 6) * 3600000).toISOString(),
      leaseEnd   : new Date(Date.now() + rand(1, 48) * 3600000).toISOString(),
    })
  ),
  obRecords:      (serial)      => fetchJSON(
    `/onboarding/ob-records?serial=${serial}`,
    {},
    () => ({ status: pick(["pending", "running", "done"]) })
  ),
  listDevice:     (serial)      => fetchJSON(
    `/device/listDeviceRedisV2?serial=${serial}`,
    {},
    () => ({
      active  : Math.random() < 0.4,
      firmware: { current: "1.0.0", latest: "1.1.0" },
    })
  ),
  deviceProv:     (serial)      => fetchJSON(
    `/device/deviceProvisioning?serial=${serial}`,
    {},
    () => ({
      current   : "1.0.0",
      latest    : "1.1.0",
      progress  : rand(0, 100),
      upgradeTime: null,
    })
  ),
  metric:         (name, serial) => fetchJSON(
    `/metrics/${name}?serial=${serial}`,
    {},
    () => ({ value: randMetricVal(name), ts: Date.now() })
  ),
  triggerOnboard: (serial)      => fetchJSON(
    `/onboarding/trigger`,
    {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ serial }),
    },
    () => ({ ok: true, serial })
  ),
  factoryReset:   (serial)      => fetchJSON(
    `/device/factory-reset`,
    {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ serial }),
    },
    () => ({ ok: true, serial })
  ),
};

// -----------------------------------------------------------------------------
// 2. PURE MOCK UTILITIES (used only by fallback lambdas above)
// -----------------------------------------------------------------------------
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mockMac = () =>
  Array.from({ length: 6 }, () => rand(0, 255).toString(16).padStart(2, "0")).join(":");
const randMetricVal = (name) => {
  switch (name) {
    case "ethernet-bytes-sent-usage":  return rand(100, 9000);
    case "ethernet-bytes-rcvd-usage":  return rand(200, 11000);
    case "ping":                       return rand(1, 50);
    case "cpu-usage":                  return rand(5, 95);
    case "memory-free":                return rand(100, 8000);
    case "optical-tx":                 return rand(-10, -2);
    case "optical-rx":                 return rand(-15, -5);
    default:                            return rand(1, 100);
  }
};

const push = (arr, v, max = 30) => {
  const next = [...arr, v];
  if (next.length > max) next.shift();
  return next;
};

// -----------------------------------------------------------------------------
// 3. INITIAL MOCK STATES (same shapes as real)
// -----------------------------------------------------------------------------
const initialOnboard = { dhcp: {}, status: "pending", environment: "dev" };
const initialDevice  = {
  active    : false,
  firmware  : { current: "1.0.0", latest: "1.1.0", progress: null, upgradeTime: null },
  portConfig: [],
  services  : [],
};

// -----------------------------------------------------------------------------
// 4. SPARKLINE COMPONENT (unchanged)
// -----------------------------------------------------------------------------
function SparkChart({ data, stroke = "#fb8429" }) {
  return (
    <ResponsiveContainer width="100%" height={60} className={styles["metric-chart"]}>
      <LineChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Tooltip formatter={(v) => v.toLocaleString()} labelStyle={{ display: "none" }} />
        <YAxis hide domain={[0, "dataMax"]} />
        <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// -----------------------------------------------------------------------------
// 5. MAIN DASHBOARD COMPONENT (UI untouched – only data hooks altered)
// -----------------------------------------------------------------------------
export default function LmateDashboard({ serial = "DEMO‑123" }) {
  const [onboard, setOnboard] = useState(initialOnboard);
  const [device, setDevice]   = useState(initialDevice);
  const [metrics, setMetrics] = useState({ tx: [], rx: [], latency: [], cpu: [], mem: [], opticalTx: [], opticalRx: [] });

  // --- POLL PROVISION / DEVICE INFO (every 3s) ---------------------------
  useEffect(() => {
    const id = setInterval(async () => {
      const [dhcp, ob, list, prov] = await Promise.all([
        api.dhcp(serial),
        api.obRecords(serial),
        api.listDevice(serial),
        api.deviceProv(serial),
      ]);

      setOnboard({ dhcp, status: ob.status, environment: onboard.environment });
      setDevice((prev) => ({
        ...prev,
        active   : list.active,
        firmware : { ...prev.firmware, ...prov },
        // keeping existing portConfig/services until you wire real data
      }));
    }, 3_000);
    return () => clearInterval(id);
  }, [serial]);

  // --- STREAM METRICS (every 1s) ---------------------------------------
  useEffect(() => {
    const id = setInterval(async () => {
      const names = [
        "ethernet-bytes-sent-usage",
        "ethernet-bytes-rcvd-usage",
        "ping",
        "cpu-usage",
        "memory-free",
        "optical-tx",
        "optical-rx",
      ];
      const [tx, rx, ping, cpu, mem, optTx, optRx] = await Promise.all(names.map((n) => api.metric(n, serial)));

      setMetrics((m) => ({
        tx      : push(m.tx,      { v: tx.value }),
        rx      : push(m.rx,      { v: rx.value }),
        latency : push(m.latency, { v: ping.value }),
        cpu     : push(m.cpu,     { v: cpu.value }),
        mem     : push(m.mem,     { v: mem.value }),
        opticalTx: push(m.opticalTx, { v: optTx.value }),
        opticalRx: push(m.opticalRx, { v: optRx.value }),
      }));
    }, 1_000);
    return () => clearInterval(id);
  }, [serial]);

  // --- helper fns (UI logic unchanged) ----------------------------------
  const latest = (arr) => (arr.length ? arr[arr.length - 1].v : 0);
  const statusBadge = (status) => {
    const map = { pending: "secondary", running: "warning", done: "success" };
    return <Badge bg={map[status] || "secondary"}>{status}</Badge>;
  };

  // ---------------------------------------------------------------------
  // RENDER (identical to your previous markup – omitted for brevity)
  // ---------------------------------------------------------------------
  return (
    <Container fluid className={`${styles["device-dashboard-bg"]} py-4`}>
      {/* existing JSX for three columns goes here – unchanged from your file */}

      {/* ... (Provision & On‑Board) ... */}
      {/* ... (Activation & Config)  ... */}
      {/* ... (Metrics Rail)        ... */}
    </Container>
  );
}
