const FINANCE_ACTIONS = new Set(["Balance", "Freeze", "Unfreeze", "Logs", "Payment"]);
const CONTROL_ACTIONS = new Set([
  "Reset Pwd",
  "Kick",
  "Login",
  "Showcase",
  "Edit",
  "Risk Control",
]);
const ACTIVITY_ACTIONS = new Set([
  "Order",
  "Add Clicks",
  "Stop Clicks",
  "Click Logs",
  "Lock Shop",
  "Unlock Shop",
  "Lock Account",
  "Unlock Account",
  "Details",
  "Manage",
]);

// Maps a raw button label (which may include an icon prefix) to its canonical action name.
export const normalizeMerchantAction = (action) =>
  action === "✎ Edit" ? "Edit" : action === "◉ Risk" ? "Risk Control" : action;

// Determines which modal group (finance / control / activity) handles a given merchant action.
export const merchantActionKind = (action) => {
  const normalized = normalizeMerchantAction(action);
  if (FINANCE_ACTIONS.has(normalized)) return "finance";
  if (CONTROL_ACTIONS.has(normalized)) return "control";
  return "activity";
};
