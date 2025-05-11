import React, {useEffect, useState} from "react";
import {Container,Row,Col,Card,Table,Button,ProgressBar,ListGroup} from "react-bootstrap";
import {FaCheckCircle, FaRegCircle, FaSyncAlt, FaTrash, FaSpinner} from "react-icons/fa";
import {LineChart,Line,YAxis,Tooltip,ResponsiveContainer} from "recharts";
import {api} from "./api";
import "./DeviceDashboard.css";          // your existing stylesheet

// ---- helpers --------------------------------------------------------------
const STEP_FLOW = ["dhcp","obRecords","onboard","deviceActive"];

const push = (arr,v,max=30)=>(arr.length>=max?[...arr.slice(1),v]:[...arr,v]);
const latest = a => a.length?a[a.length-1].v:0;

// ---- Metric sparkline -----------------------------------------------------
const Spark = ({data,stroke})=>(
  <ResponsiveContainer width="100%" height={60}>
    <LineChart data={data}>
      <Tooltip formatter={v=>v.toLocaleString()} labelStyle={{display:"none"}} />
      <YAxis hide domain={[0,"dataMax"]}/>
      <Line dataKey="v" type="monotone" stroke={stroke} strokeWidth={2} dot={false}
            isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer>
);

// ---- Dashboard ------------------------------------------------------------
export default function DeviceDashboard({serial="DEMO-123"}) {
  const [onboard , setOnboard ] = useState({});
  const [device  , setDevice  ] = useState({});
  const [firmware, setFirmware] = useState({});
  const [metrics , setMetrics ] = useState({tx:[],rx:[],lat:[],cpu:[],mem:[],optTx:[],optRx:[]});

  // 1. poll provisioning & device info -------------------------------------
  useEffect(()=>{
    const id = setInterval(async ()=>{
      const [d,res,dev,prov] = await Promise.all([
        api.dhcp(serial),
        api.obRecords(serial),
        api.listDevice(serial),
        api.deviceProv(serial)
      ]);

      setOnboard({dhcp:d, status:res.status});
      setDevice({active:dev.active});
      setFirmware(prov);
    }, 3_000);
    return ()=>clearInterval(id);
  },[serial]);

  // 2. metrics streaming ----------------------------------------------------
  useEffect(()=>{
    const id = setInterval(async ()=>{
      const mt = await Promise.all([
        api.metric("ethernet-bytes-sent-usage",serial),
        api.metric("ethernet-bytes-rcvd-usage",serial),
        api.metric("ping",serial),
        api.metric("cpu-usage",serial),
        api.metric("memory-free",serial),
        api.metric("optical-tx",serial),
        api.metric("optical-rx",serial),
      ]);
      setMetrics(m=>({
        tx   :push(m.tx   ,{v:mt[0].value}),
        rx   :push(m.rx   ,{v:mt[1].value}),
        lat  :push(m.lat  ,{v:mt[2].value}),
        cpu  :push(m.cpu  ,{v:mt[3].value}),
        mem  :push(m.mem  ,{v:mt[4].value}),
        optTx:push(m.optTx,{v:mt[5].value}),
        optRx:push(m.optRx,{v:mt[6].value}),
      }));
    }, 1_000);
    return ()=>clearInterval(id);
  },[serial]);

  // 3. step-rail ------------------------------------------------------------
  const completed = {
    dhcp        : !!onboard.dhcp?.ip,
    obRecords   : onboard.status && onboard.status!=="pending",
    onboard     : onboard.status==="done",
    deviceActive: device.active
  };
  const current  = STEP_FLOW.find(k=>!completed[k])??null;

  const stepIcon = (k)=>completed[k]
    ?<FaCheckCircle className="text-success"/>
    :k===current
      ?<FaSpinner className="spin text-warning"/>
      :<FaRegCircle className="text-muted"/>;

  // 4. render ---------------------------------------------------------------
  return (
    <Container fluid className="py-4">
      <Row className="g-3 flex-nowrap overflow-auto">

        {/* --- Provision / On-Board --------------------------------------- */}
        <Col xs={12} md={4}>
          <Card className="h-100 panel">
            <Card.Header className="py-2">Provision &amp; On-Board</Card.Header>
            <Card.Body className="small">

              <Table size="sm"><tbody>
                <tr><td>MAC</td><td>{onboard.dhcp?.macAddress}</td></tr>
                <tr><td>IP</td><td>{onboard.dhcp?.ip}</td></tr>
                <tr><td>Lease</td>
                    <td>{onboard.dhcp?.leaseStart && new Date(onboard.dhcp.leaseStart).toLocaleTimeString()}
                        {" → "}
                        {onboard.dhcp?.leaseEnd && new Date(onboard.dhcp.leaseEnd).toLocaleTimeString()}
                    </td></tr>
              </tbody></Table>

              <ListGroup variant="flush" className="mb-3">
                {STEP_FLOW.map(k=>(
                  <ListGroup.Item key={k} className="d-flex align-items-center gap-2">
                    {stepIcon(k)}<span className="text-capitalize">{k}</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>

              <div className="d-flex gap-2">
                <Button size="sm" variant="outline-primary"><FaSyncAlt/> Onboard</Button>
                <Button size="sm" variant="outline-danger"><FaTrash/> Reset</Button>
              </div>

            </Card.Body>
          </Card>
        </Col>

        {/* --- Activation & Config ---------------------------------------- */}
        <Col xs={12} md={4}>
          <Card className="h-100 panel">
            <Card.Header className="py-2">Activation &amp; Config</Card.Header>
            <Card.Body className="small">

              <h6 className="text-primary">Firmware</h6>
              <Table size="sm"><tbody>
                <tr><td>Current</td><td>{firmware.current}</td></tr>
                <tr><td>Latest</td><td>{firmware.latest}</td></tr>
              </tbody></Table>
              {typeof firmware.progress==="number" &&
                <ProgressBar now={firmware.progress} label={`${firmware.progress}%`} className="mb-3"/>}

              {/* TODO: bring Port-Diff + Services tables from your earlier version */}

            </Card.Body>
          </Card>
        </Col>

        {/* --- Metrics Rail ----------------------------------------------- */}
        <Col xs={12} md={4}>
          <Card className="h-100 panel">
            <Card.Header className="py-2">Metrics Rail</Card.Header>
            <Card.Body>

              <div className="metric">
                <span className="label">Tx (bps) – {latest(metrics.tx).toLocaleString()}</span>
                <Spark data={metrics.tx} stroke="#0d6efd"/>
              </div>

              <div className="metric mt-3">
                <span className="label">Rx (bps) – {latest(metrics.rx).toLocaleString()}</span>
                <Spark data={metrics.rx} stroke="#6610f2"/>
              </div>

              <div className="metric mt-3">
                <span className="label">Latency (ms) – {latest(metrics.lat)}</span>
                <Spark data={metrics.lat} stroke="#d63384"/>
              </div>

              <div className="metric mt-3">
                <span className="label">CPU % – {latest(metrics.cpu)}</span>
                <Spark data={metrics.cpu} stroke="#fd7e14"/>
              </div>

              <div className="metric mt-3">
                <span className="label">Mem free (MiB) – {latest(metrics.mem)}</span>
                <Spark data={metrics.mem} stroke="#198754"/>
              </div>

              <div className="metric mt-3">
                <span className="label">Opt TX (dBm) – {latest(metrics.optTx)}</span>
                <Spark data={metrics.optTx} stroke="#20c997"/>
              </div>

              <div className="metric mt-3">
                <span className="label">Opt RX (dBm) – {latest(metrics.optRx)}</span>
                <Spark data={metrics.optRx} stroke="#0dcaf0"/>
              </div>

            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
