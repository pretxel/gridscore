import { describe, expect, it } from "vitest";
import {
  type AutosaveEvent,
  type AutosaveState,
  hasPendingWork,
  initialAutosave,
  stepAutosave,
} from "@/lib/pick-autosave";

const A = { driver_id: "a" };
const B = { driver_id: "b" };
const C = { driver_id: "c" };

function run(state: AutosaveState, ...events: AutosaveEvent[]) {
  const sends = [];
  let s = state;
  for (const e of events) {
    const [next, send] = stepAutosave(s, e);
    s = next;
    if (send) sends.push(send);
  }
  return { state: s, sends };
}

describe("stepAutosave", () => {
  it("saves a complete pick as soon as it is made", () => {
    const { state, sends } = run(initialAutosave(null), { type: "select", pick: A });
    expect(sends).toEqual([{ seq: 1, pick: A }]);
    expect(state.status).toBe("saving");
    const done = run(state, { type: "settled", seq: 1, ok: true }).state;
    expect(done.status).toBe("saved");
    expect(done.confirmed).toEqual(A);
  });

  it("does not save an incomplete pick", () => {
    const { sends, state } = run(initialAutosave(null), { type: "select", pick: null });
    expect(sends).toEqual([]);
    expect(state.status).toBe("idle");
  });

  it("does not resend the call already saved", () => {
    const { sends, state } = run(initialAutosave(A), { type: "select", pick: A });
    expect(sends).toEqual([]);
    expect(state.status).toBe("saved");
  });

  it("ends with the last selection when taps outrun the save", () => {
    const { state, sends } = run(
      initialAutosave(null),
      { type: "select", pick: A },
      { type: "select", pick: B },
      { type: "select", pick: C },
      { type: "settled", seq: 1, ok: true },
    );
    // B was superseded before it was ever sent.
    expect(sends).toEqual([
      { seq: 1, pick: A },
      { seq: 2, pick: C },
    ]);
    const done = run(state, { type: "settled", seq: 2, ok: true }).state;
    expect(done.confirmed).toEqual(C);
    expect(done.status).toBe("saved");
  });

  it("ignores a response that is not for the request in flight", () => {
    const { state } = run(
      initialAutosave(null),
      { type: "select", pick: A },
      { type: "settled", seq: 7, ok: true },
    );
    expect(state.status).toBe("saving");
    expect(state.confirmed).toBeNull();
  });

  it("keeps the selection and offers a retry when a save fails", () => {
    const { state } = run(
      initialAutosave(null),
      { type: "select", pick: A },
      { type: "settled", seq: 1, ok: false, error: "boom", locked: false },
    );
    expect(state.status).toBe("error");
    expect(state.error).toBe("boom");
    expect(state.draft).toEqual(A);
    const retried = run(state, { type: "retry" });
    expect(retried.sends).toEqual([{ seq: 2, pick: A }]);
    const done = run(retried.state, { type: "settled", seq: 2, ok: true }).state;
    expect(done.status).toBe("saved");
    expect(done.confirmed).toEqual(A);
  });

  it("falls back to the confirmed call when the market locks under a save", () => {
    const { state } = run(
      initialAutosave(A),
      { type: "select", pick: B },
      { type: "settled", seq: 1, ok: false, error: "locked", locked: true },
    );
    expect(state.locked).toBe(true);
    expect(state.confirmed).toEqual(A);
    // A locked card takes no more selections.
    expect(run(state, { type: "select", pick: C }).sends).toEqual([]);
  });
});

describe("hasPendingWork", () => {
  it("is pending while a save is out or has failed", () => {
    const saving = run(initialAutosave(null), { type: "select", pick: A }).state;
    expect(hasPendingWork(saving)).toBe(true);
    const failed = run(saving, {
      type: "settled",
      seq: 1,
      ok: false,
      error: "x",
      locked: false,
    }).state;
    expect(hasPendingWork(failed)).toBe(true);
  });

  it("is pending when a saved call has been cleared to incomplete", () => {
    const cleared = run(initialAutosave(A), { type: "select", pick: null }).state;
    expect(hasPendingWork(cleared)).toBe(true);
  });

  it("is not pending when everything is saved or nothing was started", () => {
    expect(hasPendingWork(initialAutosave(A))).toBe(false);
    expect(hasPendingWork(run(initialAutosave(null), { type: "select", pick: null }).state)).toBe(
      false,
    );
  });
});
