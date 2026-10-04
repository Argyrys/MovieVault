import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi, setAdminToken } from '../lib/api.js';
import './Admin.css';

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`admin-toggle ${checked ? 'on' : ''}`}
      onClick={onChange}
    >
      <span className="admin-toggle-knob" />
    </button>
  );
}

export default function Admin() {
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [dash, setDash] = useState(null);
  const [providers, setProviders] = useState([]);
  const [rows, setRows] = useState([]);
  const [dbMissing, setDbMissing] = useState(false);
  const [panelError, setPanelError] = useState(null);
  const [flash, setFlash] = useState(null);
  const originalsRef = useRef({});

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  const showFlash = useCallback((msg) => {
    setFlash(msg);
    setTimeout(() => setFlash((cur) => (cur === msg ? null : cur)), 2500);
  }, []);

  const loadPanel = useCallback(async () => {
    setPanelError(null);
    setDbMissing(false);
    try {
      const [d, p, r] = await Promise.all([
        adminApi.dashboard(),
        adminApi.providers(),
        adminApi.homeRows(),
      ]);
      setDash(d);
      setProviders(p.providers);
      setRows(r.rows);
      originalsRef.current = Object.fromEntries(r.rows.map((row) => [row.id, row.label]));
    } catch (err) {
      if (err.status === 401) {
        setAdmin(null);
        return;
      }
      if (err.status === 503) setDbMissing(true);
      setPanelError(err.message);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    adminApi
      .me()
      .then((a) => alive && setAdmin(a))
      .catch(() => {})
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (admin) loadPanel();
  }, [admin, loadPanel]);

  const doLogin = async (e) => {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    try {
      const res = await adminApi.login(loginEmail.trim(), loginPassword);
      setAdminToken(res.token);
      setAdmin({ id: res.admin.id, email: res.admin.email, displayName: res.admin.displayName });
      setLoginPassword('');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginBusy(false);
    }
  };

  const logout = () => {
    setAdminToken(null);
    setAdmin(null);
    setDash(null);
    setProviders([]);
    setRows([]);
  };

  const toggleProvider = async (p) => {
    try {
      const res = await adminApi.updateProvider(p.id, { enabled: !p.enabled });
      setProviders((list) => list.map((x) => (x.id === p.id ? res.provider : x)));
      showFlash(`${p.name} ${res.provider.enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showFlash(err.message);
    }
  };

  const savePriority = async (p, value) => {
    const next = Number(value);
    if (!Number.isInteger(next) || next < 1 || next > 1000 || next === p.priority) return;
    try {
      const res = await adminApi.updateProvider(p.id, { priority: next });
      setProviders((list) => list.map((x) => (x.id === p.id ? res.provider : x)));
      showFlash(`${p.name} priority → ${next}`);
    } catch (err) {
      showFlash(err.message);
    }
  };

  const toggleRow = async (r) => {
    try {
      await adminApi.updateHomeRow(r.id, { enabled: !r.enabled });
      setRows((list) => list.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)));
      showFlash(`“${r.label}” ${r.enabled ? 'hidden' : 'shown'}`);
    } catch (err) {
      showFlash(err.message);
    }
  };

  const moveRow = async (r, dir) => {
    const idx = rows.findIndex((x) => x.id === r.id);
    const target = rows[idx + dir];
    if (!target) return;
    try {
      await adminApi.updateHomeRow(r.id, { sortOrder: target.sortOrder + (dir < 0 ? -1 : 1) });
      const fresh = await adminApi.homeRows();
      setRows(fresh.rows);
      showFlash(`Moved “${r.label}” ${dir < 0 ? 'up' : 'down'}`);
    } catch (err) {
      showFlash(err.message);
    }
  };

  const editLabel = (id, label) => {
    setRows((list) => list.map((x) => (x.id === id ? { ...x, label } : x)));
  };

  const saveLabel = async (r) => {
    const original = originalsRef.current[r.id];
    if (!r.label.trim() || r.label === original) return;
    try {
      const res = await adminApi.updateHomeRow(r.id, { label: r.label.trim() });
      setRows((list) => list.map((x) => (x.id === r.id ? res.row : x)));
      originalsRef.current[r.id] = res.row.label;
      showFlash('Label saved');
    } catch (err) {
      showFlash(err.message);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError(null);
    if (pwNext !== pwConfirm) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      await adminApi.changePassword(pwCurrent, pwNext);
      setPwCurrent('');
      setPwNext('');
      setPwConfirm('');
      showFlash('Password changed');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  if (checking) return <div className="page-state">Checking session…</div>;

  if (!admin) {
    return (
      <div className="admin">
        <form className="admin-login" onSubmit={doLogin}>
          <span className="admin-badge">Admin</span>
          <h1>Sign in</h1>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </label>
          {loginError && <p className="admin-error">{loginError}</p>}
          <button type="submit" className="admin-primary" disabled={loginBusy}>
            {loginBusy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <span className="admin-badge">Admin</span>
          <h1>Control Panel</h1>
          <p className="admin-sub">{admin.displayName || admin.email}</p>
        </div>
        <button type="button" className="admin-ghost" onClick={logout}>
          Log out
        </button>
      </div>

      {flash && <div className="admin-flash">{flash}</div>}

      {dbMissing && (
        <div className="admin-banner">
          Database not connected on this deployment — set <code>DATABASE_URL</code> to enable the
          panel. Everything below is read-only until then.
        </div>
      )}
      {panelError && !dbMissing && <div className="admin-banner">{panelError}</div>}

      <section className="admin-section">
        <h2>Overview</h2>
        <div className="admin-stats">
          <div className="admin-stat">
            <strong>{dbMissing ? '—' : dash ? 'Up' : '…'}</strong>
            <span>Database</span>
          </div>
          <div className="admin-stat">
            <strong>{dash ? `${dash.providersEnabled}/${dash.providers}` : '—'}</strong>
            <span>Providers on</span>
          </div>
          <div className="admin-stat">
            <strong>{dash ? `${dash.rowsEnabled}/${dash.rows}` : '—'}</strong>
            <span>Home rows on</span>
          </div>
          <div className="admin-stat">
            <strong>{dash ? dash.titles : '—'}</strong>
            <span>Titles in DB</span>
          </div>
          <div className="admin-stat">
            <strong>{dash ? dash.downloads24h : '—'}</strong>
            <span>Downloads 24h</span>
          </div>
          <div className="admin-stat">
            <strong>{dash ? dash.admins : '—'}</strong>
            <span>Admins</span>
          </div>
        </div>
      </section>

      <section className="admin-section">
        <h2>Stream Providers</h2>
        <p className="admin-hint">Lower priority number = tried first. Toggles apply to new stream lookups instantly.</p>
        <div className="admin-list">
          {providers.map((p) => (
            <div className="admin-item" key={p.id}>
              <div className="admin-item-main">
                <strong>{p.name}</strong>
                <span className={`admin-type ${p.type}`}>{p.type}</span>
              </div>
              <label className="admin-prio">
                Priority
                <input
                  type="number"
                  min="1"
                  max="1000"
                  defaultValue={p.priority}
                  onBlur={(e) => savePriority(p, e.target.value)}
                />
              </label>
              <Toggle
                checked={p.enabled}
                onChange={() => toggleProvider(p)}
                label={`${p.name} enabled`}
              />
            </div>
          ))}
          {providers.length === 0 && !panelError && <p className="admin-empty">Loading…</p>}
        </div>
      </section>

      <section className="admin-section">
        <h2>Home Page Rows</h2>
        <p className="admin-hint">Reorder, rename or hide rows on the home page. Changes appear immediately.</p>
        <div className="admin-list">
          {rows.map((r, i) => (
            <div className="admin-item" key={r.id}>
              <div className="admin-move">
                <button type="button" disabled={i === 0} onClick={() => moveRow(r, -1)} aria-label={`Move ${r.label} up`}>
                  ▲
                </button>
                <button
                  type="button"
                  disabled={i === rows.length - 1}
                  onClick={() => moveRow(r, 1)}
                  aria-label={`Move ${r.label} down`}
                >
                  ▼
                </button>
              </div>
              <div className="admin-item-main admin-row-main">
                <input
                  className="admin-label-input"
                  value={r.label}
                  maxLength={60}
                  onChange={(e) => editLabel(r.id, e.target.value)}
                  onBlur={() => saveLabel(r)}
                  aria-label="Row label"
                />
                <small>
                  {r.key}
                  {r.mediaType ? ` · ${r.mediaType}` : ''}
                </small>
              </div>
              <Toggle checked={r.enabled} onChange={() => toggleRow(r)} label={`${r.label} visible`} />
            </div>
          ))}
          {rows.length === 0 && !panelError && <p className="admin-empty">Loading…</p>}
        </div>
      </section>

      <section className="admin-section">
        <h2>Security</h2>
        <form className="admin-pwform" onSubmit={changePassword}>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={pwCurrent}
              onChange={(e) => setPwCurrent(e.target.value)}
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={pwNext}
              onChange={(e) => setPwNext(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {pwError && <p className="admin-error">{pwError}</p>}
          <button type="submit" className="admin-primary" disabled={pwBusy}>
            {pwBusy ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  );
}
