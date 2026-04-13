import React, { useEffect, useMemo, useState } from "react";

const TIMER_COUNT = 30;
const STORAGE_KEY = "multi-timer-vite-simple-v1";

const TIMER_PHASE = {
  COUNTDOWN: "countdown",
  OVERTIME: "overtime",
  STOPPED: "stopped",
};

function makeTimer(index) {
  return {
    id: index + 1,
    name: `计时器 ${index + 1}`,
    initialSeconds: 300,
    remainingSeconds: 300,
    overtimeSeconds: 0,
    minuteInput: "05",
    secondInput: "00",
    phase: TIMER_PHASE.COUNTDOWN,
    isRunning: false,
    endAt: null,
    overtimeStartedAt: null,
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

function migrateTimer(rawTimer, index) {
  const base = makeTimer(index);
  const merged = { ...base, ...rawTimer };
  const phase = Object.values(TIMER_PHASE).includes(merged.phase)
    ? merged.phase
    : merged.isFinished
      ? TIMER_PHASE.STOPPED
      : TIMER_PHASE.COUNTDOWN;

  return {
    ...merged,
    phase,
    remainingSeconds: Number.isFinite(merged.remainingSeconds)
      ? Math.max(0, Math.floor(merged.remainingSeconds))
      : merged.initialSeconds,
    overtimeSeconds: Number.isFinite(merged.overtimeSeconds)
      ? Math.max(0, Math.floor(merged.overtimeSeconds))
      : 0,
    isRunning: Boolean(merged.isRunning) && phase !== TIMER_PHASE.STOPPED,
    endAt: Number.isFinite(merged.endAt) ? merged.endAt : null,
    overtimeStartedAt: Number.isFinite(merged.overtimeStartedAt) ? merged.overtimeStartedAt : null,
  };
}

function commitTimerTime(timer) {
  const minuteInput = cleanInput(timer.minuteInput, 99) || "0";
  const secondInput = cleanInput(timer.secondInput, 59) || "0";
  const total = secondsFromInput(minuteInput, secondInput);
  const shouldResetCountdown = timer.phase !== TIMER_PHASE.OVERTIME && !timer.isRunning;

  return {
    ...timer,
    minuteInput: pad(Number(minuteInput)),
    secondInput: pad(Number(secondInput)),
    initialSeconds: total,
    remainingSeconds: shouldResetCountdown ? total : timer.remainingSeconds,
  };
}

function syncTimer(timer, now) {
  if (!timer.isRunning) return timer;

  if (timer.phase === TIMER_PHASE.COUNTDOWN) {
    if (!timer.endAt) {
      return {
        ...timer,
        isRunning: false,
      };
    }

    const left = Math.max(0, Math.ceil((timer.endAt - now) / 1000));

    if (left === 0) {
      const overtimeStartedAt = timer.endAt;
      return {
        ...timer,
        remainingSeconds: 0,
        overtimeSeconds: Math.max(0, Math.floor((now - overtimeStartedAt) / 1000)),
        phase: TIMER_PHASE.OVERTIME,
        isRunning: true,
        endAt: null,
        overtimeStartedAt,
      };
    }

    return {
      ...timer,
      remainingSeconds: left,
    };
  }

  if (timer.phase === TIMER_PHASE.OVERTIME) {
    if (!timer.overtimeStartedAt) {
      return {
        ...timer,
        isRunning: false,
      };
    }

    return {
      ...timer,
      overtimeSeconds: Math.max(0, Math.floor((now - timer.overtimeStartedAt) / 1000)),
    };
  }

  return timer;
}

function getDisplayTime(timer) {
  return timer.phase === TIMER_PHASE.OVERTIME
    ? formatTime(timer.overtimeSeconds)
    : formatTime(timer.remainingSeconds);
}

function getStatusText(timer) {
  if (timer.phase === TIMER_PHASE.OVERTIME) {
    return timer.isRunning ? "状态：已超时，正计时进行中" : "状态：已超时，正计时已暂停";
  }

  if (timer.phase === TIMER_PHASE.STOPPED) {
    return "状态：已结束";
  }

  if (timer.isRunning) {
    return "状态：倒计时进行中";
  }

  if (timer.remainingSeconds === timer.initialSeconds) {
    return "状态：待开始";
  }

  return "状态：已暂停";
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
      return parsed.map((rawTimer, index) => {
        const synced = syncTimer(migrateTimer(rawTimer, index), now);
        return {
          ...synced,
          minuteInput: pad(Math.floor(synced.initialSeconds / 60)),
          secondInput: pad(synced.initialSeconds % 60),
        };
      });
    } catch {
      return makeTimers();
    }
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setTimers((current) => current.map((timer) => syncTimer(timer, now)));
    }, 250);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  }, [timers]);

  useEffect(() => {
    const latestOvertime = [...timers].reverse().find((timer) => timer.phase === TIMER_PHASE.OVERTIME);
    document.title = latestOvertime ? `${latestOvertime.name} 已超时` : "多计时器";
  }, [timers]);

  const runningCount = useMemo(() => timers.filter((timer) => timer.isRunning).length, [timers]);
  const overtimeCount = useMemo(
    () => timers.filter((timer) => timer.phase === TIMER_PHASE.OVERTIME).length,
    [timers]
  );

  function updateTimer(id, updater) {
    setTimers((current) => current.map((timer) => (timer.id === id ? updater(timer) : timer)));
  }

  function handleNameChange(id, value) {
    updateTimer(id, (timer) => ({
      ...timer,
      name: value.slice(0, 24),
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
      const now = Date.now();

      if (timer.phase === TIMER_PHASE.OVERTIME) {
        return {
          ...timer,
          isRunning: true,
          endAt: null,
          overtimeStartedAt: now - timer.overtimeSeconds * 1000,
        };
      }

      const startFrom = timer.remainingSeconds > 0 ? timer.remainingSeconds : timer.initialSeconds;
      if (startFrom <= 0) return timer;

      return {
        ...timer,
        remainingSeconds: startFrom,
        overtimeSeconds: 0,
        phase: TIMER_PHASE.COUNTDOWN,
        isRunning: true,
        endAt: now + startFrom * 1000,
        overtimeStartedAt: null,
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
        overtimeStartedAt: null,
      };
    });
  }

  function resetTimer(id) {
    updateTimer(id, (timer) => ({
      ...timer,
      remainingSeconds: timer.initialSeconds,
      overtimeSeconds: 0,
      phase: TIMER_PHASE.COUNTDOWN,
      isRunning: false,
      endAt: null,
      overtimeStartedAt: null,
    }));
  }

  function finishTimer(id) {
    updateTimer(id, (timer) => ({
      ...timer,
      remainingSeconds: 0,
      overtimeSeconds: 0,
      phase: TIMER_PHASE.STOPPED,
      isRunning: false,
      endAt: null,
      overtimeStartedAt: null,
    }));
  }

  function pauseAll() {
    const now = Date.now();
    setTimers((current) =>
      current.map((timer) => {
        const synced = syncTimer(timer, now);
        return {
          ...synced,
          isRunning: false,
          endAt: null,
          overtimeStartedAt: null,
        };
      })
    );
  }

  function resetAll() {
    setTimers((current) =>
      current.map((timer) => ({
        ...timer,
        remainingSeconds: timer.initialSeconds,
        overtimeSeconds: 0,
        phase: TIMER_PHASE.COUNTDOWN,
        isRunning: false,
        endAt: null,
        overtimeStartedAt: null,
      }))
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>多计时器面板</h1>
            <p style={styles.subtitle}>支持同时管理 30 个计时器，结束后自动切换为红色正计时超时显示。</p>
          </div>

          <div style={styles.headerButtons}>
            <div style={styles.badge}>运行中 {runningCount}</div>
            <div style={{ ...styles.badge, ...styles.badgeOvertime }}>已超时 {overtimeCount}</div>
            <button style={styles.secondaryButton} onClick={pauseAll}>
              全部暂停
            </button>
            <button style={styles.secondaryButton} onClick={resetAll}>
              全部重置
            </button>
          </div>
        </div>

        <div style={styles.grid}>
          {timers.map((timer) => {
            const isOvertime = timer.phase === TIMER_PHASE.OVERTIME;
            const isStopped = timer.phase === TIMER_PHASE.STOPPED;

            return (
              <div
                key={timer.id}
                style={{
                  ...styles.card,
                  ...(isOvertime ? styles.cardOvertime : {}),
                  ...(isStopped ? styles.cardStopped : {}),
                }}
              >
                <div style={styles.rowBetween}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.label}>名称</div>
                    <input
                      style={styles.nameInput}
                      value={timer.name}
                      onChange={(event) => handleNameChange(timer.id, event.target.value)}
                    />
                  </div>
                  <div style={styles.idBadge}>#{timer.id}</div>
                </div>

                <div style={styles.timeRow}>
                  <div style={{ ...styles.time, ...(isOvertime ? styles.timeOvertime : {}) }}>
                    {getDisplayTime(timer)}
                  </div>
                  {isOvertime ? <div style={styles.overtimeTag}>已超时</div> : null}
                </div>

                <div style={styles.timeInputRow}>
                  <div>
                    <div style={styles.label}>分钟</div>
                    <input
                      style={styles.smallInput}
                      inputMode="numeric"
                      value={timer.minuteInput}
                      onChange={(event) => handleTimeChange(timer.id, "minuteInput", event.target.value)}
                      onBlur={() => commitTimeEdit(timer.id)}
                      onKeyDown={(event) => handleTimeKeyDown(timer.id, event)}
                    />
                  </div>
                  <div>
                    <div style={styles.label}>秒</div>
                    <input
                      style={styles.smallInput}
                      inputMode="numeric"
                      value={timer.secondInput}
                      onChange={(event) => handleTimeChange(timer.id, "secondInput", event.target.value)}
                      onBlur={() => commitTimeEdit(timer.id)}
                      onKeyDown={(event) => handleTimeKeyDown(timer.id, event)}
                    />
                  </div>
                </div>

                <div style={styles.buttonRow}>
                  {timer.isRunning ? (
                    <button style={styles.primaryButton} onClick={() => pauseTimer(timer.id)}>
                      暂停
                    </button>
                  ) : (
                    <button style={styles.primaryButton} onClick={() => startTimer(timer.id)}>
                      开始
                    </button>
                  )}
                  <button style={styles.secondaryButton} onClick={() => resetTimer(timer.id)}>
                    重置
                  </button>
                </div>

                <button style={{ ...styles.secondaryButton, width: "100%" }} onClick={() => finishTimer(timer.id)}>
                  立即结束
                </button>

                <div style={{ ...styles.statusBox, ...(isOvertime ? styles.statusBoxOvertime : {}) }}>
                  {getStatusText(timer)}
                </div>
              </div>
            );
          })}
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
    fontFamily:
      '"SF Pro Text", "SF Pro Display", "PingFang SC", "Hiragino Sans GB", "Segoe UI", sans-serif',
    colorScheme: "light",
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
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.08)",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    color: "#111827",
    WebkitTextFillColor: "#111827",
  },
  subtitle: {
    margin: "8px 0 0 0",
    color: "#4b5563",
    fontSize: "14px",
    WebkitTextFillColor: "#4b5563",
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
    color: "#111827",
    WebkitTextFillColor: "#111827",
  },
  badgeOvertime: {
    background: "#fee2e2",
    color: "#b91c1c",
    WebkitTextFillColor: "#b91c1c",
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
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    border: "1px solid #e5e7eb",
  },
  cardOvertime: {
    border: "1px solid #fecaca",
    boxShadow: "0 6px 18px rgba(185, 28, 28, 0.12)",
  },
  cardStopped: {
    border: "1px solid #d1d5db",
  },
  rowBetween: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  idBadge: {
    background: "#111827",
    color: "#ffffff",
    WebkitTextFillColor: "#ffffff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "13px",
  },
  label: {
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "6px",
    WebkitTextFillColor: "#6b7280",
  },
  nameInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "16px",
    background: "#f9fafb",
    color: "#111827",
    WebkitTextFillColor: "#111827",
    appearance: "none",
  },
  timeRow: {
    minHeight: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  time: {
    textAlign: "center",
    fontSize: "42px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "#111827",
    WebkitTextFillColor: "#111827",
    fontVariantNumeric: "tabular-nums",
  },
  timeOvertime: {
    color: "#b91c1c",
    WebkitTextFillColor: "#b91c1c",
  },
  overtimeTag: {
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#b91c1c",
    WebkitTextFillColor: "#b91c1c",
    fontSize: "14px",
    fontWeight: 700,
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
    color: "#111827",
    WebkitTextFillColor: "#111827",
    appearance: "none",
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
    color: "#ffffff",
    WebkitTextFillColor: "#ffffff",
    appearance: "none",
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "16px",
    cursor: "pointer",
    background: "#ffffff",
    color: "#111827",
    WebkitTextFillColor: "#111827",
    appearance: "none",
  },
  statusBox: {
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "14px",
    color: "#4b5563",
    WebkitTextFillColor: "#4b5563",
  },
  statusBoxOvertime: {
    background: "#fef2f2",
    color: "#b91c1c",
    WebkitTextFillColor: "#b91c1c",
  },
};
