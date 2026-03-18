"use strict";

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

function runNodeScript(scriptPath, cwd) {
  return new Promise((resolve, reject) => {
    const proc = childProcess.spawn(process.execPath, [scriptPath], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      console.log(`[StudioTools] ${text.trimEnd()}`);
    });

    proc.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      console.warn(`[StudioTools] ${text.trimEnd()}`);
    });

    proc.on("error", (error) => reject(error));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }
      reject(new Error(`Sprite pipeline failed with code ${code}.\n${stderr || stdout}`));
    });
  });
}

module.exports = {
  load() {
    console.log("[StudioTools] loaded");
  },

  unload() {
    console.log("[StudioTools] unloaded");
  },

  methods: {
    async runSpritePipeline() {
      const projectPath = Editor.Project.path;
      const scriptPath = path.join(projectPath, "tools", "sprite-pipeline", "process-spritesheet.js");

      if (!fs.existsSync(scriptPath)) {
        Editor.Dialog.warn("Sprite pipeline script not found. Expected: tools/sprite-pipeline/process-spritesheet.js");
        return;
      }

      try {
        console.log("[StudioTools] Running sprite pipeline...");
        await runNodeScript(scriptPath, projectPath);
        Editor.Dialog.info("Sprite pipeline finished. Check assets/resources/sprites and tools/sprite-pipeline/output.");
      } catch (error) {
        const message = error && error.message ? error.message : String(error);
        Editor.Dialog.warn(`Sprite pipeline failed.\n\n${message}`);
      }
    },

    async openSpritePipelineFolder() {
      const projectPath = Editor.Project.path;
      const pipelinePath = path.join(projectPath, "tools", "sprite-pipeline");

      if (!fs.existsSync(pipelinePath)) {
        Editor.Dialog.warn("tools/sprite-pipeline does not exist.");
        return;
      }

      const openTarget = process.platform === "win32" ? "explorer" : process.platform === "darwin" ? "open" : "xdg-open";
      childProcess.spawn(openTarget, [pipelinePath], { detached: true, stdio: "ignore" }).unref();
    },
  },
};
