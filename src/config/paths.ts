import path from "node:path";

export const projectRoot = process.cwd();
export const authDir = path.join(projectRoot, "auth");
export const storageStatePath = path.join(authDir, "storage-state.json");
export const dataDir = path.join(projectRoot, "data");
export const screenshotsDir = path.join(dataDir, "screenshots");
export const captureRunsDir = path.join(dataDir, "capture-runs");
