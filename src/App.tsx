"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Person = {
  first: string;
  last: string;
  role: string;
  color: string;
};

type AttendanceRecord = {
  name: string;
  type: "Arrivée" | "Départ";
  timestamp: string;
  workDate: string;
};

const defaultPeople: Person[] = [
  {
    first: "Amélie",
    last: "Martin",
    role: "Accueil",
    color: "coral",
  },
  {
    first: "Amine",
    last: "Bensaïd",
    role: "Caisse",
    color: "purple",
  },
  {
    first: "Ambre",
    last: "Dupont",
    role: "Service",
    color: "blue",
  },
  {
    first: "Camille",
    last: "Robert",
    role: "Caisse",
    color: "green",
  },
  {
    first: "Lucas",
    last: "Bernard",
    role: "Service",
    color: "amber",
  },
  {
    first: "Sarah",
    last: "Petit",
    role: "Accueil",
    color: "pink",
  },
  {
    first: "Aniss",
    last: "Belhaq",
    role: "Salle",
    color: "blue",
  },
];

const api = async (data: object) => {
  const url = (
    import.meta as ImportMeta & {
      env?: Record<string, string>;
    }
  ).env?.VITE_GOOGLE_APPS_SCRIPT_URL;

  if (!url) {
    return;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Erreur pendant l’enregistrement");
  }
};

function Signature({
  setValue,
}: {
  setValue: (value: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const getPosition = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    const rectangle =
      event.currentTarget.getBoundingClientRect();

    return {
      x: event.clientX - rectangle.left,
      y: event.clientY - rectangle.top,
    };
  };

  const startDrawing = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    drawing.current = true;

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    const context =
      event.currentTarget.getContext("2d");

    const position = getPosition(event);

    if (context) {
      context.beginPath();
      context.moveTo(position.x, position.y);
      context.strokeStyle = "#172139";
      context.lineWidth = 2.5;
      context.lineCap = "round";
    }
  };

  const draw = (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    if (!drawing.current) {
      return;
    }

    const context =
      event.currentTarget.getContext("2d");

    const position = getPosition(event);

    if (context) {
      context.lineTo(position.x, position.y);
      context.stroke();
    }
  };

  const stopDrawing = () => {
    drawing.current = false;

    if (canvasRef.current) {
      setValue(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    canvas
      .getContext("2d")
      ?.clearRect(
        0,
        0,
        canvas.width,
        canvas.height,
      );

    setValue("");
  };

  return (
    <div className="signature">
      <canvas
        ref={canvasRef}
        width="430"
        height="135"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
      />

      <em>
        Signez avec votre doigt ou votre souris
      </em>

      <button
        type="button"
        onClick={clearSignature}
      >
        Effacer
      </button>
    </div>
  );
}

export default function AttendanceApp() {
  const [loggedIn, setLoggedIn] =
    useState(false);

  const [login, setLogin] = useState({
    username: "",
    password: "",
  });

  const [loginError, setLoginError] =
    useState("");

  const [tab, setTab] = useState<
    "pointage" | "details"
  >("pointage");

  const [search, setSearch] = useState("");

  const [person, setPerson] =
    useState<Person | null>(null);

  const [signature, setSignature] =
    useState("");

  const [mode, setMode] = useState<
    "Arrivée" | "Départ"
  >("Arrivée");

  const [message, setMessage] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [form, setForm] = useState({
    cashierMorning: "",
    cashierEvening: "",
    fdcMorning: "",
    fdcEvening: "",
  });

  const [rows, setRows] =
    useState<(typeof form)[]>([]);

  const getToday = () =>
    new Date().toLocaleDateString("en-CA");

  const [records, setRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [reportDate, setReportDate] =
    useState(getToday());

  const [team, setTeam] =
    useState<Person[]>(defaultPeople);

  const [managing, setManaging] =
    useState(false);

  const [newPerson, setNewPerson] =
    useState({
      first: "",
      last: "",
      role: "",
    });

  const filteredPeople = useMemo(() => {
    const query = search
      .trim()
      .toLocaleLowerCase("fr");

    return team.filter((employee) => {
      const fullName =
        `${employee.first} ${employee.last}`
          .toLocaleLowerCase("fr");

      return fullName.startsWith(query);
    });
  }, [search, team]);

  useEffect(() => {
    setLoggedIn(
      sessionStorage.getItem(
        "presence-admin",
      ) === "yes",
    );

    const savedRecords =
      localStorage.getItem(
        "presence-records",
      );

    if (savedRecords) {
      try {
        setRecords(
          JSON.parse(savedRecords),
        );
      } catch {
        // Aucun pointage enregistré
      }
    }

    const loadEmployees = async () => {
      try {
        const response = await fetch(
          `/employees.json?t=${Date.now()}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            "Impossible de charger les employés",
          );
        }

        const employees: Person[] =
          await response.json();

        if (!Array.isArray(employees)) {
          throw new Error(
            "Format JSON incorrect",
          );
        }

        setTeam(employees);
      } catch {
        const savedTeam =
          localStorage.getItem(
            "presence-team",
          );

        if (savedTeam) {
          try {
            setTeam(
              JSON.parse(savedTeam),
            );
          } catch {
            setTeam(defaultPeople);
          }
        }
      }
    };

    void loadEmployees();
  }, []);

  const saveTeam = (
    nextTeam: Person[],
  ) => {
    setTeam(nextTeam);

    localStorage.setItem(
      "presence-team",
      JSON.stringify(nextTeam),
    );
  };

  const addPerson = (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    const first =
      newPerson.first.trim();

    const last =
      newPerson.last.trim();

    const role =
      newPerson.role.trim();

    if (!first || !last || !role) {
      return;
    }

    const alreadyExists = team.some(
      (employee) =>
        employee.first.toLowerCase() ===
          first.toLowerCase() &&
        employee.last.toLowerCase() ===
          last.toLowerCase(),
    );

    if (alreadyExists) {
      setMessage(
        `${first} ${last} existe déjà.`,
      );

      return;
    }

    const colors = [
      "coral",
      "purple",
      "blue",
      "green",
      "amber",
      "pink",
    ];

    const employee: Person = {
      first,
      last,
      role,
      color:
        colors[
          team.length % colors.length
        ],
    };

    saveTeam([...team, employee]);

    setNewPerson({
      first: "",
      last: "",
      role: "",
    });

    setMessage(
      `${first} ${last} a été ajouté à l’équipe.`,
    );
  };

  const removePerson = (
    target: Person,
  ) => {
    const nextTeam = team.filter(
      (employee) =>
        !(
          employee.first ===
            target.first &&
          employee.last === target.last
        ),
    );

    saveTeam(nextTeam);

    if (
      person?.first === target.first &&
      person?.last === target.last
    ) {
      setPerson(null);
      setSignature("");
    }

    setMessage(
      `${target.first} ${target.last} a été supprimé de l’équipe.`,
    );
  };

  const authenticate = (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    if (
      login.username === "admin" &&
      login.password === "admin"
    ) {
      sessionStorage.setItem(
        "presence-admin",
        "yes",
      );

      setLoggedIn(true);
      setLoginError("");

      return;
    }

    setLoginError(
      "Identifiant ou mot de passe incorrect.",
    );
  };

  const logout = () => {
    sessionStorage.removeItem(
      "presence-admin",
    );

    setLoggedIn(false);

    setLogin({
      username: "",
      password: "",
    });
  };

  const submitAttendance = async () => {
    if (!person || !signature) {
      return;
    }

    setBusy(true);

    try {
      const now = new Date();

      const name =
        `${person.first} ${person.last}`;

      let workDate = getToday();

      if (mode === "Départ") {
        const employeeRecords = records
          .filter(
            (record) =>
              record.name === name,
          )
          .sort((firstRecord, secondRecord) =>
            firstRecord.timestamp.localeCompare(
              secondRecord.timestamp,
            ),
          );

        const lastArrival =
          [...employeeRecords]
            .reverse()
            .find(
              (record) =>
                record.type === "Arrivée",
            );

        const lastDeparture =
          [...employeeRecords]
            .reverse()
            .find(
              (record) =>
                record.type === "Départ",
            );

        if (
          lastArrival &&
          (!lastDeparture ||
            lastArrival.timestamp >
              lastDeparture.timestamp)
        ) {
          workDate =
            lastArrival.workDate;
        }
      }

      await api({
        action: "pointage",
        mode,
        name,
        signature,
        date: now.toISOString(),
        workDate,
      });

      const newRecord: AttendanceRecord = {
        name,
        type: mode,
        timestamp: now.toISOString(),
        workDate,
      };

      const nextRecords = [
        ...records,
        newRecord,
      ];

      setRecords(nextRecords);

      localStorage.setItem(
        "presence-records",
        JSON.stringify(nextRecords),
      );

      setReportDate(workDate);

      setMessage(
        `${mode} enregistrée pour ${person.first}.`,
      );

      setPerson(null);
      setSignature("");
      setSearch("");
    } catch {
      setMessage(
        "L’enregistrement a échoué. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  };

  const getEmployeeSummary = (
    employee: Person,
  ) => {
    const employeeName =
      `${employee.first} ${employee.last}`;

    const events = records
      .filter(
        (record) =>
          record.name === employeeName &&
          record.workDate === reportDate,
      )
      .sort((firstRecord, secondRecord) =>
        firstRecord.timestamp.localeCompare(
          secondRecord.timestamp,
        ),
      );

    const shifts: {
      start?: Date;
      end?: Date;
    }[] = [];

    for (const event of events) {
      if (event.type === "Arrivée") {
        shifts.push({
          start: new Date(
            event.timestamp,
          ),
        });
      } else {
        const openShift = [...shifts]
          .reverse()
          .find(
            (shift) =>
              shift.start && !shift.end,
          );

        if (openShift) {
          openShift.end = new Date(
            event.timestamp,
          );
        }
      }
    }

    const getDuration = (
      shift?: {
        start?: Date;
        end?: Date;
      },
    ) => {
      if (!shift?.start || !shift.end) {
        return 0;
      }

      return (
        (shift.end.getTime() -
          shift.start.getTime()) /
        3_600_000
      );
    };

    const formatTime = (
      date?: Date,
    ) => {
      if (!date) {
        return "00:00";
      }

      return date.toLocaleTimeString(
        "fr-FR",
        {
          hour: "2-digit",
          minute: "2-digit",
        },
      );
    };

    return {
      name: employeeName,
      start1: formatTime(
        shifts[0]?.start,
      ),
      end1: formatTime(
        shifts[0]?.end,
      ),
      hours1: getDuration(
        shifts[0],
      ),
      start2: formatTime(
        shifts[1]?.start,
      ),
      end2: formatTime(
        shifts[1]?.end,
      ),
      hours2: getDuration(
        shifts[1],
      ),
    };
  };

  const downloadReport = () => {
    const header = [
      "Employé",
      "Heure début 1",
      "Heure fin 1",
      "Différence MIDI",
      "Heure début 2",
      "Heure fin 2",
      "Différence SOIR",
      "Heures totales",
    ];

    const lines = team.map(
      (employee) => {
        const summary =
          getEmployeeSummary(employee);

        const total =
          summary.hours1 +
          summary.hours2;

        const values = [
          summary.name,
          summary.start1,
          summary.end1,
          summary.hours1
            .toFixed(2)
            .replace(".", ","),
          summary.start2,
          summary.end2,
          summary.hours2
            .toFixed(2)
            .replace(".", ","),
          total
            .toFixed(2)
            .replace(".", ","),
        ];

        return values
          .map(
            (value) => `"${value}"`,
          )
          .join(";");
      },
    );

    const csv = [
      `Date;${reportDate}`,
      header.join(";"),
      ...lines,
    ].join("\r\n");

    const blob = new Blob(
      ["\ufeff", csv],
      {
        type: "text/csv;charset=utf-8",
      },
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `heures-employes-${reportDate}.csv`;

    link.click();

    URL.revokeObjectURL(url);
  };

  const addDetails = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    setBusy(true);

    try {
      await api({
        action: "details",
        ...form,
        date: new Date().toISOString(),
      });

      setRows((currentRows) => [
        form,
        ...currentRows,
      ]);

      setForm({
        cashierMorning: "",
        cashierEvening: "",
        fdcMorning: "",
        fdcEvening: "",
      });

      setMessage(
        "La ligne a été ajoutée au registre.",
      );
    } catch {
      setMessage(
        "L’ajout a échoué. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!loggedIn) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-logo">
            P
          </div>

          <div className="login-title">
            <small>
              ESPACE SÉCURISÉ
            </small>

            <h1>Bienvenue</h1>

            <p>
              Connectez-vous pour accéder
              au registre d’équipe.
            </p>
          </div>

          <form onSubmit={authenticate}>
            <label>
              Identifiant

              <input
                autoFocus
                required
                value={login.username}
                onChange={(event) =>
                  setLogin({
                    ...login,
                    username:
                      event.target.value,
                  })
                }
                placeholder="Votre identifiant"
                autoComplete="username"
              />
            </label>

            <label>
              Mot de passe

              <input
                required
                type="password"
                value={login.password}
                onChange={(event) =>
                  setLogin({
                    ...login,
                    password:
                      event.target.value,
                  })
                }
                placeholder="Votre mot de passe"
                autoComplete="current-password"
              />
            </label>

            {loginError && (
              <p className="login-error">
                {loginError}
              </p>
            )}

            <button className="login-submit">
              Se connecter
              <span>→</span>
            </button>
          </form>

          <p className="login-help">
            Accès administrateur ·
            Registre Présence
          </p>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header>
        <div className="brand">
          <b>P</b>

          <span>
            <strong>Présence</strong>
            <small>
              Registre d’équipe
            </small>
          </span>
        </div>

        <div className="header-actions">
          <div className="date">
            <i />

            {new Intl.DateTimeFormat(
              "fr-FR",
              {
                weekday: "long",
                day: "numeric",
                month: "long",
              },
            ).format(new Date())}
          </div>

          <button
            className="logout"
            onClick={logout}
          >
            Déconnexion
          </button>
        </div>
      </header>

      <section className="shell">
        <div className="hero">
          <label>ESPACE ÉQUIPE</label>

          <h1>
            {tab === "pointage"
              ? "Bonjour, prêt à pointer ?"
              : "Suivi de la journée"}
          </h1>

          <p>
            {tab === "pointage"
              ? "Recherchez votre nom, signez, puis validez votre passage."
              : "Renseignez les responsables et les fonds de caisse de chaque service."}
          </p>
        </div>

        <nav>
          <button
            className={
              tab === "pointage"
                ? "active"
                : ""
            }
            onClick={() => {
              setTab("pointage");
              setMessage("");
            }}
          >
            ✓ &nbsp; Pointage
          </button>

          <button
            className={
              tab === "details"
                ? "active"
                : ""
            }
            onClick={() => {
              setTab("details");
              setMessage("");
            }}
          >
            ≡ &nbsp; Détails
          </button>
        </nav>

        {message && (
          <div
            className="message"
            role="status"
          >
            ✓ &nbsp; {message}

            <button
              type="button"
              onClick={() =>
                setMessage("")
              }
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        )}

        {tab === "pointage" ? (
          <div className="grid">
            <section className="card">
              <div className="cardhead">
                <span>1</span>

                <div>
                  <h2>
                    Trouvez votre nom
                  </h2>

                  <p>
                    Tapez les premières
                    lettres de votre prénom.
                  </p>
                </div>

                <div className="team-actions">
                  <small>
                    {team.length} personnes
                  </small>

                  <button
                    type="button"
                    onClick={() =>
                      setManaging(
                        !managing,
                      )
                    }
                  >
                    {managing
                      ? "Fermer"
                      : "＋ Gérer"}
                  </button>
                </div>
              </div>

              {managing && (
                <div className="team-manager">
                  <form
                    onSubmit={addPerson}
                  >
                    <input
                      required
                      value={
                        newPerson.first
                      }
                      onChange={(event) =>
                        setNewPerson({
                          ...newPerson,
                          first:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Prénom"
                    />

                    <input
                      required
                      value={newPerson.last}
                      onChange={(event) =>
                        setNewPerson({
                          ...newPerson,
                          last:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Nom"
                    />

                    <input
                      required
                      value={newPerson.role}
                      onChange={(event) =>
                        setNewPerson({
                          ...newPerson,
                          role:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Poste"
                    />

                    <button>
                      Ajouter
                    </button>
                  </form>

                  <div className="manage-list">
                    {team.map(
                      (employee) => (
                        <div
                          key={`${employee.first}-${employee.last}`}
                        >
                          <span>
                            <b>
                              {employee.first}{" "}
                              {employee.last}
                            </b>

                            <small>
                              {employee.role}
                            </small>
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              removePerson(
                                employee,
                              )
                            }
                            aria-label={`Supprimer ${employee.first} ${employee.last}`}
                          >
                            Supprimer
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              <label className="search">
                ⌕

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Ex. AM pour Amélie, Amine..."
                />

                <kbd>A—Z</kbd>
              </label>

              <div className="list">
                {filteredPeople.map(
                  (employee) => {
                    const selected =
                      person?.first ===
                        employee.first &&
                      person?.last ===
                        employee.last;

                    return (
                      <button
                        key={`${employee.first}-${employee.last}`}
                        className={`person ${
                          selected
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => {
                          setPerson(employee);
                          setSignature("");
                        }}
                      >
                        <b
                          className={
                            employee.color
                          }
                        >
                          {employee.first[0]}
                          {employee.last[0]}
                        </b>

                        <span>
                          <strong>
                            {employee.first}{" "}
                            {employee.last}
                          </strong>

                          <small>
                            {employee.role}
                          </small>
                        </span>

                        <i>
                          {selected
                            ? "✓"
                            : ""}
                        </i>
                      </button>
                    );
                  },
                )}

                {!filteredPeople.length && (
                  <p className="empty">
                    Aucun nom trouvé.
                  </p>
                )}
              </div>
            </section>

            <section
              className={`card signcard ${
                !person ? "disabled" : ""
              }`}
            >
              <div className="cardhead">
                <span>2</span>

                <div>
                  <h2>
                    Signez et validez
                  </h2>

                  <p>
                    {person
                      ? `Pointage de ${person.first} ${person.last}`
                      : "Sélectionnez d’abord votre nom."}
                  </p>
                </div>
              </div>

              <div className="switch">
                <button
                  className={
                    mode === "Arrivée"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setMode("Arrivée")
                  }
                >
                  ↘ Arrivée
                </button>

                <button
                  className={
                    mode === "Départ"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setMode("Départ")
                  }
                >
                  ↗ Départ
                </button>
              </div>

              <div className="time">
                <small>
                  HEURE ACTUELLE
                </small>

                <strong>
                  {new Intl.DateTimeFormat(
                    "fr-FR",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  ).format(new Date())}
                </strong>
              </div>

              <label className="caption">
                VOTRE SIGNATURE
              </label>

              <Signature
                key={
                  person
                    ? `${person.first}-${person.last}`
                    : "none"
                }
                setValue={setSignature}
              />

              <button
                className="primary"
                disabled={
                  !person ||
                  !signature ||
                  busy
                }
                onClick={submitAttendance}
              >
                {busy
                  ? "Enregistrement..."
                  : `Valider mon ${mode.toLowerCase()}`}
                {" "}→
              </button>

              <p className="privacy">
                🔒 Votre signature sert
                uniquement à confirmer ce
                pointage.
              </p>
            </section>
          </div>
        ) : (
          <div className="grid details">
            <section className="card">
              <div className="cardhead">
                <span>1</span>

                <div>
                  <h2>
                    Ajouter les détails
                  </h2>

                  <p>
                    Complétez les
                    informations du service.
                  </p>
                </div>
              </div>

              <form onSubmit={addDetails}>
                <h3>MATIN</h3>

                <div className="fields">
                  <label>
                    Caissier du matin

                    <input
                      required
                      value={
                        form.cashierMorning
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          cashierMorning:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Nom et prénom"
                    />
                  </label>

                  <label>
                    FDC initial / matin

                    <input
                      required
                      value={
                        form.fdcMorning
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          fdcMorning:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Ex. 250,00 €"
                    />
                  </label>
                </div>

                <h3 className="night">
                  SOIR
                </h3>

                <div className="fields">
                  <label>
                    Caissier du soir

                    <input
                      required
                      value={
                        form.cashierEvening
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          cashierEvening:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Nom et prénom"
                    />
                  </label>

                  <label>
                    FDC du soir

                    <input
                      required
                      value={
                        form.fdcEvening
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          fdcEvening:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Ex. 248,50 €"
                    />
                  </label>
                </div>

                <button
                  className="primary full"
                  disabled={busy}
                >
                  {busy
                    ? "Ajout..."
                    : "Ajouter la ligne au registre ＋"}
                </button>
              </form>
            </section>

            <section className="card report-card">
              <div className="cardhead">
                <span>2</span>

                <div>
                  <h2>
                    Heures des employés
                  </h2>

                  <p>
                    Calcul automatique
                    d’après les pointages.
                  </p>
                </div>
              </div>

              <div className="report-tools">
                <label>
                  Date

                  <input
                    type="date"
                    value={reportDate}
                    onChange={(event) =>
                      setReportDate(
                        event.target.value,
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  onClick={downloadReport}
                >
                  ↓ Télécharger le fichier
                </button>
              </div>

              <div className="report-table">
                <table>
                  <thead>
                    <tr>
                      <th>Employé</th>
                      <th>Début 1</th>
                      <th>Fin 1</th>
                      <th>MIDI</th>
                      <th>Début 2</th>
                      <th>Fin 2</th>
                      <th>SOIR</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {team.map(
                      (employee) => {
                        const summary =
                          getEmployeeSummary(
                            employee,
                          );

                        const total =
                          summary.hours1 +
                          summary.hours2;

                        return (
                          <tr
                            key={`${employee.first}-${employee.last}`}
                          >
                            <td>
                              {summary.name}
                            </td>

                            <td>
                              {summary.start1}
                            </td>

                            <td>
                              {summary.end1}
                            </td>

                            <td>
                              {summary.hours1.toFixed(
                                2,
                              )}
                            </td>

                            <td>
                              {summary.start2}
                            </td>

                            <td>
                              {summary.end2}
                            </td>

                            <td>
                              {summary.hours2.toFixed(
                                2,
                              )}
                            </td>

                            <td>
                              <b>
                                {total.toFixed(
                                  2,
                                )}
                              </b>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>

      <footer>
        <b>Présence</b>

        <span>
          Pointage simple, équipe sereine.
        </span>

        <small>
          <i />
          Synchronisation Google prête
        </small>
      </footer>
    </main>
  );
}