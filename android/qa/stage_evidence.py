"""Copy only bounded, named synthetic QA evidence. Never upload Gradle binary internals."""
from pathlib import Path
import shutil
import xml.etree.ElementTree as ET

CAP = 25 * 1024 * 1024
NAMES = ("loopback-resume.png", "loopback-solved.png", "loopback-exhausted.png", "crash.txt", "package-uid.txt")

def stage(root, destination):
    root, destination = Path(root), Path(destination)
    if root.is_symlink():
        raise ValueError("symlink checkout root forbidden")
    # Ancestors ABOVE the checkout are host layout, not selected evidence.
    # Inspect only the checkout root and descendants, without resolving away links.
    root = root.absolute()
    if destination.exists():
        raise ValueError("evidence destination must be new")
    selected = []
    for name in NAMES:
        source = root / "loopback-evidence" / name
        if source.exists():
            selected.append((source, Path(name)))
    for folder, label in (("android/app/build/test-results/testQaUnitTest", "unit"),
                          ("android/app/build/outputs/androidTest-results/connected", "instrumentation")):
        base = root / folder
        for source in sorted(base.rglob("TEST-*.xml")) if base.exists() else []:
            selected.append((source, Path(label) / source.relative_to(base)))
    if not selected:
        raise ValueError("missing evidence")
    total = 0
    for source, relative in selected:
        if source.is_symlink() or any(p.is_symlink() for p in source.parents if p == root or root in p.parents):
            raise ValueError("symlink evidence forbidden")
        if not source.is_file() or relative.suffix not in (".png", ".txt", ".xml"):
            raise ValueError("unexpected evidence type")
        total += source.stat().st_size
        if total > CAP:
            raise ValueError("evidence exceeds 25MiB cap")
        if relative.suffix == ".xml":
            ET.parse(source)
    destination.mkdir()
    for source, relative in selected:
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    print("Bounded synthetic evidence bytes:", total)
    return [str(p) for p in destination.rglob("*") if p.is_file()]

if __name__ == "__main__":
    stage(Path.cwd(), Path.cwd() / "bounded-loopback-evidence")
