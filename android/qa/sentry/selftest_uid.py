"""Accept only the exact installed selftest target package UID."""
import re,sys
TARGET='com.frpboy.threadly.selftest'

def installed_uid(text):
    records={}
    for line in text.splitlines():
        if not line.strip():continue
        match=re.fullmatch(r'package:(com\.frpboy\.threadly\.selftest) uid:([0-9]+)',line.strip())
        if not match:raise ValueError('Unexpected package UID record')
        package,raw=match.groups();uid=int(raw)
        if package in records or not 10000<=uid<=19999:raise ValueError('Duplicate or unsafe package UID')
        records[package]=uid
    if set(records)!={TARGET}:raise ValueError('Expected exactly the selftest package record')
    return records[TARGET]

if __name__=='__main__':
    try:print(installed_uid(sys.stdin.read()))
    except ValueError as error:print(str(error),file=sys.stderr);sys.exit(1)
