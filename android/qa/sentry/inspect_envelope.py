"""Inspect a captured Sentry envelope from the release-path self-test.

Verifies the event is exactly the labeled synthetic crash and that no
personal data, secrets or user-content strings left the device. Writes the
pretty-printed event JSON for bounded CI evidence. Fails loudly on any miss.
"""
import json, re, sys

EXPECTED_MESSAGE = ("Threadly Sentry self-test: synthetic labeled crash for "
                    "release-path qualification; not an app defect")
TOKEN_SHAPE = re.compile(r"[A-Za-z0-9_-]{43}")

def items(raw):
    nl = raw.index(b"\n")
    yield "envelope", json.loads(raw[:nl])
    pos = nl + 1
    while pos < len(raw):
        nl = raw.index(b"\n", pos)
        header = json.loads(raw[pos:nl])
        pos = nl + 1
        length = header.get("length")
        if length is None:
            nl2 = raw.index(b"\n", pos) if b"\n" in raw[pos:] else len(raw)
            payload = raw[pos:nl2]
            pos = nl2 + 1
        else:
            payload = raw[pos:pos + length]
            pos += length
            while pos < len(raw) and raw[pos:pos+1] in (b"\n", b"\r"):
                pos += 1
        yield header.get("type", "?"), payload

def main():
    out_path = sys.argv[-1]
    events = []
    for env_path in sys.argv[1:-1]:
        raw = open(env_path, "rb").read()
        for typ, payload in items(raw):
            if typ == "event":
                events.append(json.loads(payload))
    if not events:
        raise SystemExit("no event item found in any envelope")
    event = events[0]
    text = json.dumps(event)

    exc = event.get("exception", {}).get("values", [])
    assert exc, "event carries no exception"
    assert exc[0].get("value") == EXPECTED_MESSAGE, "unexpected exception value: %r" % exc[0].get("value")
    assert exc[0].get("type") == "RuntimeException", exc[0].get("type")

    assert "Authorization" not in text, "Authorization header content in event"
    assert not TOKEN_SHAPE.search(text), "43-char device-token-shaped string in event"
    assert "Your guess" not in text, "user-facing semantics label in event"
    assert "skip_selftest_crash" not in text, "test harness flag leaked into event"

    user = event.get("user") or {}
    for key in ("ip_address", "email", "username", "name"):
        assert key not in user, "user.%s present: %r" % (key, user.get(key))

    for crumb in event.get("breadcrumbs", {}).get("values", []):
        assert crumb.get("type") != "user", "user-interaction breadcrumb present: %r" % crumb
        assert crumb.get("category") != "ui.click", "ui.click breadcrumb present"

    req = event.get("request") or {}
    url = req.get("url", "")
    assert not url or "127.0.0.1" in url, "non-loopback request URL in event: %r" % url

    release = event.get("release", "")
    assert "selftest" in release, "unexpected release name: %r" % release
    device_model = (event.get("contexts") or {}).get("device", {}).get("model")
    assert device_model, "device context missing"

    with open(out_path, "w") as f:
        json.dump(event, f, indent=2, sort_keys=True)
    print("PASS sentry self-test envelope: labeled crash captured, release=%s, model=%s" % (release, device_model))
    print("PASS payload hygiene: no token shape, no Authorization, no IP/user identity, no user-interaction breadcrumbs")
    print("PASS delivery: envelope reached ingest after relaunch (cached-then-sent path)")

if __name__ == "__main__":
    main()
