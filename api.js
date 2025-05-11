// api.js – real-first, mock-fallback helpers
//-------------------------------------------------
const API_BASE  = "/api";              // adjust if your PHP root differs
const TIMEOUT   = 4_000;               // ms before we bail to mock

const tryFetch = async (path, mockFn, opts={}) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}${path}`, {...opts, signal:ctrl.signal});
    clearTimeout(timer);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (err) {
    // console.info("⇢ falling back to mock:", path, err?.message);
    return mockFn();
  }
};

// ---------------- MOCK BUILDERS -----------------
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = (arr)      => arr[Math.floor(Math.random() * arr.length)];
const now   = ()          => new Date().toISOString();

export const api = {
  dhcp: (serial) => tryFetch(
    `/ztp/dhcp?serial=${serial}`,
    () => ({
      macAddress : `AA:BB:CC:${rand(10,99)}:${rand(10,99)}:${rand(10,99)}`,
      ip         : `192.168.0.${rand(2,254)}`,
      leaseStart : now(),
      leaseEnd   : new Date(Date.now()+3.6e6).toISOString()
    })
  ),

  obRecords: (serial) => tryFetch(
    `/onboarding/ob-records?serial=${serial}`,
    () => ({status: pick(["pending","running","done"])}),
  ),

  setEnv: (serial, env) => tryFetch(
    `/onboarding/setOnboardingEnvironment`,
    () => ({ok:true, env, serial}),
    {method:"POST", headers:{"Content-Type":"application/json"},
     body:JSON.stringify({serial,env})}
  ),

  listDevice: (serial) => tryFetch(
    `/device/listDeviceRedisV2?serial=${serial}`,
    () => ({
      active  : Math.random()<0.4,
      firmware: {current:"1.0.0", latest:"1.1.0"}
    })
  ),

  deviceProv: (serial) => tryFetch(
    `/device/deviceProvisioning?serial=${serial}`,
    () => ({
      current:"1.0.0", latest:"1.1.0",
      progress: rand(0,100), upgradeTime:null
    })
  ),

  deviceHist: (serial) => tryFetch(
    `/device/deviceHistory?serial=${serial}`,
    () => ({events:[]})
  ),

  triggerOnboard: (serial) => tryFetch(
    `/onboarding/trigger`,
    () => ({ok:true, triggeredAt:now(), serial}),
    {method:"POST", headers:{"Content-Type":"application/json"},
     body:JSON.stringify({serial})}
  ),

  factoryReset: (serial) => tryFetch(
    `/device/factory-reset`,
    () => ({ok:true, serial}),
    {method:"POST", headers:{"Content-Type":"application/json"},
     body:JSON.stringify({serial})}
  ),

  metric: (name, serial) => tryFetch(
    `/metrics/${name}?serial=${serial}`,
    () => ({value: rand(100,9000), ts: now()})
  ),
};
