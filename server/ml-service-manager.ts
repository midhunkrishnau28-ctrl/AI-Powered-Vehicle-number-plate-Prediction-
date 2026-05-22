import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

const ML_PORT = 8001;
const ML_DIR = path.join(process.cwd(), "ml");
const WEIGHTS = path.join(ML_DIR, "yolov8n.pt");

let mlProcess: ChildProcess | null = null;
let restartAttempts = 0;
const MAX_RESTARTS = 5;

function log(msg: string) {
  const t = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
  console.log(`${t} [ML Service] ${msg}`);
}

export function startMlService() {
  // Don't start if weights file is missing
  if (!fs.existsSync(WEIGHTS)) {
    log(`WARNING: yolov8n.pt not found at ${WEIGHTS}. ML service will not start.`);
    return;
  }

  // Don't start if ml directory is missing
  if (!fs.existsSync(ML_DIR)) {
    log("WARNING: ml/ directory not found. ML service will not start.");
    return;
  }

  log("Starting Python ANPR ML service on port " + ML_PORT + "...");

  mlProcess = spawn(
    "python",
    ["-m", "uvicorn", "service.app:app", "--host", "127.0.0.1", "--port", String(ML_PORT)],
    {
      cwd: ML_DIR,
      env: {
        ...process.env,
        PLATE_DETECTOR_WEIGHTS: WEIGHTS,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  mlProcess.stdout?.on("data", (data: Buffer) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      if (line.trim()) log(line.trim());
    });
  });

  mlProcess.stderr?.on("data", (data: Buffer) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => {
      if (line.trim()) log(`[stderr] ${line.trim()}`);
    });
  });

  mlProcess.on("exit", (code, signal) => {
    mlProcess = null;
    if (signal === "SIGTERM" || signal === "SIGINT") {
      log("ML service stopped (shutdown signal).");
      return;
    }
    log(`ML service exited with code ${code}. Restarting... (attempt ${restartAttempts + 1}/${MAX_RESTARTS})`);
    if (restartAttempts < MAX_RESTARTS) {
      restartAttempts++;
      // Exponential backoff: 3s, 6s, 12s, 24s, 48s
      const delay = Math.pow(2, restartAttempts) * 1500;
      setTimeout(startMlService, delay);
    } else {
      log(`ML service failed to start after ${MAX_RESTARTS} attempts. Giving up.`);
    }
  });

  mlProcess.on("error", (err) => {
    log(`Failed to spawn ML process: ${err.message}`);
    log("Make sure Python is installed and 'python' is in your PATH.");
  });

  // Reset restart counter after a successful 30s run
  setTimeout(() => {
    if (mlProcess) restartAttempts = 0;
  }, 30_000);
}

export function stopMlService() {
  if (mlProcess) {
    log("Stopping ML service...");
    mlProcess.kill("SIGTERM");
    mlProcess = null;
  }
}

// Graceful shutdown hooks
process.on("exit", stopMlService);
process.on("SIGINT", () => { stopMlService(); process.exit(0); });
process.on("SIGTERM", () => { stopMlService(); process.exit(0); });
