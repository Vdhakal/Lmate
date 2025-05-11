// LmateDashboard.jsx – L‑Mate Demo Dashboard (mock + live‑ready)
// -----------------------------------------------------------------------------
// * Three fixed columns: Provision/On‑Board, Activation/Config, Metrics Rail
// * Mock polling every second so the UI animates without a backend
// * Font‑Awesome icons via react‑icons
// * Recharts sparklines for Metrics Rail
// * ***NEW***: Real API stubs are provided (commented‑out) so you can flip a
//   switch to go live.
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

import styles from './LmateDashboard.module.css';

/*
// -----------------------------------------------------------------------------
// 2. REAL API IMPLEMENTATIONS – ***commented‑out***
// -----------------------------------------------------------------------------
// 👉 Replace `USE_MOCK` with false and uncomment these functions + imports to
//    switch to your live AO backend. Endpoint paths copied from meeting notes –
//    update as needed.
// -----------------------------------------------------------------------------
// const API_BASE = "https://ao.internal/api";
// const json = (r) => (r.ok ? r.json() : Promise.reject(r.statusText));
//
// // ----- ONBOARDING ----------------------------------------------------------
// export async function apiGetDhcpLease(serial) {
//   return fetch(`${API_BASE}/ztp/dhcp?serial=${serial}`).then(json);
// }
// export async function apiGetOnboardStatus(serial) {
//   return fetch(`${API_BASE}/onboarding/ob-records?serial=${serial}`).then(json);
// }
// export async function apiSetEnvironment(serial, env) {
//   return fetch(`${API_BASE}/onboarding/setOnboardingEnvironment`, {
//     method:"POST",headers:{"Content-Type":"application/json"},
//     body:JSON.stringify({ serial, env })
//   }).then(json);
// }
// export async function apiTriggerOnboarding(serial) {
//   return fetch(`${API_BASE}/onboarding/trigger`, {
//     method:"POST",headers:{"Content-Type":"application/json"},
//     body:JSON.stringify({ serial })
//   }).then(json);
// }
// export async function apiFactoryReset(serial) {
//   return fetch(`${API_BASE}/device/factory-reset`, {
//     method:"POST",headers:{"Content-Type":"application/json"},
//     body:JSON.stringify({ serial })
//   }).then(json);
// }
// // ----- DEVICE INFO ---------------------------------------------------------
// export async function apiListDevice(serial) {
//   return fetch(`${API_BASE}/device/listDeviceRedisV2?serial=${serial}`).then(json);
// }
// export async function apiDeviceProvisioning(serial) {
//   return fetch(`${API_BASE}/device/deviceProvisioning?serial=${serial}`).then(json);
// }
// export async function apiDeviceHistory(serial) {
//   return fetch(`${API_BASE}/device/deviceHistory?serial=${serial}`).then(json);
// }
// // ----- METRICS -------------------------------------------------------------
// export async function apiMetric(name, serial) {
//   return fetch(`${API_BASE}/metrics/${name}?serial=${serial}`).then(json);
// }
*/

// -----------------------------------------------------------------------------
// 3. MOCK HELPERS – create lively demo data (default)
// -----------------------------------------------------------------------------
const USE_MOCK = true; // flip to false when you go live 🚀
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const initialOnboard = {
    dhcp: { 
      ip: `192.168.0.${rand(2, 254)}`,
      macAddress: `00:${rand(10, 99)}:${rand(10, 99)}:${rand(10, 99)}:${rand(10, 99)}:${rand(10, 99)}`,
      leaseStart: new Date(Date.now() - rand(1, 24) * 3600000).toISOString(),
      leaseEnd: new Date(Date.now() + rand(1, 72) * 3600000).toISOString()
    },
    status: "pending",
  };

  const initialDevice = {
    active: false,
    firmware: { 
      current: "1.0.0", 
      latest: "1.1.0", 
      progress: null,
      upgradeTime: null 
    },
    portConfig: [
      { 
        port: "GE1", 
        speed: "1 Gbps", 
        vlans: "100,200", 
        adminStatus: "up", 
        applied: false 
      },
      { 
        port: "GE2", 
        speed: "10 Gbps", 
        vlans: "300", 
        adminStatus: "down", 
        applied: true 
      }
    ],
    services: [
      { id: "IOD‑101", bandwidth: "1 Gb", applied: false },
      { id: "EOD‑202", bandwidth: "100 Mb", applied: false },
    ],
  };

const push = (arr, v, max = 30) => {
  const next = [...arr, v];
  if (next.length > max) next.shift();
  return next;
};

// -----------------------------------------------------------------------------
// 4. REUSABLE UI COMPONENTS
// -----------------------------------------------------------------------------
function PanelCard({ title, onSwagger, children }) {
  return (
    <Card className={`${styles['panel-card']} mb-3 flex-fill`}>
      <Card.Header className="d-flex justify-content-between align-items-center py-2">
        <span>{title}</span>
        {onSwagger && (
            <Button variant="link" size="sm" className="p-0 text-primary" onClick={onSwagger}>
                <FontAwesomeIcon icon="fal fa-pen" />
            </Button>
        )}
      </Card.Header>
      <Card.Body className="p-3 small d-flex flex-column">{children}</Card.Body>
    </Card>
  );
}

function SparkChart({ data, stroke = "#fb8429" }) { 
    return (
    <ResponsiveContainer width="100%" height={60} className={styles['metric-chart']}>
      <LineChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Tooltip formatter={(v) => v.toLocaleString()} labelStyle={{ display: "none" }} />
        <YAxis hide domain={[0, "dataMax"]} />
        <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// -----------------------------------------------------------------------------
// 5. MAIN DASHBOARD COMPONENT
// -----------------------------------------------------------------------------
export default function LmateDashboard({ serial = "DEMO‑123" }) {
  // state ------------------------------------------------------------------
  const [onboard, setOnboard] = useState(initialOnboard);
  const [device, setDevice] = useState(initialDevice);
  const [metrics, setMetrics] = useState({ tx: [], rx: [], latency: [], cpu: [], mem: [] });


  // polling loop (mock) ----------------------------------------------------
  useEffect(() => {
    if (!USE_MOCK) return; // live mode handled elsewhere

    const id = setInterval(() => {
      setOnboard((prev) => {
        const nextStatus = prev.status === "done" ? "done" : pick(["pending", "running", "done"]);
        return { ...prev, status: nextStatus };
      });

      setDevice((prev) => {
        // firmware progress simulation
        let { progress } = prev.firmware;
        if (progress === null && Math.random() < 0.1) {progress = 0;} // start upgrade
        else if (progress !== null) {progress += rand(10, 25);}
        if (progress >= 100) {progress = null;} // finished

        // apply services randomly
        const services = prev.services.map((s) => ({ ...s, applied: s.applied || Math.random() < 0.15 }));

        return {
          ...prev,
          active: prev.active || (onboard.status === "done" && Math.random() < 0.25),
          firmware: {
            ...prev.firmware,
            progress,
            current: progress === null && prev.firmware.progress !== null ? prev.firmware.latest : prev.firmware.current,
          },
          services,
        };
      });

      setMetrics((m) => ({
        tx: push(m.tx, { v: rand(100, 9000) }),
        rx: push(m.rx, { v: rand(200, 11000) }),
        latency: push(m.latency, { v: rand(1, 50) }),
        cpu: push(m.cpu, { v: rand(5, 95) }),
        mem: push(m.mem, { v: rand(100, 8000) }),
        opticalTx: push(m.opticalTx || [], { v: rand(-10, -2) }),
        opticalRx: push(m.opticalRx || [], { v: rand(-15, -5) }),
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [onboard.status]);

  // helpers ----------------------------------------------------------------
  const latest = (arr) => (arr.length ? arr[arr.length - 1].v : 0);
  const statusBadge = (status) => {
    const map = { pending: "secondary", running: "warning", done: "success" };
    return <Badge bg={map[status] || "secondary"}>{status}</Badge>;
  };

  // ------------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------------
  return (
    <Container fluid className={`${styles['device-dashboard-bg']} py-4`}>
      <Row className="flex-nowrap g-4 overflow-auto">
        {/* Column 1: Provision / On‑Board */}
        <Col xs={12} md={4} className="d-flex flex-column">
          <PanelCard title="Provision & On‑Board" onSwagger={() => console.log("Swagger: Onboard")}>
            <div className="mb-2 small text-muted">DHCP Lease</div>
            <Table size="sm" className="mb-3">
                <tbody>
                    <tr>
                        <td className="pe-2">IP</td>
                        <td>{onboard.dhcp.ip}</td>
                    </tr>
                    <tr>
                        <td>MAC</td>
                        <td>{onboard.dhcp.macAddress}</td>
                    </tr>
                    <tr>
                        <td>Lease Start</td>
                        <td>{new Date(onboard.dhcp.leaseStart).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>Lease End</td>
                        <td>{new Date(onboard.dhcp.leaseEnd).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td>Status</td>
                        <td>{statusBadge(onboard.status)}</td>
                    </tr>
                    <tr>
                        <td>Environment</td>
                        <td>{onboard.environment}</td>
                    </tr>
                </tbody>
            </Table>
            <div className="d-flex gap-2 mt-auto">
            <Button size="sm" variant="outline-primary" className={styles.buttonPrimary} onClick={() => console.log("Trigger Onboard")}>
                <FontAwesomeIcon icon="fal fa-sync-alt" className="me-1" /> Onboard
            </Button>
            <Button size="sm" variant="outline-danger" onClick={() => console.log("Factory Reset")}>
                <FontAwesomeIcon icon="fal fa-trash" className="me-1" /> Reset
            </Button>
            </div>
          </PanelCard>
        </Col>

        {/* Column 2: Activation & Config */}
        <Col xs={12} md={4} className="d-flex flex-column">
          <PanelCard title="Activation & Config" onSwagger={() => console.log("Swagger: Config")}>
            {/* Firmware Panel */}
            <div className="mb-2 fw-semibold text-primary">Firmware</div>
            <Table size="sm" className="mb-3">
              <tbody>
                <tr>
                  <td className="pe-2">Current</td>
                  <td>{device.firmware.current}</td>
                </tr>
                <tr>
                  <td>Latest</td>
                  <td>{device.firmware.latest}</td>
                </tr>
              </tbody>
            </Table>
            {device.firmware.progress !== null && (
              <ProgressBar now={device.firmware.progress} label={`${device.firmware.progress}%`} className="mb-3" />
            )}
            {/* Port Config */}
            <div className="mb-2 fw-semibold text-primary">Port Config</div>
            <Table size="sm" className="mb-3">
            <thead>
                <tr className="text-muted">
                <th>Port</th>
                <th>Speed</th>
                <th>VLANs</th>
                <th>Status</th>
                <th className="text-center">Applied</th>
                </tr>
            </thead>
            <tbody>
                {device.portConfig?.map((p) => (
                <tr key={p.port} className={p.applied ? styles['service-row-applied'] : styles['service-row-pending']}>
                    <td>{p.port}</td>
                    <td>{p.speed}</td>
                    <td>{p.vlans}</td>
                    <td>{p.adminStatus}</td>
                    <td className="text-center">
                    {p.applied ? <FontAwesomeIcon icon="fal fa-check-circle" /> : <FontAwesomeIcon icon="fal fa-times-circle" className="text-muted" />}
                    </td>
                </tr>
                ))}
            </tbody>
            </Table>
            {/* Services */}
            <div className="mb-2 fw-semibold text-primary">Services</div>
            <Table size="sm" className="mb-3">
              <thead>
                <tr className="text-muted">
                  <th>ID</th>
                  <th>Bandwidth</th>
                  <th className="text-center">Applied</th>
                </tr>
              </thead>
              <tbody>
                {device.services.map((s) => (
                    <tr key={s.id} className={s.applied ? styles['service-row-applied'] : styles['service-row-pending']}>
                    <td>{s.id}</td>
                    <td>{s.bandwidth}</td>
                    <td className="text-center">
                        {s.applied ? <FontAwesomeIcon icon="fal fa-check-circle" /> : <FontAwesomeIcon icon="fal fa-times-circle" className="text-muted" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {/* History placeholder */}
            <Button size="sm" variant="outline-secondary" onClick={() => alert("History fly‑out coming soon")}>View History ▶︎</Button>
          </PanelCard>
        </Col>

        {/* Column 3: Metrics Rail */}
        <Col xs={12} md={4} className="d-flex flex-column">
          <PanelCard title="Metrics Rail" onSwagger={() => console.log("Swagger: Metrics")}>
            <div className="mb-2 fw-semibold text-primary">Throughput Tx (bps): {latest(metrics.tx).toLocaleString()}</div>
            <SparkChart data={metrics.tx} />

            <div className="mb-2 mt-3 fw-semibold text-primary">Throughput Rx (bps): {latest(metrics.rx).toLocaleString()}</div>
            <SparkChart data={metrics.rx} stroke="#f95e4a" /> {/* Deep Orange */}

            <div className="mb-2 mt-3 fw-semibold text-primary">Latency (ms): {latest(metrics.latency)}</div>
            <SparkChart data={metrics.latency} stroke="#0f3133" /> {/* Dark Teal */}

            <div className="mb-2 mt-3 fw-semibold text-primary">Optical Tx Power (dBm): {latest(metrics.opticalTx || [])}</div>
            <SparkChart data={metrics.opticalTx || []} stroke="#b2fff6" /> {/* Seafoam */}

            <div className="mb-2 mt-3 fw-semibold text-primary">Optical Rx Power (dBm): {latest(metrics.opticalRx || [])}</div>
            <SparkChart data={metrics.opticalRx || []} stroke="#fff8b3" /> {/* Pale Yellow */}

            <div className="mb-2 mt-3 fw-semibold text-primary">CPU %: {latest(metrics.cpu)}%</div>
            <SparkChart data={metrics.cpu} stroke="#fdd219" /> {/* Deep Yellow */}

            <div className="mb-2 mt-3 fw-semibold text-primary">Memory Free (MiB): {latest(metrics.mem).toLocaleString()}</div>
            <SparkChart data={metrics.mem} stroke="#2aede5" /> {/* Bright Teal */}
          </PanelCard>
        </Col>
      </Row>
    </Container>
  );
}
