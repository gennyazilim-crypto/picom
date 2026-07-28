const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");

const nativeRename = fsPromises.rename.bind(fsPromises);

async function renameWithWindowsFallback(source, target) {
  try {
    return await nativeRename(source, target);
  } catch (error) {
    const isElectronStageRename =
      error?.code === "EPERM" &&
      path.basename(source) === "win-unpacked.tmp" &&
      path.basename(target) === "win-unpacked";

    if (!isElectronStageRename) throw error;

    await fsPromises.cp(source, target, {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
  }
}

Object.defineProperty(fsPromises, "rename", {
  configurable: true,
  enumerable: true,
  writable: true,
  value: renameWithWindowsFallback,
});

if (fs.promises !== fsPromises) {
  Object.defineProperty(fs.promises, "rename", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: renameWithWindowsFallback,
  });
}
