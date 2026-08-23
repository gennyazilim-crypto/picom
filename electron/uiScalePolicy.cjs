const ALLOWED_INTERFACE_SCALES = Object.freeze([0.9, 1, 1.1, 1.25]);

function isAllowedInterfaceScale(value) {
  return typeof value === "number" && Number.isFinite(value) && ALLOWED_INTERFACE_SCALES.includes(value);
}

function normalizeInterfaceScale(value) {
  return isAllowedInterfaceScale(value) ? value : 1;
}

module.exports = { ALLOWED_INTERFACE_SCALES, isAllowedInterfaceScale, normalizeInterfaceScale };
