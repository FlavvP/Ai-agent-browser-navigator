import subprocess
import time
import os
import json
import threading
import shutil
from pathlib import Path
from store import STORE
from snapshot import build_snapshot


def _automation_log(event, **data):
    os.makedirs("/config/log", exist_ok=True)
    parts = [time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), event]
    for key, value in data.items():
        parts.append(f"{key}={value}")
    with open("/config/log/agent-automation.log", "a", encoding="utf-8") as log_file:
        log_file.write(" ".join(parts) + "\n")

CONVERSATION_PROFILE_ROOT = Path(os.environ.get("WORKSPACE_CONVERSATION_PROFILE_PATH", "/config"))
USER_PROFILE_ROOT = Path(os.environ.get("WORKSPACE_USER_PROFILE_PATH", "/profiles/user"))
CHROMIUM_PROFILE = CONVERSATION_PROFILE_ROOT / "chromium"
USER_CHROMIUM_PROFILE = USER_PROFILE_ROOT / "chromium"


KEYS = {
    "Enter": ["Return"],
    "Tab": ["Tab"],
    "Esc": ["Escape"],
    "Backspace": ["BackSpace"],
    "Ctrl+A": ["ctrl+a"],
    "Ctrl+L": ["ctrl+l"],
}


def _center(bounds):
    if not bounds:
        raise ValueError("Target element has no bounds.")
    return int(bounds["x"] + bounds["width"] / 2), int(bounds["y"] + bounds["height"] / 2)


def _perform_atspi_action(node_descriptor, preferred_actions):
    node = node_descriptor.get("_node") if isinstance(node_descriptor, dict) else None
    if not node:
        return False
    try:
        action = node.queryAction()
        actions = [action.getName(index) for index in range(action.nActions)]
        for preferred in preferred_actions:
            if preferred in actions:
                return bool(action.doAction(actions.index(preferred)))
        if action.nActions > 0:
            return bool(action.doAction(0))
    except Exception as error:
        _automation_log("atspi_action_failed", error=str(error))
    return False


def _desktop_env():
    env = os.environ.copy()
    env["DISPLAY"] = env.get("DISPLAY", ":1")
    env["HOME"] = str(CONVERSATION_PROFILE_ROOT)
    env["XDG_CONFIG_HOME"] = str(CONVERSATION_PROFILE_ROOT / ".config")
    env["XDG_CACHE_HOME"] = str(CONVERSATION_PROFILE_ROOT / ".cache")
    env["XDG_RUNTIME_DIR"] = "/tmp/runtime-abc"
    env["DBUS_SESSION_BUS_ADDRESS"] = "unix:path=/tmp/runtime-abc/session-bus"
    env["NO_AT_BRIDGE"] = "0"
    env["GTK_MODULES"] = "gail:atk-bridge"
    env["GNOME_ACCESSIBILITY"] = "1"
    env["ACCESSIBILITY_ENABLED"] = "1"
    env["WORKSPACE_CHROMIUM_USER_DATA_DIR"] = str(CHROMIUM_PROFILE)
    return env


def _desktop_command(command):
    env = _desktop_env()
    forwarded_env = [
        f"{key}={env[key]}"
        for key in (
            "DISPLAY",
            "HOME",
            "XDG_CONFIG_HOME",
            "XDG_CACHE_HOME",
            "XDG_RUNTIME_DIR",
            "DBUS_SESSION_BUS_ADDRESS",
            "NO_AT_BRIDGE",
            "GTK_MODULES",
            "GNOME_ACCESSIBILITY",
            "ACCESSIBILITY_ENABLED",
            "PATH",
            "LANG",
            "WORKSPACE_BROWSER_MODE",
            "WORKSPACE_DEFAULT_URL",
            "WORKSPACE_CHROMIUM_USER_DATA_DIR",
        )
        if key in env
    ]
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        return ["runuser", "-u", "abc", "--", "env", *forwarded_env, *command]
    return ["env", *forwarded_env, *command]


def _ensure_browser_profile_ready():
    os.makedirs(CONVERSATION_PROFILE_ROOT / "log", exist_ok=True)
    os.makedirs(CHROMIUM_PROFILE, exist_ok=True)
    os.makedirs(CHROMIUM_PROFILE / "Default", exist_ok=True)
    os.makedirs(CONVERSATION_PROFILE_ROOT / ".cache", exist_ok=True)
    os.makedirs(CONVERSATION_PROFILE_ROOT / ".config", exist_ok=True)
    os.makedirs(CONVERSATION_PROFILE_ROOT / ".local/share/pki", exist_ok=True)
    os.makedirs(USER_CHROMIUM_PROFILE, exist_ok=True)
    os.makedirs("/tmp/runtime-abc", exist_ok=True)
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        for path in (
            str(CONVERSATION_PROFILE_ROOT / "log"),
            str(CHROMIUM_PROFILE),
            str(CONVERSATION_PROFILE_ROOT / ".cache"),
            str(CONVERSATION_PROFILE_ROOT / ".config"),
            str(CONVERSATION_PROFILE_ROOT / ".local"),
            str(USER_PROFILE_ROOT),
            "/tmp/runtime-abc",
        ):
            subprocess.run(["chown", "-R", "abc:abc", path], check=False, timeout=30)


def _sanitize_session_files(profile_path):
    for session_file in (
        profile_path / "Default/Current Session",
        profile_path / "Default/Current Tabs",
        profile_path / "Default/Last Session",
        profile_path / "Default/Last Tabs",
        profile_path / "Default/Sessions",
        profile_path / "SingletonCookie",
        profile_path / "SingletonLock",
        profile_path / "SingletonSocket",
    ):
        try:
            if session_file.is_dir():
                shutil.rmtree(session_file)
            else:
                session_file.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            pass


def _copy_chromium_profile(src, dst, sanitize_session=False):
    if not src.exists():
        return False
    os.makedirs(dst.parent, exist_ok=True)
    shutil.copytree(
        src,
        dst,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns("Singleton*", "Crashpad", "BrowserMetrics-spare.pma"),
    )
    if sanitize_session:
        _sanitize_session_files(dst)
    return True


def _conversation_profile_has_data():
    if not CHROMIUM_PROFILE.exists():
        return False
    for path in CHROMIUM_PROFILE.rglob("*"):
        if path.is_file():
            return True
    return False


def _seed_conversation_profile_if_needed():
    marker = CONVERSATION_PROFILE_ROOT / ".agent-profile-seeded"
    if marker.exists() or _conversation_profile_has_data():
        return
    copied = _copy_chromium_profile(USER_CHROMIUM_PROFILE, CHROMIUM_PROFILE, sanitize_session=True)
    marker.write_text(str(time.time()), encoding="utf-8")
    _automation_log("chromium_profile_seeded", copied=copied)


def _sync_user_profile_from_conversation():
    try:
        copied = _copy_chromium_profile(CHROMIUM_PROFILE, USER_CHROMIUM_PROFILE, sanitize_session=True)
        _automation_log("chromium_profile_synced_to_user", copied=copied)
        return copied
    except Exception as error:
        _automation_log("chromium_profile_sync_failed", error=str(error))
        return False


def _browser_is_running():
    result = subprocess.run(
        ["pgrep", "-u", "abc", "-f", "chromium"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return result.returncode == 0


_WATCHDOG_LOCK = threading.Lock()
_WATCHDOG_STARTED = False
_WATCHDOG_STOP_EVENT = threading.Event()
_LAST_BROWSER_URL = os.environ.get("WORKSPACE_DEFAULT_URL", "https://www.google.com")


def _browser_watchdog_enabled():
    return os.environ.get("WORKSPACE_BROWSER_WATCHDOG_ENABLED", "true").lower() == "true"


def _browser_watchdog_interval():
    try:
        return max(1.0, int(os.environ.get("WORKSPACE_BROWSER_WATCHDOG_INTERVAL_MS", "2000")) / 1000)
    except ValueError:
        return 2.0


def _launch_chromium(url):
    command = ["/usr/local/bin/agent-chromium"]
    if url:
        command.append(str(url))
    with open(CONVERSATION_PROFILE_ROOT / "log/chromium.log", "ab", buffering=0) as log_file:
        subprocess.Popen(
            _desktop_command(command),
            stdout=log_file,
            stderr=log_file,
            start_new_session=True,
        )


def _run_desktop(command, timeout=10, check=False):
    return subprocess.run(
        _desktop_command(command),
        check=check,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _wait_for_desktop_ready(timeout=20):
    deadline = time.time() + timeout
    while time.time() < deadline:
        display = _run_desktop(["xdotool", "getdisplaygeometry"], timeout=2, check=False)
        openbox = subprocess.run(
            ["pgrep", "-u", "abc", "-x", "openbox"],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if display.returncode == 0 and openbox.returncode == 0:
            return True
        time.sleep(0.5)
    _automation_log("desktop_ready_timeout", timeout=timeout)
    return False


def _chromium_window_ids():
    result = _run_desktop(["xdotool", "search", "--class", "chromium"], timeout=5, check=False)
    if result.returncode != 0:
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _normalize_browser_windows():
    ids = _chromium_window_ids()
    if not ids:
        return False

    for window_id in ids:
        _run_desktop(["xdotool", "windowactivate", window_id], timeout=2, check=False)
        _run_desktop(["wmctrl", "-i", "-r", window_id, "-b", "add,maximized_vert,maximized_horz"], timeout=2, check=False)
        _run_desktop(["xdotool", "windowmove", window_id, "0", "0"], timeout=2, check=False)

    return True


def _close_terminal_windows():
    terminal_processes = (
        "x-terminal-emulator",
        "xfce4-terminal",
        "lxterminal",
        "qterminal",
        "mate-terminal",
        "gnome-terminal",
        "konsole",
        "tilix",
        "alacritty",
        "foot",
        "st",
        "xterm",
    )
    closed = 0
    for process_name in terminal_processes:
        result = _run_desktop(["pkill", "-TERM", "-u", "abc", "-x", process_name], timeout=2, check=False)
        if result.returncode == 0:
            closed += 1
    if closed:
        _automation_log("terminal_windows_closed", count=closed)


def _start_browser_watchdog():
    global _WATCHDOG_STARTED
    if not _browser_watchdog_enabled():
        return
    with _WATCHDOG_LOCK:
        if _WATCHDOG_STARTED:
            return
        _WATCHDOG_STOP_EVENT.clear()
        _WATCHDOG_STARTED = True

    def run():
        global _WATCHDOG_STARTED
        _automation_log("browser_watchdog_started", interval=_browser_watchdog_interval())
        while not _WATCHDOG_STOP_EVENT.wait(_browser_watchdog_interval()):
            try:
                if not _browser_is_running():
                    _automation_log("browser_watchdog_restart", restore_session=True)
                    _ensure_browser_profile_ready()
                    _remove_stale_browser_locks()
                    _mark_chromium_clean_shutdown()
                    _wait_for_desktop_ready()
                    _launch_chromium(None)
                    time.sleep(1.0)
                    try:
                        _close_terminal_windows()
                        _normalize_browser_windows()
                    except Exception as normalize_error:
                        _automation_log("browser_watchdog_normalize_failed", error=str(normalize_error))
                elif not _normalize_browser_windows():
                    _automation_log("browser_watchdog_no_window")
            except Exception as error:
                _automation_log("browser_watchdog_error", error=str(error))
        with _WATCHDOG_LOCK:
            _WATCHDOG_STARTED = False
        _automation_log("browser_watchdog_stopped")

    threading.Thread(target=run, daemon=True).start()


def _remove_stale_browser_locks():
    if _browser_is_running():
        return
    for lock_file in CHROMIUM_PROFILE.glob("Singleton*"):
        try:
            lock_file.unlink()
        except FileNotFoundError:
            pass
        except OSError:
            pass


def _has_browser_session():
    session_paths = (
        CHROMIUM_PROFILE / "Default/Current Session",
        CHROMIUM_PROFILE / "Default/Current Tabs",
        CHROMIUM_PROFILE / "Default/Last Session",
        CHROMIUM_PROFILE / "Default/Last Tabs",
        CHROMIUM_PROFILE / "Default/Sessions",
    )
    return any(path.exists() for path in session_paths)


def _write_json(path, data):
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    tmp_path.replace(path)


def _set_nested(data, keys, value):
    cursor = data
    for key in keys[:-1]:
        child = cursor.get(key)
        if not isinstance(child, dict):
            child = {}
            cursor[key] = child
        cursor = child
    cursor[keys[-1]] = value


def _configure_bookmarks(default_url):
    path = CHROMIUM_PROFILE / "Default/Bookmarks"
    bookmarks = {
        "checksum": "",
        "roots": {
            "bookmark_bar": {
                "children": [
                    {
                        "date_added": "0",
                        "guid": "00000000-0000-4000-8000-000000000001",
                        "id": "1",
                        "name": "Google",
                        "type": "url",
                        "url": default_url,
                    }
                ],
                "date_added": "0",
                "date_modified": "0",
                "guid": "00000000-0000-4000-8000-000000000002",
                "id": "2",
                "name": "Bookmarks bar",
                "type": "folder",
            },
            "other": {
                "children": [],
                "date_added": "0",
                "date_modified": "0",
                "guid": "00000000-0000-4000-8000-000000000003",
                "id": "3",
                "name": "Other bookmarks",
                "type": "folder",
            },
            "synced": {
                "children": [],
                "date_added": "0",
                "date_modified": "0",
                "guid": "00000000-0000-4000-8000-000000000004",
                "id": "4",
                "name": "Mobile bookmarks",
                "type": "folder",
            },
        },
        "version": 1,
    }
    _write_json(path, bookmarks)


def _mark_chromium_clean_shutdown():
    default_url = os.environ.get("WORKSPACE_DEFAULT_URL", "https://www.google.com")
    _configure_bookmarks(default_url)
    for path in (CHROMIUM_PROFILE / "Default/Preferences", CHROMIUM_PROFILE / "Local State"):
        try:
            data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
            if not isinstance(data, dict):
                data = {}
            if path.name == "Preferences":
                _set_nested(data, ["homepage"], default_url)
                _set_nested(data, ["homepage_is_newtabpage"], False)
                _set_nested(data, ["browser", "custom_chrome_frame"], False)
                _set_nested(data, ["browser", "show_home_button"], True)
                _set_nested(data, ["session", "startup_urls"], [default_url])
                _set_nested(data, ["default_search_provider", "enabled"], True)
                _set_nested(data, ["default_search_provider", "name"], "Google")
                _set_nested(data, ["default_search_provider", "keyword"], "google.com")
                _set_nested(data, ["default_search_provider", "search_url"], "https://www.google.com/search?q={searchTerms}")
                _set_nested(data, ["intl", "accept_languages"], "fr-FR,fr,en-US,en")
                _set_nested(data, ["translate", "enabled"], False)
                _set_nested(data, ["translate_site_blacklist"], ["en", "fr"])
            _set_nested(data, ["profile", "exit_type"], "Normal")
            _set_nested(data, ["profile", "exited_cleanly"], True)
            _set_nested(data, ["profile", "should_restore_old_session"], True)
            _set_nested(data, ["session", "restore_on_startup"], 1)
            _write_json(path, data)
            _automation_log("chromium_profile_marked_clean", path=str(path))
        except Exception as error:
            _automation_log("chromium_profile_mark_clean_failed", path=str(path), error=str(error))


def _xdotool(args):
    subprocess.run(_desktop_command(["xdotool", *args]), check=True, timeout=10)


def open_browser(url=None):
    global _LAST_BROWSER_URL
    requested_url = str(url).strip() if url else None
    default_url = os.environ.get("WORKSPACE_DEFAULT_URL", "https://www.google.com")
    _LAST_BROWSER_URL = requested_url or default_url
    _automation_log("open_browser:start", url=requested_url)
    _ensure_browser_profile_ready()
    _seed_conversation_profile_if_needed()
    _remove_stale_browser_locks()
    has_existing_session = _has_browser_session()
    _mark_chromium_clean_shutdown()
    launch_url = requested_url or (None if has_existing_session else default_url)
    _automation_log("open_browser:launch", launch_url=launch_url or "restore_session", has_existing_session=has_existing_session)
    _wait_for_desktop_ready()
    _launch_chromium(launch_url)
    _start_browser_watchdog()
    time.sleep(1.5)
    try:
        _close_terminal_windows()
        _normalize_browser_windows()
    except Exception as error:
        _automation_log("open_browser_normalize_failed", error=str(error))
    snapshot = build_snapshot()
    _automation_log(
        "open_browser:done",
        ok=snapshot.get("ok"),
        snapshot_id=snapshot.get("snapshot_id"),
        refs=len(snapshot.get("refs", [])),
    )
    return snapshot


def shutdown_browser():
    _automation_log("shutdown_browser:start")
    _WATCHDOG_STOP_EVENT.set()
    ids = _chromium_window_ids()
    for window_id in ids:
        _run_desktop(["xdotool", "windowactivate", window_id], timeout=2, check=False)
        _run_desktop(["xdotool", "key", "ctrl+shift+q"], timeout=2, check=False)
    deadline = time.time() + 8
    while time.time() < deadline and _browser_is_running():
        time.sleep(0.5)
    if _browser_is_running():
        _run_desktop(["pkill", "-TERM", "-u", "abc", "-f", "chromium"], timeout=3, check=False)
        deadline = time.time() + 5
        while time.time() < deadline and _browser_is_running():
            time.sleep(0.5)
    if _browser_is_running():
        _automation_log("shutdown_browser:force_kill")
        _run_desktop(["pkill", "-KILL", "-u", "abc", "-f", "chromium"], timeout=3, check=False)
        time.sleep(0.5)
    synced = _sync_user_profile_from_conversation()
    _automation_log("shutdown_browser:done", running=_browser_is_running(), synced=synced)
    return {"ok": True, "browser_running": _browser_is_running(), "synced": synced}


def click(snapshot_id, ref):
    _automation_log("click", snapshot_id=snapshot_id, ref=ref)
    node = STORE.get(snapshot_id, ref)
    bounds = node.get("bounds")
    if bounds:
        x, y = _center(bounds)
        _xdotool(["mousemove", str(x), str(y), "click", "1"])
    elif not _perform_atspi_action(node, ["click", "press", "open", "activate", "doDefault"]):
        raise ValueError("Target element has no bounds and no executable AT-SPI action.")
    time.sleep(0.25)
    return build_snapshot()


def fill(snapshot_id, ref, text, mode="replace"):
    _automation_log("fill", snapshot_id=snapshot_id, ref=ref, mode=mode, text_length=len(str(text)))
    node = STORE.get(snapshot_id, ref)
    bounds = node.get("bounds")
    if bounds:
        x, y = _center(bounds)
        _xdotool(["mousemove", str(x), str(y), "click", "1"])
    elif not _perform_atspi_action(node, ["activate", "click", "press", "doDefault"]):
        raise ValueError("Target element has no bounds and cannot be focused through AT-SPI.")
    if mode == "replace":
        _xdotool(["key", "ctrl+a"])
    _xdotool(["type", "--delay", "1", str(text)])
    time.sleep(0.25)
    return build_snapshot()


def press(keys):
    _automation_log("press", keys=keys)
    if keys not in KEYS:
        raise ValueError(f"Key not allowed: {keys}")
    for key in KEYS[keys]:
        _xdotool(["key", key])
    time.sleep(0.2)
    return build_snapshot()


def scroll(direction, amount="small"):
    _automation_log("scroll", direction=direction, amount=amount)
    clicks = 3 if amount == "small" else 8
    button = "5" if direction == "down" else "4"
    for _ in range(clicks):
        _xdotool(["click", button])
    time.sleep(0.25)
    return build_snapshot()
