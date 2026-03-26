import { useCallback, useMemo, useState } from "react";
import {
  MAX_ROOMS_PER_BOOKING,
  allHotelRoomNumbers,
  computeOptimalBooking,
  parseRoom,
  travelMinutesBetween,
} from "./booking";

type RoomStatus = "free" | "occupied" | "booked";

const ALL_ROOMS = allHotelRoomNumbers();

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export default function App() {
  const [occupied, setOccupied] = useState<Set<number>>(() => new Set());
  const [booked, setBooked] = useState<number[]>([]);
  const [roomCount, setRoomCount] = useState(4);
  const [message, setMessage] = useState<string | null>(null);

  const statusByRoom = useMemo(() => {
    const m = new Map<number, RoomStatus>();
    for (const n of ALL_ROOMS) {
      if (booked.includes(n)) m.set(n, "booked");
      else if (occupied.has(n)) m.set(n, "occupied");
      else m.set(n, "free");
    }
    return m;
  }, [occupied, booked]);

  /** Rooms eligible for assignment (not blocked by random occupancy). */
  const availableForBooking = useMemo(() => {
    return new Set(ALL_ROOMS.filter((n) => !occupied.has(n)));
  }, [occupied]);

  const vacantCount = useMemo(() => {
    let n = 0;
    for (const r of ALL_ROOMS) {
      if (!occupied.has(r)) n++;
    }
    return n;
  }, [occupied]);

  const sortedBooked = useMemo(() => {
    return [...booked].sort(
      (a, b) =>
        parseRoom(a).floor - parseRoom(b).floor ||
        parseRoom(a).index - parseRoom(b).index
    );
  }, [booked]);

  const bookingTravel =
    sortedBooked.length >= 2
      ? travelMinutesBetween(sortedBooked[0], sortedBooked[sortedBooked.length - 1])
      : sortedBooked.length === 1
        ? 0
        : null;

  const handleBook = useCallback(() => {
    setMessage(null);
    const k = Math.min(MAX_ROOMS_PER_BOOKING, Math.max(1, Math.round(roomCount)));
    const result = computeOptimalBooking(availableForBooking, k);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setBooked(result.rooms);
    setMessage(
      `Assigned ${result.rooms.length} room(s). Span (first→last): ${result.travelMinutes} min` +
        (result.sameFloor ? " · Same floor" : "")
    );
  }, [availableForBooking, roomCount]);

  const handleRandomOccupancy = useCallback(() => {
    setMessage(null);
    setBooked([]);
    const pool = [...ALL_ROOMS];
    shuffleInPlace(pool);
    const n = 35 + Math.floor(Math.random() * 25);
    setOccupied(new Set(pool.slice(0, n)));
  }, []);

  const handleReset = useCallback(() => {
    setOccupied(new Set());
    setBooked([]);
    setMessage(null);
  }, []);

  const floors = useMemo(() => {
    const f: { floor: number; rooms: number[] }[] = [];
    for (let fl = 1; fl <= 9; fl++) {
      f.push({
        floor: fl,
        rooms: ALL_ROOMS.filter(
          (n) => parseRoom(n).floor === fl && n < 1000
        ),
      });
    }
    f.push({
      floor: 10,
      rooms: ALL_ROOMS.filter((n) => n >= 1001 && n <= 1007),
    });
    return f;
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Hotel Room Reservation</h1>
        <p className="sub">
          97 rooms · 10 floors · Lift & stairs on the left · Horizontal 1 min per
          room · Vertical 2 min per floor
        </p>
      </header>

      <section className="controls card">
        <div className="field">
          <label htmlFor="rooms">Rooms to book (max {MAX_ROOMS_PER_BOOKING})</label>
          <input
            id="rooms"
            type="number"
            min={1}
            max={MAX_ROOMS_PER_BOOKING}
            value={roomCount}
            onChange={(e) =>
              setRoomCount(Number(e.target.value) || 1)
            }
          />
        </div>
        <div className="buttons">
          <button type="button" className="primary" onClick={handleBook}>
            Book optimally
          </button>
          <button type="button" onClick={handleRandomOccupancy}>
            Random occupancy
          </button>
          <button type="button" className="ghost" onClick={handleReset}>
            Reset all
          </button>
        </div>
        <div className="stats">
          <span>
            Vacant (not occupied): <strong>{vacantCount}</strong>
          </span>
          <span>
            Eligible for booking: <strong>{availableForBooking.size}</strong>
          </span>
          {bookingTravel !== null && booked.length > 0 && (
            <span>
              Current booking span: <strong>{bookingTravel} min</strong>
            </span>
          )}
        </div>
        {message && <p className="message">{message}</p>}
      </section>

      <section className="legend">
        <span>
          <i className="swatch free" /> Free
        </span>
        <span>
          <i className="swatch occupied" /> Occupied
        </span>
        <span>
          <i className="swatch booked" /> This booking
        </span>
        <span className="lift-note">← Lift / stairs</span>
      </section>

      <div className="building">
        {[...floors].reverse().map(({ floor, rooms }) => (
          <div key={floor} className="floor-row">
            <div className="floor-label">
              <span className="floor-num">{floor}</span>
              <span className="floor-meta">
                {floor === 10 ? "7 rooms" : "10 rooms"}
              </span>
            </div>
            <div className="lift-shaft" title="Lift & staircase" />
            <div className="corridor">
              {rooms.map((n) => {
                const st = statusByRoom.get(n) ?? "free";
                return (
                  <div
                    key={n}
                    className={`cell ${st}`}
                    title={`Room ${n} · ${st}`}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
