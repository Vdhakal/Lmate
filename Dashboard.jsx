// DeviceDashboard.jsx – L-Mate Demo Dashboard 🌐
// -----------------------------------------------------------------------------
// COMPLETE mock + live-ready build with step-checkbox flow
// -----------------------------------------------------------------------------
// • Three fixed columns: Provision/On-Board, Activation/Config, Metrics Rail
// • Mock polling every second so the UI animates without a backend
// • Font-Awesome icons via react-icons
// • Recharts sparklines for Metrics Rail
// • Real API stubs are provided (commented-out) for easy switch-over
// -----------------------------------------------------------------------------

import React, { useEffect, useState } from "react";
import {
  Container, Row, Col, Card, Button,
  Table, ProgressBar, ListGroup
} from "react-bootstrap";
import {
  FaPen as PencilIcon,
  FaSyncAlt as ReloadIcon,
  FaTrash as TrashIcon,
  FaCheckCircle as CheckIcon,
  FaRegCircle as PendingIcon,
  FaSpinner as SpinnerIcon
} from "react-icons/fa";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, YAxis
} from "recharts";

/* ---------------------------------------------------------------------------
   REAL API IMPLEMENTATIONS – ***commented-out***
---------------------------------------------------------------------------

const API_BASE = "https://ao.internal/api";
const json = (r) => (r.ok ? r.json() : Promise.reject(r.statusText));

export const api = {
  dhcp:           (serial)      => fetch(`${API_BASE}/ztp/dhcp?serial=${serial}`).then(json),
  obRecords:      (serial)      => fetch(`${API_BASE}/onboarding/ob-records?serial=${serial}`).then(json),
  setEnv:         (serial,env)  => fetch(`${API_BASE}/onboarding/setOnboardingEnvironment`, {
                                       method:"POST",
                                       headers:{"Content-Type":"application/json"},
                                       body:JSON.stringify({serial,env})}).then(json),
  triggerOnboard: (serial)      => fetch(`${API_BASE}/onboarding/trigger`,{
                                       method:"POST",
                                       headers:{"Content-Type":"application/json"},
                                       body:JSON.stringify({serial})}).then(json),
  factoryReset:   (serial)      => fetch(`${API_BASE}/device/factory-reset`,{method:"POST"}).then(json),
  listDevice:     (serial)      => fetch(`${API_BASE}/device/listDeviceRedisV2?serial=${serial}`).then(json),
  deviceProv:     (serial)      => fetch(`${API_BASE}/device/deviceProvisioning?serial=${serial}`).then(json),
  deviceHist:     (serial)      => fetch(`${API_BASE}/device/deviceHistory?serial=${serial}`).then(json),
  metric:         (name,serial) => fetch(`${API_BASE}/metrics/${name}?serial=${serial}`).then(json),
};
*/

// -----------------------------------------------------------------------------
// MOCK SIMULATION
// -----------------------------------------------------------------------------
const USE_MOCK = true;
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = (arr)       => arr[Math.floor(Math.random() * arr.length)];
const push  = (arr, v, max = 30) => (arr.length >= max ? [...arr.slice(1), v] : [...arr, v]);

const initialOnboard = {
  dhcp : {
    mac        : `AA:BB:CC:${rand(10,99)}:${rand(10,99)}:${rand(10,99)}`,
    ip         : `192.168.0.${rand(2,254)}`,
    leaseStart : new Date(Date.now()-60000).toLocaleTimeString(),
    leaseEnd   : new Date(Date.now()+3600000).toLocaleTimeString()
  },
  status      : "pending",          // pending → running → done
  environment : pick(["dev","qa","prod"])
};

const initialDevice = {
  active     : false,
  firmware   : {
    current : "1.0.0",
    latest  : "1.1.0",
    progress: null,
    upgradeTime: null
  },
  services   : [
    {id:"IOD-101", bw:"1 Gb",   applied:false},
    {id:"EOD-202", bw:"100 Mb", applied:false},
  ],
  portDiff   : [
    {name:"1/1", speed:"1 Gb", vlans:"10,20", admin:"up", applied:false},
    {name:"1/2", speed:"10 Gb",vlans:"30",    admin:"down", applied:false},
  ]
};

// ordered step flow for checkbox rail
const STEP_FLOW = [
  {key:"dhcp",         label:"DHCP Lease"},
  {key:"obRecords",    label:"O.B Records"},
  {key:"onboard",      label:"AO Onboard"},
  {key:"deviceActive", label:"Device Active"},
];

// -----------------------------------------------------------------------------
// REUSABLE
// -----------------------------------------------------------------------------
function PanelCard({title, children, onSwagger}) {
  return (
    <Card className="panel-card mb-3 flex-fill h-100">
      <Card.Header className="d-flex justify-content-between align-items-center py-2">
        <span>{title}</span>
        {onSwagger && (
          <Button
            variant="link"
            size="sm"
            className="p-0 text-primary"
            onClick={onSwagger}
          >
            <PencilIcon />
          </Button>
        )}
      </Card.Header>
      <Card.Body className="p-3 d-flex flex-column small">{children}</Card.Body>
    </Card>
  );
}

const Spark = ({data, stroke}) => (
  <ResponsiveContainer width="100%" height={60}>
    <LineChart data={data}>
      <Tooltip
        formatter={(v) => v.toLocaleString()}
        labelStyle={{display:"none"}}
      />
      <YAxis hide domain={[0, "dataMax"]} />
      <Line
        dataKey="v"
        type="monotone"
        stroke={stroke}
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  </ResponsiveContainer>
);

const StepRail = ({completed, current}) => (
  <ListGroup variant="flush" className="step-list mb-3">
    {STEP_FLOW.map((s) => {
      let icon;
      if (completed[s.key])        icon = <CheckIcon className="text-success"/>;
      else if (s.key === current)  icon = <SpinnerIcon className="text-warning spinner-border-sm spin"/>; // add CSS `.spin {animation: spin 1s linear infinite}`
      else                         icon = <PendingIcon className="text-muted"/>;
      return (
        <ListGroup.Item key={s.key} className="d-flex align-items-center gap-2">
          {icon}
          <span>{s.label}</span>
        </ListGroup.Item>
      );
    })}
  </ListGroup>
);

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------
export default function DeviceDashboard({serial="DEMO-123"}) {

  const [onboard, setOnboard] = useState(initialOnboard);
  const [device , setDevice ] = useState(initialDevice);
  const [metrics, setMetrics] = useState({
    tx:[], rx:[], latency:[],
    optTx:[], optRx:[],
    cpu:[], mem:[]
  });

  // MOCK POLLING -----------------------------------------------------------
  useEffect(() => {
    if (!USE_MOCK) return;
    const id = setInterval(() => {
      // ----- onboarding progression -----
      setOnboard(prev => {
        let status = prev.status;
        if (status === "pending")            status = "running";
        else if (status === "running" && Math.random()<0.3) status = "done";
        return {...prev, status};
      });

      // ----- device progression -----
      setDevice(prev => {
        const d = {...prev};

        // activate device once onboarding done
        if (onboard.status === "done" && !d.active && Math.random()<0.3) {
          d.active = true;
        }

        // firmware progress
        let p = d.firmware.progress;
        if (p === null && Math.random()<0.1)         p = 0;
        else if (p !== null)                         p += rand(15,25);
        if (p >= 100) {
          p = null;
          d.firmware.current = d.firmware.latest;
          d.firmware.upgradeTime = new Date().toLocaleTimeString();
        }
        d.firmware.progress = p;

        // apply services
        d.services = d.services.map(s => ({
          ...s,
          applied: s.applied || Math.random()<0.2
        }));

        // port diff status
        d.portDiff = d.portDiff.map(pf => ({
          ...pf,
          applied: pf.applied || Math.random()<0.15
        }));

        return d;
      });

      // ----- metrics roll -----
      setMetrics(m => ({
        tx      : push(m.tx     , {v: rand(100 , 9000 )}),
        rx      : push(m.rx     , {v: rand(200 ,11000 )}),
        latency : push(m.latency, {v: rand(1   ,   50 )}),
        optTx   : push(m.optTx  , {v: rand(-3  ,    3 )}), // dBm
        optRx   : push(m.optRx  , {v: rand(-9  ,    0 )}), // dBm
        cpu     : push(m.cpu    , {v: rand(5   ,   95 )}),
        mem     : push(m.mem    , {v: rand(500 , 8000 )}),
      }));
    }, 1000);
    return () => clearInterval(id);
  }, [onboard.status]);

  // step-rail helpers ------------------------------------------------------
  const completed = {
    dhcp        : Boolean(onboard.dhcp.ip),
    obRecords   : onboard.status !== "pending",
    onboard     : onboard.status === "done",
    deviceActive: device.active
  };
  const currentStep = STEP_FLOW.find(s => !completed[s.key])?.key ?? null;

  // metric helpers ---------------------------------------------------------
  const latest = arr => arr.length ? arr[arr.length-1].v : 0;

  // RENDER -----------------------------------------------------------------
  return (
    <Container fluid className="device-dashboard-bg py-4">
      <Row className="flex-nowrap g-4 overflow-auto">
        {/* --- Provision / On-Board ------------------------------------------------ */}
        <Col xs={12} md={4} className="d-flex flex-column">
          <PanelCard title="Provision & On-Board" onSwagger={() => console.log("Swagger: Onboard")}>
            <Table size="sm" className="mb-3">
              <tbody>
                <tr><td className="pe-2">MAC</td><td>{onboard.dhcp.mac}</td></tr>
                <tr><td>IP</td><td>{onboard.dhcp.ip}</td></tr>
                <tr><td>Lease</td><td>{onboard.dhcp.leaseStart} → {onboard.dhcp.leaseEnd}</td></tr>
                <tr><td>Env</td><td>{onboard.environment}</td></tr>
              </tbody>
            </Table>

            <StepRail completed={completed} current={currentStep} />

            <div className="mt-auto d-flex gap-2">
              <Button size="sm" variant="outline-primary"><ReloadIcon /> Onboard</Button>
              <Button size="sm" variant="outline-danger"><TrashIcon /> Reset</Button>
            </div>
          </PanelCard>
        </Col>

        {/* --- Activation & Config -------------------------------------------------- */}
        <Col xs={12} md={4} className="d-flex flex-column">
          <PanelCard title="Activation & Config" onSwagger={() => console.log("Swagger: Config")}>
            {/* Firmware */}
            <div className="mb-2 fw-semibold text-primary">Firmware</div>
            <Table size="sm" className="mb-2"><tbody>
              <tr><td className="pe-2">Current</td><td>{device.firmware.current}</td></tr>
              <tr><td>Latest</td><td>{device.firmware.latest}</td></tr>
              <tr><td>Upgrade Time</td><td>{device.firmware.upgradeTime ?? "—"}</td></tr>
            </tbody></Table>
            {device.firmware.progress!==null &&
              <ProgressBar now={device.firmware.progress} label={`${device.firmware.progress}%`} className="mb-3" />}

            {/* Port Config Diff */}
            <div className="mb-2 fw-semibold text-primary">Port Config Diff</div>
            <Table size="sm" className="mb-3">
              <thead className="text-muted"><tr>
                <th>Port</th><th>Speed</th><th>VLANs</th><th>Status</th><th className="text-center">Applied</th>
              </tr></thead>
              <tbody>
                {device.portDiff.map(pf => (
                  <tr key={pf.name} className={pf.applied ? "service-row applied" : "service-row pending"}>
                    <td>{pf.name}</td><td>{pf.speed}</td><td>{pf.vlans}</td><td>{pf.admin}</td>
                    <td className="text-center">{pf.applied ? <CheckIcon/> : <PendingIcon className="text-muted"/>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {/* Services */}
            <div className="mb-2 fw-semibold text-primary">Services</div>
            <Table size="sm" className="mb-3">
              <thead className="text-muted"><tr>
                <th>ID</th><th>BW</th><th className="text-center">Applied</th>
              </tr></thead>
              <tbody>
                {device.services.map(s => (
                  <tr key={s.id} className={s.applied ? "service-row applied" : "service-row pending"}>
                    <td>{s.id}</td><td>{s.bw}</td>
                    <td className="text-center">{s.applied ? <CheckIcon/> : <PendingIcon className="text-muted"/>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <Button size="sm" variant="outline-secondary" onClick={() => alert("History fly-out coming soon")}>
              View History ▶︎
            </Button>
          </PanelCard>
        </Col>

        {/* --- Metrics Rail -------------------------------------------------------- */}
        <Col xs={12} md={4} className="d-flex flex-column">
          <PanelCard title="Metrics Rail" onSwagger={() => console.log("Swagger: Metrics")}>
            {/* Tx / Rx */}
            <div className="mb-1 fw-semibold text-primary">Tx (bps): {latest(metrics.tx).toLocaleString()}</div>
            <Spark data={metrics.tx} stroke="#0d6efd"/>

            <div className="mb-1 mt-3 fw-semibold text-primary">Rx (bps): {latest(metrics.rx).toLocaleString()}</div>
            <Spark data={metrics.rx} stroke="#6610f2"/>

            {/* Latency */}
            <div className="mb-1 mt-3 fw-semibold text-primary">Latency (ms): {latest(metrics.latency)}</div>
            <Spark data={metrics.latency} stroke="#d63384"/>

            {/* Optical Power */}
            <div className="mb-1 mt-3 fw-semibold text-primary">Optical Tx (dBm): {latest(metrics.optTx)}</div>
            <Spark data={metrics.optTx} stroke="#20c997"/>

            <div className="mb-1 mt-3 fw-semibold text-primary">Optical Rx (dBm): {latest(metrics.optRx)}</div>
            <Spark data={metrics.optRx} stroke="#0dcaf0"/>

            {/* CPU & Memory */}
            <div className="mb-1 mt-3 fw-semibold text-primary">CPU %: {latest(metrics.cpu)}%</div>
            <Spark data={metrics.cpu} stroke="#fd7e14"/>

            <div className="mb-1 mt-3 fw-semibold text-primary">Memory (MiB free): {latest(metrics.mem).toLocaleString()}</div>
            <Spark data={metrics.mem} stroke="#198754"/>
          </PanelCard>
        </Col>
      </Row>
    </Container>
  );
}

/* ------------- tiny CSS hook for spinner icon -----------------
.spin { animation: spin 1s linear infinite; }
@keyframes spin { 100% { transform: rotate(360deg); } }
----------------------------------------------------------------*/
