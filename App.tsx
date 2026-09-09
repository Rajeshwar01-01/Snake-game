import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent,
} from "react";

const COLS = 24;
const ROWS = 18;
const BONUS_DURATION = 7000;
const HIGH_SCORE_KEY = "neon-snake-high-score";
const SOUND_KEY = "neon-snake-sound";

type GameStatus = "ready" | "playing" | "paused" | "over";
type Difficulty = "easy" | "medium" | "hard";
type Direction = "up" | "down" | "left" | "right";
type RegularFoodKind = "apple" | "berry" | "gem";
type FoodKind = RegularFoodKind | "bonus";

interface Point {
  x: number;
  y: number;
}

interface Food {
  x: number;
  y: number;
  kind: FoodKind;
  points: number;
  expiresAt?: number;
}

const DIFFICULTY_SETTINGS: Record<
  Difficulty,
  { label: string; startingSpeed: number; hint: string }
> = {
  easy: { label: "Easy", startingSpeed: 178, hint: "More room to breathe" },
  medium: { label: "Medium", startingSpeed: 142, hint: "The classic pace" },
  hard: { label: "Hard", startingSpeed: 108, hint: "For sharp reflexes" },
};

const FOOD_META: Record<
  RegularFoodKind,
  { label: string; points: number }
> = {
  apple: { label: "Ruby apple", points: 10 },
  berry: { label: "Electric berry", points: 20 },
  gem: { label: "Quantum gem", points: 35 },
};

const STATUS_META: Record<
  GameStatus,
  { label: string; eyebrow: string; description: string }
> = {
  ready: {
    label: "Ready to run",
    eyebrow: "Your next run starts here",
    description: "Eat bright food, grow long, and stay inside the grid.",
  },
  playing: {
    label: "In motion",
    eyebrow: "Keep the line alive",
    description: "The grid is yours. Every turn matters.",
  },
  paused: {
    label: "Paused",
    eyebrow: "Run on hold",
    description: "Take a breath. Your score is safe right where you left it.",
  },
  over: {
    label: "Run ended",
    eyebrow: "That was a close one",
    description: "Reset the grid and see if you can beat your best run.",
  },
};

function readStoredNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const stored = Number(window.localStorage.getItem(key));
  return Number.isFinite(stored) && stored >= 0 ? stored : fallback;
}

function readStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  return stored === null ? fallback : stored === "true";
}

function createInitialSnake(): Point[] {
  const centerX = Math.floor(COLS / 2);
  const centerY = Math.floor(ROWS / 2);

  return [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
    { x: centerX - 3, y: centerY },
  ];
}

function pointKey(point: Point) {
  return `${point.x}:${point.y}`;
}

function samePoint(first: Point, second: Point) {
  return first.x === second.x && first.y === second.y;
}

function isOpposite(first: Direction, second: Direction) {
  return (
    (first === "up" && second === "down") ||
    (first === "down" && second === "up") ||
    (first === "left" && second === "right") ||
    (first === "right" && second === "left")
  );
}

function movePoint(point: Point, direction: Direction): Point {
  if (direction === "up") return { x: point.x, y: point.y - 1 };
  if (direction === "down") return { x: point.x, y: point.y + 1 };
  if (direction === "left") return { x: point.x - 1, y: point.y };
  return { x: point.x + 1, y: point.y };
}

function chooseRegularFood(): { kind: RegularFoodKind; points: number } {
  const roll = Math.random();
  const kind: RegularFoodKind = roll > 0.88 ? "gem" : roll > 0.66 ? "berry" : "apple";
  return { kind, points: FOOD_META[kind].points };
}

function spawnFood(snake: Point[], blocked: Point[] = []): Food {
  const occupied = new Set([...snake, ...blocked].map(pointKey));
  const available: Point[] = [];

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!occupied.has(`${x}:${y}`)) available.push({ x, y });
    }
  }

  const position = available[Math.floor(Math.random() * available.length)] ?? { x: 0, y: 0 };
  const selected = chooseRegularFood();
  return { ...position, ...selected };
}

function getDirectionFromKey(key: string): Direction | null {
  const normalized = key.toLowerCase();
  if (normalized === "arrowup" || normalized === "w") return "up";
  if (normalized === "arrowdown" || normalized === "s") return "down";
  if (normalized === "arrowleft" || normalized === "a") return "left";
  if (normalized === "arrowright" || normalized === "d") return "right";
  return null;
}

function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 46 46" aria-hidden="true">
      <path d="M11 29.5c0-8 5.6-13 12.7-13 5.5 0 9.8 2.4 11.3 7.4" />
      <path d="M34.5 23.9c1.2 5.5-2.5 10.5-8.2 10.5-4.2 0-7.6-2.7-7.6-6.8 0-3.6 2.7-6.2 6.1-6.2 2.6 0 4.5 1.5 4.5 3.7 0 2-1.4 3.3-3.3 3.3" />
      <circle cx="31.5" cy="13.5" r="2.5" />
      <path d="M12 13.8 15 9.5l1.1 5.8" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5v14M17 5v14" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 10v4h3l4 3V7l-4 3H5Z" />
      {muted ? <path d="m17 9 4 6m0-6-4 6" /> : <path d="M16 9.5a4 4 0 0 1 0 5" />}
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function FoodGlyph({ kind }: { kind: FoodKind }) {
  if (kind === "apple") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M17 8c-1.6-2.1-.4-4.6 2.5-5.2.5 2.4-.4 4.5-2.5 5.2Z" />
        <path d="M15.4 8.5c-2.1-1.6-6.7-1.1-8.3 3.8-1.5 4.5 1.2 12.3 5.3 12.3 1.6 0 2.4-1.1 3.8-1.1s2.2 1.1 3.8 1.1c4 0 6.7-7.1 5.1-12.1-1.4-4.6-5.6-5.4-8.2-4Z" />
        <path d="M16 8c.3-2 .9-3.1 2.2-4" />
      </svg>
    );
  }

  if (kind === "berry") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 9c-5.7 0-9.5 3.2-9.5 8.5S10.5 26 16 26s9.5-3.2 9.5-8.5S21.7 9 16 9Z" />
        <path d="M16 9c-1.4-3.6-4.4-5-7.2-4.1 1.1 3.3 3.3 5 7.2 4.1Zm0 0c1.4-3.6 4.4-5 7.2-4.1-1.1 3.3-3.3 5-7.2 4.1Z" />
        <circle cx="12" cy="16" r="1" />
        <circle cx="17" cy="14" r="1" />
        <circle cx="20" cy="18" r="1" />
      </svg>
    );
  }

  if (kind === "gem") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="m8 11 5-5h6l5 5-8 14-8-14Z" />
        <path d="m8 11h16M13 6l3 19 3-19M10.5 11 16 25l5.5-14" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="m16 4 2.3 6.6 6.7.2-5.3 4.1 1.9 6.5-5.6-3.8-5.6 3.8 1.9-6.5L7 10.8l6.7-.2L16 4Z" />
      <circle cx="16" cy="16" r="12" />
    </svg>
  );
}

function App() {
  const [gameStatus, setGameStatus] = useState<GameStatus>("ready");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => readStoredNumber(HIGH_SCORE_KEY, 0));
  const [level, setLevel] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(() => readStoredBoolean(SOUND_KEY, true));
  const [snake, setSnake] = useState<Point[]>(createInitialSnake);
  const [food, setFood] = useState<Food>(() => spawnFood(createInitialSnake()));
  const [bonus, setBonus] = useState<Food | null>(null);

  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const bonusRef = useRef<Food | null>(bonus);
  const scoreRef = useRef(score);
  const highScoreRef = useRef(highScore);
  const statusRef = useRef(gameStatus);
  const directionRef = useRef<Direction>("right");
  const queuedDirectionRef = useRef<Direction>("right");
  const inputLockedRef = useRef(false);
  const nextBonusAtRef = useRef(Date.now() + 9000);
  const audioContextRef = useRef<AudioContext | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const speed = Math.max(
    62,
    DIFFICULTY_SETTINGS[difficulty].startingSpeed - (level - 1) * 7,
  );
  const levelProgress = Math.min(100, ((score % 50) / 50) * 100);

  useEffect(() => {
    snakeRef.current = snake;
  }, [snake]);

  useEffect(() => {
    foodRef.current = food;
  }, [food]);

  useEffect(() => {
    bonusRef.current = bonus;
  }, [bonus]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    highScoreRef.current = highScore;
  }, [highScore]);

  useEffect(() => {
    statusRef.current = gameStatus;
  }, [gameStatus]);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = "sine") => {
    if (!soundEnabledRef.current || typeof window === "undefined") return;

    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    if (!audioContextRef.current) audioContextRef.current = new AudioContextConstructor();
    const context = audioContextRef.current;
    if (context.state === "suspended") void context.resume();

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }, []);

  const endGame = useCallback(() => {
    statusRef.current = "over";
    setGameStatus("over");

    const finalScore = scoreRef.current;
    if (finalScore > highScoreRef.current) {
      highScoreRef.current = finalScore;
      setHighScore(finalScore);
      window.localStorage.setItem(HIGH_SCORE_KEY, String(finalScore));
    }

    playTone(190, 0.16, "sawtooth");
    window.setTimeout(() => playTone(110, 0.23, "triangle"), 100);
  }, [playTone]);

  const tick = useCallback(() => {
    if (statusRef.current !== "playing") return;

    const now = Date.now();
    if (bonusRef.current && bonusRef.current.expiresAt && now >= bonusRef.current.expiresAt) {
      bonusRef.current = null;
      setBonus(null);
      nextBonusAtRef.current = now + 6500;
    }

    const currentSnake = snakeRef.current;
    const direction = queuedDirectionRef.current;
    directionRef.current = direction;
    inputLockedRef.current = false;
    const nextHead = movePoint(currentSnake[0], direction);
    const currentFood = foodRef.current;
    const currentBonus = bonusRef.current;
    const eatsFood = samePoint(nextHead, currentFood);
    const eatsBonus = currentBonus !== null && samePoint(nextHead, currentBonus);

    const hitsWall =
      nextHead.x < 0 || nextHead.x >= COLS || nextHead.y < 0 || nextHead.y >= ROWS;
    const bodyToCheck = eatsFood || eatsBonus ? currentSnake : currentSnake.slice(0, -1);
    const hitsSelf = bodyToCheck.some((segment) => samePoint(segment, nextHead));

    if (hitsWall || hitsSelf) {
      endGame();
      return;
    }

    const nextSnake = [nextHead, ...currentSnake];
    if (!eatsFood && !eatsBonus) nextSnake.pop();
    snakeRef.current = nextSnake;
    setSnake(nextSnake);

    if (eatsFood || eatsBonus) {
      const earned = eatsBonus ? currentBonus?.points ?? 50 : currentFood.points;
      const nextScore = scoreRef.current + earned;
      scoreRef.current = nextScore;
      setScore(nextScore);
      setLevel(Math.floor(nextScore / 50) + 1);
      playTone(eatsBonus ? 840 : currentFood.kind === "gem" ? 700 : 560, 0.1, "sine");
    }

    if (eatsFood) {
      foodRef.current = spawnFood(nextSnake, bonusRef.current ? [bonusRef.current] : []);
      setFood(foodRef.current);
    }

    if (eatsBonus) {
      bonusRef.current = null;
      setBonus(null);
      nextBonusAtRef.current = now + 6500;
    }

    if (!bonusRef.current && scoreRef.current >= 10 && now >= nextBonusAtRef.current) {
      const bonusPosition = spawnFood(nextSnake, [foodRef.current]);
      const nextBonus: Food = {
        ...bonusPosition,
        kind: "bonus",
        points: 50,
        expiresAt: now + BONUS_DURATION,
      };
      bonusRef.current = nextBonus;
      setBonus(nextBonus);
    }
  }, [endGame, playTone]);

  useEffect(() => {
    if (gameStatus !== "playing") return undefined;
    const timer = window.setInterval(tick, speed);
    return () => window.clearInterval(timer);
  }, [gameStatus, speed, tick]);

  const startGame = useCallback(() => {
    const initialSnake = createInitialSnake();
    const firstFood = spawnFood(initialSnake);

    directionRef.current = "right";
    queuedDirectionRef.current = "right";
    inputLockedRef.current = false;
    nextBonusAtRef.current = Date.now() + 9000;
    snakeRef.current = initialSnake;
    foodRef.current = firstFood;
    bonusRef.current = null;
    scoreRef.current = 0;
    statusRef.current = "playing";
    setSnake(initialSnake);
    setFood(firstFood);
    setBonus(null);
    setScore(0);
    setLevel(1);
    setGameStatus("playing");
    playTone(420, 0.08, "triangle");
  }, [playTone]);

  const togglePause = useCallback(() => {
    if (statusRef.current === "playing") {
      statusRef.current = "paused";
      setGameStatus("paused");
    } else if (statusRef.current === "paused") {
      statusRef.current = "playing";
      setGameStatus("playing");
      playTone(420, 0.06, "triangle");
    }
  }, [playTone]);

  const changeDirection = useCallback((nextDirection: Direction) => {
    if (statusRef.current !== "playing" || inputLockedRef.current) return;
    if (isOpposite(nextDirection, directionRef.current)) return;
    queuedDirectionRef.current = nextDirection;
    inputLockedRef.current = true;
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const nextDirection = getDirectionFromKey(event.key);
      if (nextDirection) {
        event.preventDefault();
        changeDirection(nextDirection);
        return;
      }

      if (event.key === " " || event.key === "Escape") {
        event.preventDefault();
        togglePause();
      }

      if (event.key === "Enter" && (statusRef.current === "ready" || statusRef.current === "over")) {
        event.preventDefault();
        startGame();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeDirection, startGame, togglePause]);

  useEffect(() => {
    window.localStorage.setItem(SOUND_KEY, String(soundEnabled));
  }, [soundEnabled]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      changeDirection(deltaX > 0 ? "right" : "left");
    } else {
      changeDirection(deltaY > 0 ? "down" : "up");
    }
  };

  const toggleSound = () => {
    setSoundEnabled((current) => !current);
  };

  const status = STATUS_META[gameStatus];
  const formattedScore = String(score).padStart(3, "0");
  const formattedHighScore = String(highScore).padStart(3, "0");
  const primaryLabel =
    gameStatus === "playing"
      ? "Pause run"
      : gameStatus === "paused"
        ? "Resume run"
        : gameStatus === "over"
          ? "Restart game"
          : "Play game";
  const primaryAction = gameStatus === "playing" || gameStatus === "paused" ? togglePause : startGame;

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <main className="app-frame">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark">
              <LogoMark />
            </div>
            <div>
              <p className="brand-overline">Arcade / 01</p>
              <h1 className="brand-name"><span>Neon</span> Snake</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="offline-indicator"><span /> Local play only</div>
            <button
              className="icon-button"
              type="button"
              onClick={toggleSound}
              aria-label={soundEnabled ? "Mute sounds" : "Unmute sounds"}
              title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
            >
              <VolumeIcon muted={!soundEnabled} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={togglePause}
              disabled={gameStatus !== "playing" && gameStatus !== "paused"}
              aria-label={gameStatus === "paused" ? "Resume game" : "Pause game"}
              title={gameStatus === "paused" ? "Resume game" : "Pause game"}
            >
              {gameStatus === "paused" ? <PlayIcon /> : <PauseIcon />}
            </button>
          </div>
        </header>

        <div className="game-layout">
          <section className="play-column" aria-label="Snake game board">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Grid protocol</p>
                <h2>Stay in the flow.</h2>
              </div>
              <div className="level-badge">
                <span>Level</span>
                <strong>{String(level).padStart(2, "0")}</strong>
              </div>
            </div>

            <div className="board-wrap">
              <div
                className={`game-board status-${gameStatus}`}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={(event) => event.preventDefault()}
                aria-label="Snake game board. Use arrow keys, WASD, or swipe to move."
                role="application"
              >
                <div className="board-sheen" />

                <div
                  className={`food-token food-${food.kind}`}
                  style={{
                    left: `${(food.x / COLS) * 100}%`,
                    top: `${(food.y / ROWS) * 100}%`,
                  }}
                  title={`${FOOD_META[food.kind as RegularFoodKind]?.label ?? "Food"}: ${food.points} points`}
                >
                  <FoodGlyph kind={food.kind} />
                </div>

                {bonus && (
                  <div
                    className="food-token food-bonus"
                    style={{
                      left: `${(bonus.x / COLS) * 100}%`,
                      top: `${(bonus.y / ROWS) * 100}%`,
                    }}
                    title={`Bonus star: ${bonus.points} points`}
                  >
                    <FoodGlyph kind="bonus" />
                    <span className="bonus-timer" />
                  </div>
                )}

                {snake.map((segment, index) => {
                  const segmentStyle = {
                    left: `${(segment.x / COLS) * 100}%`,
                    top: `${(segment.y / ROWS) * 100}%`,
                    "--segment-speed": `${Math.max(speed - 12, 45)}ms`,
                  } as CSSProperties;

                  return (
                    <div
                      className={`snake-segment ${index === 0 ? "snake-head" : ""} ${index === snake.length - 1 ? "snake-tail" : ""}`}
                      key={`segment-${index}`}
                      style={segmentStyle}
                    >
                      {index === 0 && (
                        <span className={`snake-eyes face-${directionRef.current}`} aria-hidden="true">
                          <i />
                          <i />
                        </span>
                      )}
                    </div>
                  );
                })}

                {gameStatus !== "playing" && (
                  <div className="board-overlay">
                    <div className="overlay-content">
                      <span className={`status-orb orb-${gameStatus}`} />
                      <p className="overlay-kicker">{status.eyebrow}</p>
                      <h3>{gameStatus === "over" ? "Run complete." : gameStatus === "paused" ? "Hold position." : "Ready when you are."}</h3>
                      <p>{gameStatus === "over" ? `Final score ${formattedScore} / best ${formattedHighScore}` : status.description}</p>
                      <button className="overlay-action" type="button" onClick={primaryAction}>
                        <PlayIcon />
                        <span>{gameStatus === "over" ? "Restart" : gameStatus === "ready" ? "Play" : "Resume"}</span>
                        <ChevronIcon />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="board-caption">
                <span><i className="caption-dot dot-lime" /> Swipe or use WASD</span>
                <span><i className="caption-dot dot-coral" /> Bonus star +50</span>
                {bonus && <span className="bonus-live">Bonus live <b /></span>}
              </div>
            </div>
          </section>

          <aside className="control-column" aria-label="Game controls and score">
            <div className="score-header">
              <div>
                <p className="section-kicker">Current run</p>
                <div className="score-value">{formattedScore}</div>
              </div>
              <div className="best-score">
                <span>Best score</span>
                <strong>{formattedHighScore}</strong>
              </div>
            </div>

            <div className="status-line">
              <span className={`status-dot status-dot-${gameStatus}`} />
              <span>{status.label}</span>
              <span className="status-line-rule" />
              <span className="status-speed">{Math.round(1000 / speed)} t/s</span>
            </div>

            <button className="primary-action" type="button" onClick={primaryAction}>
              <span className="primary-icon">{gameStatus === "playing" ? <PauseIcon /> : <PlayIcon />}</span>
              <span>{primaryLabel}</span>
              <ChevronIcon />
            </button>

            <div className="control-section difficulty-section">
              <div className="control-label-row">
                <span className="section-kicker">Difficulty</span>
                <span className="control-hint">{DIFFICULTY_SETTINGS[difficulty].hint}</span>
              </div>
              <div className="difficulty-picker" role="group" aria-label="Difficulty selection">
                {(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).map((option) => (
                  <button
                    className={difficulty === option ? "difficulty-option is-selected" : "difficulty-option"}
                    type="button"
                    key={option}
                    onClick={() => setDifficulty(option)}
                    aria-pressed={difficulty === option}
                  >
                    <span className="difficulty-signal" />
                    {DIFFICULTY_SETTINGS[option].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-section level-section">
              <div className="control-label-row">
                <span className="section-kicker">Level progress</span>
                <strong>{level === 1 ? "50" : level * 50} pts to next</strong>
              </div>
              <div className="progress-track"><span style={{ width: `${levelProgress}%` }} /></div>
              <p className="level-note">Speed rises with every level. Collect the rare gems for a fast track.</p>
            </div>

            <div className="control-section food-guide">
              <div className="control-label-row">
                <span className="section-kicker">Food guide</span>
                <span className="control-hint">Random drops</span>
              </div>
              <div className="food-legend">
                {(Object.keys(FOOD_META) as RegularFoodKind[]).map((kind) => (
                  <div className="food-legend-item" key={kind}>
                    <span className={`legend-glyph food-${kind}`}><FoodGlyph kind={kind} /></span>
                    <span><b>{FOOD_META[kind].points}</b> {FOOD_META[kind].label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="controls-note">
              <div className="key-cluster" aria-hidden="true">
                <span className="key key-up">W</span>
                <span className="key">A</span>
                <span className="key">S</span>
                <span className="key">D</span>
              </div>
              <div>
                <strong>Keyboard ready</strong>
                <span>Arrow keys / WASD / swipe</span>
              </div>
            </div>

            <div className="privacy-note"><span /> No ads. No tracking. Runs locally in your browser.</div>
          </aside>
        </div>

        <footer className="footer-bar">
          <span>Neon Snake / build 01</span>
          <span>Pause with spacebar or escape</span>
          <button type="button" className="footer-sound" onClick={toggleSound}>
            <span className={soundEnabled ? "sound-bars" : "sound-bars is-muted"}><i /><i /><i /></span>
            {soundEnabled ? "Sound on" : "Sound off"}
          </button>
        </footer>
      </main>
    </div>
  );
}

export default App;