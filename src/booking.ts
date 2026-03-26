/** Floors 1–9: rooms 101–110 etc.; floor 10: 1001–1007. Lift/stairs at index 0 (left). */

export const MAX_ROOMS_PER_BOOKING = 5;

export type RoomCoord = { floor: number; index: number; number: number };

export function allHotelRoomNumbers(): number[] {
  const out: number[] = [];
  for (let f = 1; f <= 9; f++) {
    for (let i = 0; i < 10; i++) {
      out.push(100 * f + 1 + i);
    }
  }
  for (let i = 0; i < 7; i++) {
    out.push(1001 + i);
  }
  return out;
}

export function parseRoom(roomNumber: number): RoomCoord {
  if (roomNumber >= 1001 && roomNumber <= 1007) {
    return { floor: 10, index: roomNumber - 1001, number: roomNumber };
  }
  const floor = Math.floor(roomNumber / 100);
  return {
    floor,
    index: roomNumber - 100 * floor - 1,
    number: roomNumber,
  };
}

function compareLex(a: RoomCoord, b: RoomCoord): number {
  if (a.floor !== b.floor) return a.floor - b.floor;
  return a.index - b.index;
}

/**
 * One minute per horizontal step toward the lift (index 0); two minutes per floor change.
 */
export function travelMinutesBetween(a: number, b: number): number {
  const A = parseRoom(a);
  const B = parseRoom(b);
  if (A.floor === B.floor) {
    return Math.abs(A.index - B.index);
  }
  const low = compareLex(A, B) <= 0 ? A : B;
  const high = compareLex(A, B) <= 0 ? B : A;
  return low.index + 2 * (high.floor - low.floor) + high.index;
}

export type BookingResult =
  | { ok: true; rooms: number[]; travelMinutes: number; sameFloor: boolean }
  | { ok: false; reason: string };

/**
 * Span of a booking = travel from lex-min to lex-max room (lift on the left).
 * Rule: same-floor assignments are mandatory when any floor has ≥ k free rooms; otherwise
 * minimize span using any rooms (multi-floor).
 */
export function computeOptimalBooking(
  availableRoomNumbers: Set<number>,
  k: number
): BookingResult {
  if (k < 1 || k > MAX_ROOMS_PER_BOOKING) {
    return {
      ok: false,
      reason: `Book between 1 and ${MAX_ROOMS_PER_BOOKING} rooms.`,
    };
  }
  const sortedCoords = [...availableRoomNumbers]
    .map((n) => parseRoom(n))
    .sort(compareLex);
  if (sortedCoords.length < k) {
    return {
      ok: false,
      reason: `Only ${sortedCoords.length} room(s) available; need ${k}.`,
    };
  }

  const byFloor = new Map<number, RoomCoord[]>();
  for (const c of sortedCoords) {
    const list = byFloor.get(c.floor) ?? [];
    list.push(c);
    byFloor.set(c.floor, list);
  }

  const sameFloorFloors = [...byFloor.entries()].filter(
    ([, list]) => list.length >= k
  );

  let bestSpan = Infinity;
  let bestWindowLen = Infinity;
  let bestCoords: RoomCoord[] = [];

  if (sameFloorFloors.length > 0) {
    for (const [, list] of sameFloorFloors) {
      list.sort((a, b) => a.index - b.index);
      for (let i = 0; i <= list.length - k; i++) {
        const j = i + k - 1;
        const span = list[j].index - list[i].index;
        const windowLen = j - i + 1;
        const better =
          span < bestSpan ||
          (span === bestSpan && windowLen < bestWindowLen) ||
          (span === bestSpan &&
            windowLen === bestWindowLen &&
            (bestCoords.length === 0 || list[i].floor < bestCoords[0].floor));
        if (better) {
          bestSpan = span;
          bestWindowLen = windowLen;
          bestCoords = list.slice(i, j + 1);
        }
      }
    }
  } else {
    let bestI = 0;
    let bestJ = k - 1;
    for (let i = 0; i < sortedCoords.length; i++) {
      for (let j = i + k - 1; j < sortedCoords.length; j++) {
        const span = travelMinutesBetween(
          sortedCoords[i].number,
          sortedCoords[j].number
        );
        const windowLen = j - i + 1;
        if (
          span < bestSpan ||
          (span === bestSpan && windowLen < bestWindowLen)
        ) {
          bestSpan = span;
          bestWindowLen = windowLen;
          bestI = i;
          bestJ = j;
        }
      }
    }
    bestCoords = sortedCoords.slice(bestI, bestJ + 1);
  }

  const windowNums = bestCoords.map((c) => c.number);
  const lowNum = bestCoords[0].number;
  const highNum = bestCoords[bestCoords.length - 1].number;
  const chosen = resolveKRoomsInWindow(windowNums, k, lowNum, highNum);
  const floors = new Set(chosen.map((n) => parseRoom(n).floor));
  return {
    ok: true,
    rooms: chosen.sort((a, b) => compareLex(parseRoom(a), parseRoom(b))),
    travelMinutes: bestSpan,
    sameFloor: floors.size === 1,
  };
}

/** Include window endpoints so span stays optimal; fill with rooms nearest the middle. */
function resolveKRoomsInWindow(
  windowNums: number[],
  k: number,
  endpointLow: number,
  endpointHigh: number
): number[] {
  if (windowNums.length === k) return [...windowNums];
  const mustNums =
    endpointLow === endpointHigh ? [endpointLow] : [endpointLow, endpointHigh];
  const must = new Set(mustNums);
  const rest = windowNums.filter((n) => !must.has(n));
  const lowC = parseRoom(endpointLow);
  const highC = parseRoom(endpointHigh);
  const midF = (lowC.floor + highC.floor) / 2;
  const midIdx = (lowC.index + highC.index) / 2;
  rest.sort((a, b) => {
    const ca = parseRoom(a);
    const cb = parseRoom(b);
    const da = Math.abs(ca.floor - midF) + Math.abs(ca.index - midIdx);
    const db = Math.abs(cb.floor - midF) + Math.abs(cb.index - midIdx);
    return da - db || compareLex(ca, cb);
  });
  const need = k - must.size;
  const picked = [...mustNums, ...rest.slice(0, need)];
  if (picked.length < k) return windowNums.slice(0, k);
  return picked;
}
