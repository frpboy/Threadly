"""Parse cmd package list packages -U output for one exact target. No fallback UID."""
import re
import sys

TARGET = "com.frpboy.threadly.qa"

def parse_uid(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) != 1:
        raise ValueError("expected exactly one package UID record")
    match = re.fullmatch(r"package:" + re.escape(TARGET) + r" uid:([0-9]+)", lines[0])
    if not match:
        raise ValueError("malformed or wrong target package UID record")
    uid = int(match.group(1))
    if not 10000 <= uid <= 19999:
        raise ValueError("expected ordinary user-0 application UID")
    return uid

if __name__ == "__main__":
    try:
        print(parse_uid(sys.stdin.read()))
    except ValueError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
