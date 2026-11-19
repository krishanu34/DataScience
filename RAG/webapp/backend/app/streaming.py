import json
import time


def sse(event, data):
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


class Clock:
    def __init__(self):
        self.start = time.perf_counter()
        self.last = self.start

    def total_ms(self):
        return round((time.perf_counter() - self.start) * 1000)

    def lap(self):
        # Milliseconds since the previous lap, so each stage reports its own duration.
        now = time.perf_counter()
        elapsed = round((now - self.last) * 1000)
        self.last = now
        return elapsed


def timed(source):
    """Adds `t` (milliseconds since the run started) to every event."""
    start = time.perf_counter()
    for event, data in source:
        yield event, {**data, "t": round((time.perf_counter() - start) * 1000)}
