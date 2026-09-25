// The save state of one market card, as a pure state machine so the rules
// can be tested without React. The card feeds it the pick its controls form
// (null while incomplete) and the result of each save; it answers with the
// next state and, when a request should go out, the pick to send.
//
// Latest wins. While a save is in flight a newer selection waits in `queued`
// and goes out when the first one settles; anything chosen in between is
// dropped. Each request carries a sequence number, and a response that is not
// for the request in flight is ignored, so a slow early answer can never
// overwrite a later choice.

import type { MarketPick } from "@/lib/markets";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export type AutosaveState = {
  // The call the database holds, as far as this card knows.
  confirmed: MarketPick | null;
  // The pick the controls currently form; null while incomplete.
  draft: MarketPick | null;
  inFlight: { seq: number; pick: MarketPick } | null;
  queued: MarketPick | null;
  // The pick whose save failed, kept for retry.
  failed: MarketPick | null;
  status: AutosaveStatus;
  error: string | null;
  // The market locked under us; the card shows its locked summary.
  locked: boolean;
  seq: number;
};

export type AutosaveEvent =
  | { type: "select"; pick: MarketPick | null }
  | { type: "settled"; seq: number; ok: true }
  | { type: "settled"; seq: number; ok: false; error: string; locked: boolean }
  | { type: "retry" };

export type AutosaveSend = { seq: number; pick: MarketPick };

export function initialAutosave(confirmed: MarketPick | null): AutosaveState {
  return {
    confirmed,
    draft: confirmed,
    inFlight: null,
    queued: null,
    failed: null,
    status: confirmed ? "saved" : "idle",
    error: null,
    locked: false,
    seq: 0,
  };
}

export function samePick(a: MarketPick | null, b: MarketPick | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function start(state: AutosaveState, pick: MarketPick): [AutosaveState, AutosaveSend] {
  const seq = state.seq + 1;
  return [
    { ...state, seq, inFlight: { seq, pick }, queued: null, status: "saving", error: null },
    { seq, pick },
  ];
}

export function stepAutosave(
  state: AutosaveState,
  event: AutosaveEvent,
): [AutosaveState, AutosaveSend | null] {
  if (state.locked) return [state, null];

  switch (event.type) {
    case "select": {
      const next = { ...state, draft: event.pick };
      if (event.pick === null) return [{ ...next, queued: null }, null];
      if (next.inFlight) {
        const queued = samePick(event.pick, next.inFlight.pick) ? null : event.pick;
        return [{ ...next, queued }, null];
      }
      if (samePick(event.pick, next.confirmed)) {
        return [{ ...next, failed: null, error: null, status: "saved" }, null];
      }
      return start({ ...next, failed: null }, event.pick);
    }

    case "settled": {
      if (!state.inFlight || event.seq !== state.inFlight.seq) return [state, null];
      const sent = state.inFlight.pick;
      if (!event.ok && event.locked) {
        return [
          { ...state, inFlight: null, queued: null, locked: true, status: "idle", error: null },
          null,
        ];
      }
      const base: AutosaveState = event.ok
        ? { ...state, inFlight: null, confirmed: sent, failed: null, error: null, status: "saved" }
        : { ...state, inFlight: null, failed: sent, error: event.error, status: "error" };
      if (base.queued && !samePick(base.queued, base.confirmed)) {
        return start({ ...base, failed: null }, base.queued);
      }
      return [{ ...base, queued: null }, null];
    }

    case "retry": {
      if (state.inFlight || !state.failed) return [state, null];
      return start(state, state.failed);
    }
  }
}

// Whether leaving the page now could lose work: a save still out, one that
// failed, or a saved call whose controls were cleared back to incomplete.
export function hasPendingWork(state: AutosaveState): boolean {
  if (state.locked) return false;
  if (state.inFlight || state.status === "error") return true;
  return state.draft === null && state.confirmed !== null;
}
