import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "./apiUrl";
import CameraQrScanner from "./CameraQrScanner";
import SignaturePad from "./SignaturePad";

type Dashboard = {
  employee: { first: string; last: string; role: string; username: string };
  hasOpenArrival: boolean;
  lastEvent?: { type: string; timestamp: string; service: string; workDate: string } | null;
  history: { type: string; timestamp: string; service: string; workDate: string }[];
  schedule: { workDate: string; service: string; startMinutes: number; endMinutes: number; closing: boolean }[];
};

const request = async (data: object, token = "") => {
  const response = await fetch(apiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  const raw = await response.text();
  let result: any;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error("Réponse invalide du serveur");
  }
  if (!response.ok || result?.success === false) throw new Error(result.message || "Erreur serveur");
  return result;
};

const time = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const tokenFromQrValue = (value: string) => {
  const cleanValue = value.trim();
  try {
    return new URL(cleanValue, window.location.origin).searchParams.get("scan") || cleanValue;
  } catch {
    return cleanValue;
  }
};

export default function EmployeePortal() {
  const [employeeToken, setEmployeeToken] = useState(() => localStorage.getItem("employee-token") || "");
  const [login, setLogin] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [scanToken, setScanToken] = useState(() => sessionStorage.getItem("employee-scan-token") || "");
  const [scanExpires, setScanExpires] = useState(() => sessionStorage.getItem("employee-scan-expires") || "");
  const [signature, setSignature] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const qrToken = useMemo(() => new URLSearchParams(window.location.search).get("scan") || "", []);

  const load = async (token = employeeToken) => {
    if (!token) return;
    try {
      setDashboard(await request({ action: "employeeDashboard" }, token));
      setError("");
    } catch (reason) {
      localStorage.removeItem("employee-token");
      setEmployeeToken("");
      setDashboard(null);
      setError(reason instanceof Error ? reason.message : "Session expirée");
    }
  };

  const activateQr = useCallback(async (token: string) => {
    try {
      setError("");
      const result = await request({ action: "beginEmployeeScan", qrToken: token });
      sessionStorage.setItem("employee-scan-token", result.scanToken);
      sessionStorage.setItem("employee-scan-expires", result.expiresAt);
      setScanToken(result.scanToken);
      setScanExpires(result.expiresAt);
      setMessage("QR code validé. Vous pouvez maintenant signer votre pointage.");
      const url = new URL(window.location.href);
      url.searchParams.delete("scan");
      window.history.replaceState({}, "", url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "QR code invalide");
    }
  }, []);

  const handleDetected = useCallback((value: string) => {
    setCameraOpen(false);
    const token = tokenFromQrValue(value);
    if (!token) {
      setError("Ce QR code ne contient pas de pointage valide.");
      return;
    }
    void activateQr(token);
  }, [activateQr]);

  useEffect(() => {
    if (employeeToken) void load(employeeToken);
  }, [employeeToken]);

  useEffect(() => {
    if (qrToken) void activateQr(qrToken);
  }, [activateQr, qrToken]);

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request({ action: "employeeLogin", ...login });
      localStorage.setItem("employee-token", result.token);
      setEmployeeToken(result.token);
      setLogin({ username: "", password: "" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connexion impossible");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try {
      await request({ action: "employeeLogout" }, employeeToken);
    } catch {
      // La déconnexion locale reste possible si le serveur est temporairement inaccessible.
    }
    localStorage.removeItem("employee-token");
    setEmployeeToken("");
    setDashboard(null);
  };

  const submit = async () => {
    if (!signature || !scanToken) return;
    setBusy(true);
    setError("");
    try {
      const result = await request({ action: "employeePointage", scanToken, signature }, employeeToken);
      sessionStorage.removeItem("employee-scan-token");
      sessionStorage.removeItem("employee-scan-expires");
      setScanToken("");
      setScanExpires("");
      setSignature("");
      setMessage(`${result.mode} enregistrée avec succès · service ${result.service}.`);
      await load(employeeToken);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pointage impossible");
    } finally {
      setBusy(false);
    }
  };

  const scanValid = Boolean(scanToken && scanExpires && new Date(scanExpires) > new Date());
  const camera = cameraOpen ? <CameraQrScanner onDetected={handleDetected} onClose={() => setCameraOpen(false)}/> : null;

  if (!employeeToken) {
    return (
      <main className="employee-page">
        <section className="employee-login-card">
          <button className="employee-back" onClick={() => { window.location.href = window.location.origin; }}>← Administration</button>
          <div className="employee-mark">BH</div>
          <small>ESPACE EMPLOYÉ</small>
          <h1>Bonjour</h1>
          <p>{scanValid ? "QR validé. Connectez-vous pour signer votre pointage." : "Connectez-vous puis scannez le QR affiché au restaurant."}</p>
          {message && <div className="employee-success">{message}</div>}
          <form onSubmit={authenticate}>
            <label>Identifiant<input autoFocus required autoComplete="username" value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} placeholder="Votre nom de famille"/></label>
            <label className="employee-password">Mot de passe<input required autoComplete="current-password" type={showPassword ? "text" : "password"} value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} placeholder="Mot de passe"/><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Masquer" : "Voir"}</button></label>
            {error && <div className="employee-error">{error}</div>}
            <button className="employee-primary" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
            {!scanValid && <button className="employee-camera-button" type="button" onClick={() => setCameraOpen(true)}>▣ Ouvrir la caméra et scanner</button>}
          </form>
          <small className="employee-default-password">Premier mot de passe : 1234</small>
        </section>
        {camera}
      </main>
    );
  }

  return (
    <main className="employee-page">
      <header className="employee-header"><div><b>BEEF HOUSE</b><span>Espace Employé</span></div><button onClick={logout}>Déconnexion</button></header>
      <section className="employee-shell">
        <div className="employee-welcome"><div><small>COMPTE PERSONNEL</small><h1>{dashboard?.employee.first} {dashboard?.employee.last}</h1><p>{dashboard?.employee.role} · @{dashboard?.employee.username}</p></div><span className={dashboard?.hasOpenArrival ? "working" : "away"}>{dashboard?.hasOpenArrival ? "● Au travail" : "○ Non pointé"}</span></div>
        {message && <div className="employee-success">{message}</div>}
        {error && <div className="employee-error">{error}</div>}
        {scanValid ? (
          <section className="employee-scan-card">
            <div className="scan-approved">✓ QR CODE VALIDÉ</div>
            <h2>{dashboard?.hasOpenArrival ? "Signer mon départ" : "Signer mon arrivée"}</h2>
            <p>Votre identité et l’heure seront vérifiées par le serveur au moment de la validation.</p>
            <SignaturePad key={scanToken} setValue={setSignature}/>
            <button className="employee-primary" disabled={!signature || busy} onClick={submit}>{busy ? "Enregistrement…" : `Valider mon ${dashboard?.hasOpenArrival ? "départ" : "arrivée"}`}</button>
          </section>
        ) : (
          <section className="employee-scan-card empty-scan">
            <div className="scan-icon">⌗</div>
            <h2>Scannez le QR du pointage</h2>
            <p>Utilisez directement la caméra ci-dessous et visez le QR affiché dans l’onglet Pointage QR.</p>
            <button className="employee-camera-button" type="button" onClick={() => setCameraOpen(true)}>▣ Accéder à la caméra</button>
            {scanToken && <small>Votre autorisation précédente a expiré. Scannez le nouveau QR.</small>}
          </section>
        )}
        <section className="employee-dashboard-grid">
          <article><h2>Mon prochain planning</h2>{dashboard?.schedule.length ? dashboard.schedule.map((item, index) => <div className="employee-schedule" key={`${item.workDate}-${item.service}-${index}`}><span>{new Date(`${item.workDate}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" })}</span><b>{item.service}</b><strong>{time(item.startMinutes)} – {item.closing ? "FERMETURE" : time(item.endMinutes)}</strong></div>) : <p>Aucun horaire programmé.</p>}</article>
          <article><h2>Mes derniers pointages</h2>{dashboard?.history.length ? dashboard.history.slice(0, 8).map((item, index) => <div className="employee-history" key={`${item.timestamp}-${index}`}><span className={item.type === "Arrivée" ? "in" : "out"}>{item.type === "Arrivée" ? "↘" : "↗"}</span><div><b>{item.type} · {item.service}</b><small>{new Date(item.timestamp).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></div></div>) : <p>Aucun pointage enregistré.</p>}</article>
        </section>
      </section>
      {camera}
    </main>
  );
}
