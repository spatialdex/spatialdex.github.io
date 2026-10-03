#!/usr/bin/env python3
"""Publish the site anonymously as the org-owned SpatialDex GitHub App.

Replaces the history with one commit by "SpatialDex Authors" and force-pushes it
as the App's bot account, so no personal account appears on the public repo.

Usage: tools/publish.py [--dry-run]
Needs:  pip install pyjwt cryptography
Key:    $SPATIALDEX_APP_KEY, or the newest ~/Downloads/spatialdex*.private-key.pem
Checks: refuses to publish if any line of ~/.spatialdex-blocklist appears in a text file
"""
import glob, json, os, re, subprocess, sys, tempfile, time, urllib.request
import jwt

APP_ID = "5124226"
ORG, REPO = "spatialdex", "spatialdex.github.io"
AUTHOR = ["-c", "user.name=SpatialDex Authors", "-c", "user.email=spatialdex@users.noreply.github.com"]
# Strings that must never be published during review, one per line, kept outside the repo.
BLOCKFILE = os.path.expanduser("~/.spatialdex-blocklist")
BLOCKLIST = open(BLOCKFILE).read().splitlines() if os.path.exists(BLOCKFILE) else []
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def git(*args, **kw):
    return subprocess.run(["git", *args], cwd=ROOT, check=True, text=True, capture_output=True, **kw).stdout


def api(method, path, auth):
    req = urllib.request.Request("https://api.github.com" + path, method=method)
    req.add_header("Authorization", auth)
    req.add_header("Accept", "application/vnd.github+json")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def app_token():
    key = os.environ.get("SPATIALDEX_APP_KEY") or max(
        glob.glob(os.path.expanduser("~/Downloads/spatialdex*.private-key.pem")), key=os.path.getmtime, default=None)
    if not key:
        sys.exit("App private key not found; set SPATIALDEX_APP_KEY")
    now = int(time.time())
    j = jwt.encode({"iat": now - 60, "exp": now + 540, "iss": APP_ID}, open(key).read(), algorithm="RS256")
    inst = api("GET", f"/orgs/{ORG}/installation", f"Bearer {j}")
    return api("POST", f"/app/installations/{inst['id']}/access_tokens", f"Bearer {j}")["token"]


def check_anonymous():
    files = git("ls-files", "--cached", "--others", "--exclude-standard").split()
    text_ext = (".html", ".css", ".js", ".md", ".sh", ".py", ".json", ".txt")
    words = [w.strip().lower() for w in BLOCKLIST if w.strip()] + [os.path.expanduser("~").lower()]
    hits = []
    for f in files:
        if f.endswith(text_ext):
            body = open(os.path.join(ROOT, f), errors="ignore").read().lower()
            hits += [f"{f}: {w}" for w in words if w in body]
    if hits:
        sys.exit("Refusing to publish, identifying strings found:\n  " + "\n  ".join(hits))


def main():
    dry = "--dry-run" in sys.argv
    check_anonymous()
    # one fresh anonymous commit holding the current tree
    git("checkout", "-q", "--orphan", "publish-tmp")
    git("add", "-A")
    git(*AUTHOR, "commit", "-q", "-m", "SpatialDex project page")
    git("branch", "-D", "main")
    git("branch", "-m", "main")
    print(git("log", "--format=%h %an <%ae> | %s").strip())
    if dry:
        print("dry run: not pushed")
        return
    token = app_token()
    with tempfile.TemporaryDirectory() as d:
        ask = os.path.join(d, "askpass.sh")
        with open(ask, "w") as f:
            f.write('#!/bin/sh\ncase "$1" in Username*) echo x-access-token ;; *) echo "$SPX_TOKEN" ;; esac\n')
        os.chmod(ask, 0o700)
        env = {**os.environ, "GIT_ASKPASS": ask, "GIT_TERMINAL_PROMPT": "0", "SPX_TOKEN": token}
        out = subprocess.run(["git", "-c", "credential.helper=", "push", "-f",
                              f"https://github.com/{ORG}/{REPO}.git", "main"],
                             cwd=ROOT, env=env, text=True, capture_output=True)
    print(re.sub(r"x-access-token:[^@]+@", "", out.stderr.strip()))
    if out.returncode:
        sys.exit(out.returncode)
    print("published as the SpatialDex App bot; Pages rebuilds in about a minute")


if __name__ == "__main__":
    main()
