import React, { useEffect, useMemo, useState } from "react";

const TIMER_COUNT = 30;
const STORAGE_KEY = "multi-timer-vite-simple-v1";

function makeTimer(index) {
  return {
    id: index + 1,
    name: `计时器 ${index + 1}`,
    initialSeconds: 300,
    remainingSeconds: 300,
    minuteInput: "05",
    secondInput: "00",
    isRunning: false,
    isFinished: false,
    endAt: null,
  };
}

function makeTimers() {
  return Array.from({ length: TIMER_COUNT }, (_, index) => makeTimer(index));
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

function cleanInput(value, max) {
  const digits = value.replace(/\D/g, "").slice(0, 2);
  if (!digits) return "";
  return String(Math.min(Number(digits), max));
}

function secondsFromInput(minuteInput, secondInput) {
  return Number(minuteInput || 0) * 60 + Number(secondInput || 0);
}

function commitTimerTime(timer) {
  const minuteInput = cleanInput(timer.minuteInput, 99) || "0";
  const secondInput = cleanInput(timer.secondInput, 59) || "0";
  const total = secondsFromInput(minuteInput, secondInput);

  return {
    ...timer,
    minuteInput: pad(Number(minuteInput)),
    secondInput: pad(Number(secondInput)),
    initialSeconds: total,
    remainingSeconds: timer.isRunning ? timer.remainingSeconds : total,
    isFinished: false,
  };
}

function syncTimer(timer, now) {
  if (!timer.isRunning || !timer.endAt) return timer;

  const left = Math.max(0, Math.ceil((timer.endAt - now) / 1000));

  if (left === 0) {
    return {
      ...timer,
      remainingSeconds: 0,
      isRunning: false,
      isFinished: true,
      endAt: null,
    };
  }

  return {
    ...timer,
    remainingSeconds: left,
  };
}

export default function App() {
  const [timers, setTimers] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return makeTimers();

      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length !== TIMER_COUNT) {
        return makeTimers();
      }

      const now = Date.now();
      return parsed.map((timer, index) => {
        const base = { ...makeTimer(index), ...timer };
        const synced = syncTimer(base, now);
        return {
          ...synced,
          minuteInput: pad(Math.floor((synced.initialSeconds % 3600) / 60)),
          secondInput: pad(synced.initialSeconds % 60),
        };
      });
    } catch {
      return makeTimers();
    }
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setTimers((current) => current.map((timer) => syncTimer(timer, now)));
    }, 250);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  }, [timers]);

  useEffect(() => {
    const finished = timers.filter((item) => item.isFinished);
    if (finished.length > 0) {
      document.title = `${finished[finished.length - 1].name} 已结束`;
    } else {
      document.title = "多计时器";
    }
  }, [timers]);

  const runningCount = useMemo(() => timers.filter((t) => t.isRunning).length, [timers]);
  const finishedCount = useMemo(() => timers.filter((t) => t.isFinished).length, [timers]);

  function updateTimer(id, updater) {
    setTimers((current) => current.map((timer) => (timer.id === id ? updater(timer) : timer)));
  }

  function handleNameChange(id, value) {
    updateTimer(id, (timer) => ({
      ...timer,
      name: value.slice(0, 24) || `计时器 ${id}`,
    }));
  }

  function handleTimeChange(id, field, value) {
    updateTimer(id, (timer) => ({
      ...timer,
      [field]: cleanInput(value, field === "minuteInput" ? 99 : 59),
    }));
  }

  function commitTimeEdit(id) {
    updateTimer(id, (timer) => commitTimerTime(timer));
  }

  function handleTimeKeyDown(id, event) {
    if (event.key === "Enter") {
      commitTimeEdit(id);
      event.currentTarget.blur();
    }
  }

  function startTimer(id) {
    updateTimer(id, (timer) => {
      const startFrom = timer.remainingSeconds > 0 ? timer.remainingSeconds : timer.initialSeconds;
      if (startFrom <= 0) return timer;

      return {
        ...timer,
        remainingSeconds: startFrom,
        isRunning: true,
        isFinished: false,
        endAt: Date.now() + startFrom * 1000,
      };
    });
  }

  function pauseTimer(id) {
    updateTimer(id, (timer) => {
      const synced = syncTimer(timer, Date.now());
      return {
        ...synced,
        isRunning: false,
        endAt: null,
      };
    });
  }

  function resetTimer(id) {
    updateTimer(id, (timer) => ({
      ...timer,
      remainingSeconds: timer.initialSeconds,
      isRunning: false,
      isFinished: false,
      endAt: null,
    }));
  }

  function stopTimer(id) {
    updateTimer(id, (timer) => ({
      ...timer,
      remainingSeconds: 0,
      isRunning: false,
      isFinished: true,
      endAt: null,
    }));
  }

  function stopAll() {
    setTimers((current) =>
      current.map((timer) => ({
        ...timer,
        isRunning: false,
        endAt: null,
      }))
    );
  }

  function resetAll() {
    setTimers((current) =>
      current.map((timer) => ({
        ...timer,
        remainingSeconds: timer.initialSeconds,
        isRunning: false,
        isFinished: false,
        endAt: null,
      }))
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>多计时器面板</h1>
            <p style={styles.subtitle}>30 个独立倒计时器，可单独命名、开始、暂停、重置。</p>
          </div>

          <div style={styles.headerButtons}>
            <div style={styles.badge}>运行中 {runningCount}</div>
            <div style={styles.badge}>已结束 {finishedCount}</div>
            <button style={styles.secondaryButton} onClick={stopAll}>全部暂停</button>
            <button style={styles.secondaryButton} onClick={resetAll}>全部重置</button>
          </div>
        </div>

        <div style={styles.grid}>
          {timers.map((timer) => (
            <div key={timer.id} style={{ ...styles.card, ...(timer.isFinished ? styles.cardFinished : {}) }}>
              <div style={styles.rowBetween}>
                <div style={{ flex: 1 }}>
                  <div style={styles.label}>名称</div>
                  <input
                    style={styles.nameInput}
                    value={timer.name}
                    onChange={(e) => handleNameChange(timer.id, e.target.value)}
                  />
                </div>
                <div style={styles.idBadge}>#{timer.id}</div>
              </div>

              <div style={styles.time}>{formatTime(timer.remainingSeconds)}</div>

              <div style={styles.timeInputRow}>
                <div>
                  <div style={styles.label}>分钟</div>
                  <input
                    style={styles.smallInput}
                    inputMode="numeric"
                    value={timer.minuteInput}
                    onChange={(e) => handleTimeChange(timer.id, "minuteInput", e.target.value)}
                    onBlur={() => commitTimeEdit(timer.id)}
                    onKeyDown={(e) => handleTimeKeyDown(timer.id, e)}
                  />
                </div>
                <div>
                  <div style={styles.label}>秒</div>
                  <input
                    style={styles.smallInput}
                    inputMode="numeric"
                    value={timer.secondInput}
                    onChange={(e) => handleTimeChange(timer.id, "secondInput", e.target.value)}
                    onBlur={() => commitTimeEdit(timer.id)}
                    onKeyDown={(e) => handleTimeKeyDown(timer.id, e)}
                  />
                </div>
              </div>

              <div style={styles.buttonRow}>
                {timer.isRunning ? (
                  <button style={styles.primaryButton} onClick={() => pauseTimer(timer.id)}>暂停</button>
                ) : (
                  <button style={styles.primaryButton} onClick={() => startTimer(timer.id)}>开始</button>
                )}
                <button style={styles.secondaryButton} onClick={() => resetTimer(timer.id)}>重置</button>
              </div>

              <button style={{ ...styles.secondaryButton, width: "100%" }} onClick={() => stopTimer(timer.id)}>
                结束并归零
              </button>

              <div style={styles.statusBox}>
                状态：{timer.isRunning ? "倒计时中" : timer.isFinished ? "已结束" : "待开始 / 已暂停"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f3f4f6",
    padding: "20px",
    boxSizing: "border-box",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
  },
  header: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "20px",
    marginBottom: "18px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
  },
  title: {
    margin: 0,
    fontSize: "28px",
  },
  subtitle: {
    margin: "8px 0 0 0",
    color: "#4b5563",
    fontSize: "14px",
  },
  headerButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "16px",
    alignItems: "center",
  },
  badge: {
    padding: "10px 14px",
    borderRadius: "999px",
    background: "#e5e7eb",
    fontSize: "14px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "16px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  cardFinished: {
    outline: "2px solid #d1d5db",
  },
  rowBetween: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  idBadge: {
    background: "#111827",
    color: "white",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "13px",
  },
  label: {
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "6px",
  },
  nameInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "16px",
    background: "#f9fafb",
  },
  time: {
    textAlign: "center",
    fontSize: "42px",
    fontWeight: 700,
    letterSpacing: "1px",
  },
  timeInputRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  smallInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "18px",
    textAlign: "center",
    background: "#f9fafb",
  },
  buttonRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  primaryButton: {
    border: "none",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "16px",
    cursor: "pointer",
    background: "#111827",
    color: "white",
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "16px",
    cursor: "pointer",
    background: "white",
    color: "#111827",
  },
  statusBox: {
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    color: "#4b5563",
  },
};
