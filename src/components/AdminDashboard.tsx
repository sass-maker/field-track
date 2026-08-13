import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import type {
  EmployeeLocation, LiveRosterResponse, OnboardingOptionsResponse, OnboardingResult,
  RouteSummary, TrackingPolicy,
} from '../lib/types.ts';

const statusLabel = { active: 'Active', stale: 'Stale', offline: 'Offline', 'off-duty': 'Off duty' } as const;
const operationalStatus = (employee: EmployeeLocation): keyof typeof statusLabel => employee.enrollmentState !== 'reporting' ? 'offline' : employee.retentionState === 'ignored' ? 'off-duty' : employee.status;
const enrollmentLabel = { 'not-enrolled': 'Not enrolled', 'never-seen': 'Enrolled · waiting', reporting: 'Reporting' } as const;
const simLabel = { ok: 'SIM matches', absent: 'Selected SIM absent', 'number-unavailable': 'SIM number unavailable', mismatch: 'SIM number mismatch', 'not-reported': 'SIM not reported' } as const;

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

function relativeTime(value: string | null, now: number) {
  if (!value) return 'No location';
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}

function EmployeeMap({ employees, selectedId, route, onSelect }: {
  employees: EmployeeLocation[]; selectedId: string | null; route: RouteSummary | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      center: [77.209, 28.6139], zoom: 9.5,
      style: {
        version: 8,
        sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.current = instance;
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = employees.flatMap((employee) => {
      if (employee.latitude === null || employee.longitude === null) return [];
      const element = document.createElement('button');
      element.type = 'button';
      const currentStatus = operationalStatus(employee);
      element.className = `map-marker status-${currentStatus}${selectedId === employee.employeeId ? ' selected' : ''}`;
      element.setAttribute('aria-label', `${employee.name}, ${statusLabel[currentStatus]}`);
      element.addEventListener('click', () => onSelect(employee.employeeId));
      return [new maplibregl.Marker({ element }).setLngLat([employee.longitude, employee.latitude]).addTo(map.current!)];
    });
  }, [employees, onSelect, selectedId]);

  useEffect(() => {
    const current = map.current;
    if (!current) return;
    const update = () => {
      if (current.getLayer('employee-route')) current.removeLayer('employee-route');
      if (current.getSource('employee-route')) current.removeSource('employee-route');
      if (!route || route.points.length < 2) return;
      current.addSource('employee-route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.points.map((point) => [point.longitude, point.latitude]) } },
      });
      current.addLayer({ id: 'employee-route', type: 'line', source: 'employee-route', paint: { 'line-color': '#146b55', 'line-width': 5, 'line-opacity': 0.85 } });
      const bounds = route.points.reduce((value, point) => value.extend([point.longitude, point.latitude]), new maplibregl.LngLatBounds());
      current.fitBounds(bounds, { padding: 70, maxZoom: 14 });
    };
    current.loaded() ? update() : current.once('load', update);
    return () => {
      if (!current.getStyle()) return;
      if (current.getLayer('employee-route')) current.removeLayer('employee-route');
      if (current.getSource('employee-route')) current.removeSource('employee-route');
    };
  }, [route]);

  return <div ref={container} className="map-canvas" aria-label="Employee location map" />;
}

export default function AdminDashboard({ initialEmployeeId = null }: { initialEmployeeId?: string | null }) {
  const [roster, setRoster] = useState<LiveRosterResponse | null>(null);
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('all');
  const [region, setRegion] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(initialEmployeeId);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const [policies, setPolicies] = useState<TrackingPolicy[]>([]);
  const [policyId, setPolicyId] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [onboardingOptions, setOnboardingOptions] = useState<OnboardingOptionsResponse | null>(null);
  const [onboardingOptionsError, setOnboardingOptionsError] = useState(false);
  const [onboardingOptionsLoading, setOnboardingOptionsLoading] = useState(true);
  const [onboardingForbidden, setOnboardingForbidden] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingResult, setOnboardingResult] = useState<OnboardingResult | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({ employeeCode: '', name: '', phoneNumber: '', teamId: '', policyId: '' });
  const requestRunning = useRef(false);

  const loadRoster = useCallback(async () => {
    if (requestRunning.current) return;
    requestRunning.current = true;
    try {
      const response = await fetch('/api/live');
      if (!response.ok) throw new Error('Live roster is unavailable.');
      const result = await response.json() as LiveRosterResponse;
      setRoster(result); setError(null); setClock(Date.now());
      if (!selectedId && result.employees[0]) setSelectedId(result.employees[0].employeeId);
    } catch (value) { setError(value instanceof Error ? value.message : 'Live roster is unavailable.'); }
    finally { requestRunning.current = false; setLoading(false); }
  }, [selectedId]);

  useEffect(() => {
    void loadRoster();
    const polling = window.setInterval(loadRoster, 15_000);
    const ticking = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => { clearInterval(polling); clearInterval(ticking); };
  }, [loadRoster]);

  useEffect(() => {
    fetch('/api/policies').then(async (response) => {
      if (response.ok) setPolicies((await response.json() as { policies: TrackingPolicy[] }).policies);
    }).catch(() => undefined);
  }, []);

  const loadOnboardingOptions = useCallback(async () => {
    setOnboardingOptionsLoading(true); setOnboardingOptionsError(false); setOnboardingForbidden(false);
    try {
      const response = await fetch('/api/onboarding');
      if (response.status === 403) { setOnboardingForbidden(true); return; }
      if (!response.ok) throw new Error('Onboarding setup is unavailable.');
      const options = await response.json() as OnboardingOptionsResponse;
      setOnboardingOptions(options);
      setOnboardingForm((current) => ({
        ...current,
        teamId: current.teamId || options.teams[0]?.id || '',
        policyId: current.policyId || options.policies[0]?.id || '',
      }));
    } catch { setOnboardingOptionsError(true); }
    finally { setOnboardingOptionsLoading(false); }
  }, []);

  useEffect(() => {
    void loadOnboardingOptions();
  }, [loadOnboardingOptions]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    setRoute(null);
    fetch(`/api/employees/${encodeURIComponent(selectedId)}/route?date=${date}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Route history could not be loaded.');
        setRoute(await response.json() as RouteSummary);
      })
      .catch((value) => { if (value.name !== 'AbortError') setError(value.message); });
    return () => controller.abort();
  }, [date, selectedId]);

  const teams = useMemo(() => [...new Set(roster?.employees.map((employee) => employee.team) ?? [])], [roster]);
  const regions = useMemo(() => [...new Set(roster?.employees.map((employee) => employee.region) ?? [])], [roster]);
  const employees = useMemo(() => (roster?.employees ?? []).filter((employee) => {
    const text = `${employee.name} ${employee.employeeCode}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (team === 'all' || employee.team === team) &&
      (region === 'all' || employee.region === region) && (status === 'all' || operationalStatus(employee) === status);
  }), [query, region, roster, status, team]);
  const selected = roster?.employees.find((employee) => employee.employeeId === selectedId) ?? null;

  useEffect(() => { setPolicyId(selected?.policyId ?? ''); }, [selected?.policyId]);

  async function assignPolicy() {
    if (!selected || !policyId || roster?.demoMode) return;
    setSavingPolicy(true);
    try {
      const response = await fetch(`/api/employees/${encodeURIComponent(selected.employeeId)}/policy`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ policyId }),
      });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? 'Policy update failed.');
      await loadRoster(); setError(null);
    } catch (value) { setError(value instanceof Error ? value.message : 'Policy update failed.'); }
    finally { setSavingPolicy(false); }
  }

  function closeOnboarding() {
    if (onboardingResult && !codeCopied && !window.confirm('Close without confirming the enrollment code was copied? This code will not be shown again.')) return;
    setShowOnboarding(false);
    setOnboardingError(null);
    setOnboardingResult(null);
    setCodeCopied(false);
    setOnboardingForm((current) => ({ ...current, employeeCode: '', name: '', phoneNumber: '' }));
  }

  async function onboardEmployee(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setOnboardingBusy(true); setOnboardingError(null); setCodeCopied(false);
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(onboardingForm),
      });
      const result = await response.json() as OnboardingResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Employee onboarding failed.');
      setOnboardingResult(result);
      if (!result.demoMode) { setSelectedId(result.employeeId); await loadRoster(); }
    } catch (value) { setOnboardingError(value instanceof Error ? value.message : 'Employee onboarding failed.'); }
    finally { setOnboardingBusy(false); }
  }

  async function copyEnrollmentCode() {
    if (!onboardingResult) return;
    try { await navigator.clipboard.writeText(onboardingResult.enrollmentCode); setCodeCopied(true); }
    catch { setCodeCopied(false); setOnboardingError('Copy was blocked. Select the code and copy it manually.'); }
  }

  function onboardAnotherEmployee() {
    if (!codeCopied) return;
    setOnboardingResult(null); setCodeCopied(false); setOnboardingError(null);
    setOnboardingForm((current) => ({ ...current, employeeCode: '', name: '', phoneNumber: '' }));
  }

  return <section className="dashboard-shell">
    <header className="dashboard-header">
      <div><p className="eyebrow">Operations overview</p><h1>Field team, right now.</h1><p>Freshness is calculated from the employee’s last recorded point.</p></div>
      <div className="header-actions">
        {!onboardingForbidden && <button type="button" className="primary-button" disabled={onboardingOptionsLoading} onClick={() => onboardingOptionsError ? void loadOnboardingOptions() : (setShowOnboarding(true), setOnboardingResult(null))}>{onboardingOptionsError ? 'Retry onboarding' : onboardingOptionsLoading ? 'Loading onboarding…' : 'Onboard employee'}</button>}
        <div className="refresh-state" aria-live="polite"><span className={error || onboardingOptionsError ? 'error-dot' : ''} />{onboardingOptionsError ? 'Onboarding unavailable. Retry.' : error ?? `Updated ${relativeTime(roster?.generatedAt ?? null, clock)}`}</div>
      </div>
    </header>

    {showOnboarding && <section className="onboarding-panel" aria-labelledby="onboarding-title">
      <div className="onboarding-heading">
        <div><p className="eyebrow">Administrator setup</p><h2 id="onboarding-title">{onboardingResult ? 'Give this code to the employee.' : 'Onboard an employee.'}</h2></div>
        <button type="button" className="text-button" onClick={closeOnboarding}>{onboardingResult ? 'Done' : 'Close'}</button>
      </div>
      {onboardingResult ? <div className="code-handoff" aria-live="polite">
        <div><span>One-time Android enrollment code</span><output>{onboardingResult.enrollmentCode}</output></div>
        <button type="button" className="primary-button" onClick={copyEnrollmentCode}>{codeCopied ? 'Copied' : 'Copy code'}</button>
        <p><strong>{onboardingResult.employeeName}</strong> · {onboardingResult.employeeCode} · {onboardingResult.phoneNumber}</p>
        <p>Expires {new Date(onboardingResult.expiresAt).toLocaleString()}. This code will not be shown again after you close this panel.</p>
        <ol className="handoff-steps"><li>Open Field Track on the assigned Android phone.</li><li>Select the assigned active SIM.</li><li>Enter this code and grant the requested location access.</li></ol>
        {codeCopied && <button type="button" className="secondary-button next-employee-button" onClick={onboardAnotherEmployee}>Onboard another employee</button>}
        {onboardingResult.demoMode && <p className="demo-note">Preview only: demo mode does not persist this employee.</p>}
      </div> : <form className="onboarding-form" onSubmit={onboardEmployee}>
        <label><span>Employee name</span><input required autoComplete="off" value={onboardingForm.name} onChange={(event) => setOnboardingForm({ ...onboardingForm, name: event.target.value })} /></label>
        <label><span>Employee ID</span><input required autoCapitalize="characters" placeholder="FT-1092" value={onboardingForm.employeeCode} onChange={(event) => setOnboardingForm({ ...onboardingForm, employeeCode: event.target.value.toUpperCase() })} /></label>
        <label><span>Assigned mobile number</span><input required inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={onboardingForm.phoneNumber} onChange={(event) => setOnboardingForm({ ...onboardingForm, phoneNumber: event.target.value })} /></label>
        <label><span>Team</span><select required value={onboardingForm.teamId} onChange={(event) => setOnboardingForm({ ...onboardingForm, teamId: event.target.value })}>{onboardingOptions?.teams.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.region}</option>)}</select></label>
        <label><span>Retention policy</span><select required value={onboardingForm.policyId} onChange={(event) => setOnboardingForm({ ...onboardingForm, policyId: event.target.value })}>{onboardingOptions?.policies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button type="submit" className="primary-button" disabled={onboardingBusy}>{onboardingBusy ? 'Creating…' : 'Create employee and code'}</button>
        <p className="form-help">The phone number is the assignment record. Android SIM details are checked after the code is redeemed.</p>
      </form>}
      {onboardingError && <p className="form-error" role="alert">{onboardingError}</p>}
    </section>}

    <div className="summary-strip" aria-label="Employee status summary">
      {(['active', 'stale', 'offline', 'off-duty'] as const).map((item) => <div key={item}>
        <strong>{roster?.employees.filter((employee) => operationalStatus(employee) === item).length ?? '—'}</strong><span>{statusLabel[item]}</span>
      </div>)}
      {roster?.demoMode && <p className="demo-chip">Synthetic demo data</p>}
    </div>

    <div className="filter-bar">
      <label className="search-field"><span className="sr-only">Search employees</span><input type="search" placeholder="Search name or ID…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label><span>Team</span><select value={team} onChange={(event) => setTeam(event.target.value)}><option value="all">All teams</option>{teams.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Region</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="all">All regions</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>

    <div className="operations-grid">
      <div className="map-panel">
        <EmployeeMap employees={employees} selectedId={selectedId} route={route} onSelect={setSelectedId} />
        <p className="map-caption">Map tiles are a visual aid. The roster remains the accessible source of status and freshness.</p>
      </div>
      <div className="roster-panel">
        <div className="panel-heading"><h2>Employees</h2><span>{employees.length} shown</span></div>
        <div className="roster-list" aria-busy={loading}>
          {employees.map((employee) => <button type="button" className={`employee-row ${selectedId === employee.employeeId ? 'selected' : ''}`} key={employee.employeeId} onClick={() => setSelectedId(employee.employeeId)}>
            <span className={`status-mark status-${operationalStatus(employee)}`} aria-hidden="true" />
            <span className="employee-primary"><strong>{employee.name}</strong><small>{employee.employeeCode} · {employee.team}</small><small className={employee.simHealth !== 'ok' || employee.enrollmentState !== 'reporting' ? 'device-warning' : ''}>{employee.enrollmentState !== 'reporting' ? enrollmentLabel[employee.enrollmentState] : simLabel[employee.simHealth]}</small></span>
            <span className="employee-meta"><strong>{statusLabel[operationalStatus(employee)]}</strong><small>{relativeTime(employee.lastSeenAt, clock)}</small></span>
          </button>)}
          {!loading && employees.length === 0 && <p className="empty-state">No employees match these filters.</p>}
        </div>
      </div>
    </div>

    {selected && <section className="detail-panel" aria-labelledby="detail-title">
      <div className="detail-heading">
        <div><p className="eyebrow">Employee detail</p><h2 id="detail-title">{selected.name}</h2><p>{selected.employeeCode} · {selected.team} · {selected.region}</p></div>
        <label><span>Route date</span><input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setDate(event.target.value)} /></label>
      </div>
      <div className="metric-grid">
        <div><span>Enrollment</span><strong>{enrollmentLabel[selected.enrollmentState]}</strong></div>
        <div><span>Selected SIM</span><strong className={selected.simHealth !== 'ok' ? 'warn' : ''}>{simLabel[selected.simHealth]}{selected.simCarrierName ? ` · ${selected.simCarrierName}` : ''}</strong></div>
        <div><span>Assigned number</span><strong>{selected.phoneNumber ?? '—'}</strong></div>
        <div><span>Reported SIM number</span><strong className={selected.simHealth === 'mismatch' ? 'warn' : ''}>{selected.simPhoneNumber ?? 'Unavailable'}</strong></div>
        <div><span>Retention policy</span><strong>{selected.policyName ?? 'Unassigned'} · {selected.retentionState === 'retaining' ? 'Retaining now' : 'Ignoring now'}</strong></div>
        <div><span>Accuracy</span><strong>{selected.accuracyMeters === null ? '—' : `±${Math.round(selected.accuracyMeters)} m`}</strong></div>
        <div><span>Battery</span><strong>{selected.batteryPercentage === null ? '—' : `${selected.batteryPercentage}%`}</strong></div>
        <div><span>Route distance</span><strong>{route ? `${(route.approximateDistanceMeters / 1000).toFixed(1)} km` : 'Loading…'}</strong></div>
        <div><span>Points</span><strong>{route?.pointCount ?? '—'}</strong></div>
        <div><span>Tracking gaps</span><strong className={route?.gaps.length ? 'warn' : ''}>{route?.gaps.length ?? '—'}</strong></div>
      </div>
      {route?.gaps.length ? <div className="gap-list"><strong>Visible route gaps</strong>{route.gaps.map((gap) => <span key={gap.from}>{new Date(gap.from).toLocaleTimeString()} → {new Date(gap.to).toLocaleTimeString()} ({gap.minutes} min)</span>)}</div> : null}
      <div className="detail-actions">
        <div className="policy-control">
          <label><span>Server retention</span><select value={policyId} onChange={(event) => setPolicyId(event.target.value)} disabled={Boolean(roster?.demoMode)}>{policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
          <button type="button" className="secondary-button" onClick={assignPolicy} disabled={savingPolicy || Boolean(roster?.demoMode)}>{savingPolicy ? 'Saving…' : 'Apply policy'}</button>
        </div>
        <a className="secondary-button" href={`/admin/employees/${selected.employeeId}`}>Open dedicated detail page</a>
        <a className="primary-button" href={`/api/export.csv?employeeId=${encodeURIComponent(selected.employeeId)}&date=${date}`} download>Export this date as CSV</a>
      </div>
    </section>}
  </section>;
}
