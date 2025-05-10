flowchart LR
  %% ---------- North-bound: Browser ----------
  subgraph Browser ["👩‍💻  L-mate Demo (React 18 + react-bootstrap)"]
    direction TB

    PP["ProvisioningPanel<br/>(DHCP ✓ / AO ✓)"]:::panel
    SP["ServicePanel<br/>(Config diff + Firmware)"]:::panel
    MR["MetricsRail<br/>(Latency & Bytes/s)"]:::panel

    BrowserNote{{"Framer-motion<br/>animations +<br/>recharts sparklines"}}:::note
  end

  %% ---------- API proxy layer ----------
  subgraph PHP ["🌐 PHP API Proxy (/api/*)"]
    PHPProxy[(JWT-signing<br/>+ short cache)]:::service
  end

  Browser -->|REST GET JSON| PHPProxy

  %% ---------- South-bound: Network systems ----------
  subgraph AO ["🔧 Adapt Orchestrator (AO)"]
    listDev["listDeviceRedisV2"]:::api
    devProv["deviceProvisioning"]:::api
    devHist["deviceHistory"]:::api
    svcCfg["serviceConfig"]:::api
    trigOnb["triggerOnboarding"]:::api
  end

  subgraph RTO ["📊 Real-Time Orchestrator"]
    rtt["metrics/latency"]:::api
    bw["metrics/bytes"]:::api
  end

  subgraph DHCP_BOX ["📡 IBM / DHCP stack"]
    dhcp["dhcp?serial=…"]:::api
  end

  PHPProxy -->|forward + JWT| AO
  PHPProxy --> RTO
  PHPProxy --> DHCP_BOX

  %% ---------- Tooling ----------
  subgraph DevTool ["🧰 Dev toolchain"]
    Vite["Vite + TS"]:::note
    Swagger["Swagger (OpenAPI 3.1)<br/>→ types & client"]:::note
    Postman["Postman workspace"]:::note
  end

  Vite -.-> Browser
  Swagger -.codegen.-> Browser
  Swagger -.codegen.-> PHPProxy
  Postman -.test.-> AO
  Postman -.test.-> RTO

  %% ---------- Legends (styling) ----------
  classDef panel   fill:#eef5ff,stroke:#396ead,stroke-width:1.5px,rx:6,ry:6
  classDef service fill:#ffe7d9,stroke:#d76b08,stroke-width:1.5px,rx:6,ry:6
  classDef api     fill:#fff,stroke:#555,stroke-dasharray:3 3,rx:4,ry:4
  classDef note    fill:#ffffcc,stroke:#bba,stroke-width:1px,font-size:10px
