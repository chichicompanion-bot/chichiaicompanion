import subprocess
import sys
from pathlib import Path

from watchfiles import watch


ROOT = Path(__file__).resolve().parent
BOT_FILE = ROOT / "bot.py"
def start_bot() -> subprocess.Popen:
    print("[dev-runner] starting bot.py")
    kwargs = {"cwd": ROOT}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    return subprocess.Popen([sys.executable, str(BOT_FILE)], **kwargs)


def stop_bot(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return

    print("[dev-runner] stopping current bot process")
    if sys.platform == "win32":
        try:
            process.send_signal(subprocess.CTRL_BREAK_EVENT)
        except Exception:
            process.terminate()
    else:
        process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def should_restart(changes: set[tuple[int, str]]) -> bool:
    for _, changed_path in changes:
        path = Path(changed_path)
        if path.name == ".env" or path.suffix == ".py":
            return True
    return False


def main() -> int:
    process = start_bot()
    try:
        for changes in watch(ROOT, recursive=True):
            if not should_restart(changes):
                continue

            changed_files = ", ".join(sorted({Path(path).name for _, path in changes}))
            print(f"[dev-runner] detected changes: {changed_files}")
            stop_bot(process)
            process = start_bot()
    except KeyboardInterrupt:
        print("[dev-runner] received Ctrl+C, shutting down")
    finally:
        stop_bot(process)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
