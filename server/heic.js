import { execFile } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
let converting = false;

export async function decodeHeic(buffer) {
  if (converting) {
    throw Object.assign(new Error("照片正在转换，请稍后重试"), { status: 429 });
  }
  converting = true;
  let directory;
  try {
    directory = await mkdtemp(path.join(tmpdir(), "travelmemo-heic-"));
    const input = path.join(directory, "input.heic");
    const output = path.join(directory, "output.png");
    await writeFile(input, buffer);
    await run("heif-convert", [input, output], {
      timeout: 30000,
      killSignal: "SIGKILL",
      maxBuffer: 1024 * 1024,
      env: { ...process.env, OMP_NUM_THREADS: "1" },
    });
    return await readFile(output);
  } catch (error) {
    const message = error.code === "ENOENT" && error.syscall?.startsWith("spawn")
      ? "当前服务未配置 HEIC 解码，请更新部署镜像或转换为 JPG 后重试"
      : error.killed
        ? "HEIC 照片转换超时，请稍后重试"
        : "HEIC 照片无法解码，请转换为 JPG 后重试";
    throw Object.assign(new Error(message), { status: 422 });
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      converting = false;
    }
  }
}
