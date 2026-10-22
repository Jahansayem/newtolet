#!/usr/bin/env python3
"""Copy specific Storage objects (listed in paths.txt as 'bucket|path') from the
old hosted Supabase project to the new self-hosted one. No bucket listing, so it
is immune to the source list endpoint's 544 errors. Resumable and incremental.

Env: OLD_URL, OLD_KEY, NEW_URL, NEW_KEY, PATHS (file), DONE (progress file)
"""
import os
import sys
import time
import urllib.request
import urllib.error

OLD_URL = os.environ["OLD_URL"].rstrip("/")
OLD_KEY = os.environ["OLD_KEY"]
NEW_URL = os.environ["NEW_URL"].rstrip("/")
NEW_KEY = os.environ["NEW_KEY"]
PATHS = os.environ.get("PATHS", "/root/migration/paths.txt")
DONE = os.environ.get("DONE", "/root/migration/copy-done.txt")

CT = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
      ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf",
      ".heic": "image/heic", ".bmp": "image/bmp"}


def ctype(path):
    ext = path[path.rfind("."):].lower() if "." in path else ""
    return CT.get(ext, "application/octet-stream")


def do(method, url, key, data=None, extra=None):
    h = {"Authorization": "Bearer " + key, "apikey": key}
    if extra:
        h.update(extra)
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(r, timeout=180) as resp:
        return resp.status, resp.read()


def download(bucket, path):
    # service-role authenticated download works for public and private buckets
    url = f"{OLD_URL}/storage/v1/object/{bucket}/{path}"
    return do("GET", url, OLD_KEY)[1]


def upload(bucket, path, data):
    url = f"{NEW_URL}/storage/v1/object/{bucket}/{path}"
    do("POST", url, NEW_KEY, data, {"Content-Type": ctype(path), "x-upsert": "true"})


def main():
    done = set()
    if os.path.exists(DONE):
        with open(DONE) as f:
            done = set(line.rstrip("\n") for line in f)
    items = []
    with open(PATHS) as f:
        for line in f:
            line = line.rstrip("\n")
            if "|" in line:
                items.append(line)
    total = len(items)
    print(f"total={total} already_done={len(done)}", flush=True)
    copied = skipped = failed = 0
    donef = open(DONE, "a")
    for i, entry in enumerate(items, 1):
        if entry in done:
            skipped += 1
            continue
        bucket, path = entry.split("|", 1)
        if not path:
            continue
        ok = False
        for attempt in range(1, 5):
            try:
                data = download(bucket, path)
                upload(bucket, path, data)
                ok = True
                break
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    # source object gone; record so we don't retry forever
                    print(f"MISSING {bucket}/{path}", flush=True)
                    break
                time.sleep(2 * attempt)
            except Exception:
                time.sleep(2 * attempt)
        if ok:
            copied += 1
            donef.write(entry + "\n")
            donef.flush()
        else:
            failed += 1
            if failed <= 30:
                print(f"FAIL {bucket}/{path}", flush=True)
        if i % 500 == 0:
            print(f"...{i}/{total} copied={copied} skipped={skipped} failed={failed}", flush=True)
    donef.close()
    print(f"DONE copied={copied} skipped={skipped} failed={failed}", flush=True)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
