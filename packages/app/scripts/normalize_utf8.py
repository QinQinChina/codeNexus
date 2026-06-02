from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path


SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "dist.__tmp__",
    "build",
    "release",
}

SKIP_SUFFIXES = {
    # images / media
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".icns",
    ".mp3",
    ".wav",
    ".ogg",
    # archives / binaries
    ".zip",
    ".7z",
    ".pdf",
    ".exe",
    ".dll",
    ".bin",
    # fonts
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
}

# 常见“显示乱码”特征（多为曾经被错误解码后再保存，通常不可逆）。
SUSPECT_MOJIBAKE = [
    "锟斤拷",
    "\ufffd",  # replacement char
    "Ã",
    "Â",
    "â€™",
    "â€œ",
    "â€",
    "ï»¿",
]


@dataclass(frozen=True)
class ScanResult:
    path: Path
    issue: str
    detail: str | None = None


def looks_binary(data: bytes) -> bool:
    if not data:
        return False
    # NUL byte is a strong signal
    if b"\x00" in data[:4096]:
        return True
    # Too many control characters (heuristic)
    sample = data[:4096]
    ctrl = sum(1 for b in sample if b < 9 or (13 < b < 32))
    return (ctrl / len(sample)) > 0.05


def iter_candidate_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for p in root.rglob("*"):
        if p.is_dir():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.suffix.lower() in SKIP_SUFFIXES:
            continue
        files.append(p)
    return files


def decode_best_effort(data: bytes) -> tuple[str | None, str | None]:
    """
    Return (text, encoding_used) or (None, None) if can't be decoded as text reliably.
    """
    if data.startswith(b"\xff\xfe") or data.startswith(b"\xfe\xff"):
        try:
            return (data.decode("utf-16"), "utf-16")
        except UnicodeDecodeError:
            return (None, None)

    # Prefer strict UTF-8 (w/ or w/o BOM)
    if data.startswith(b"\xef\xbb\xbf"):
        try:
            return (data[3:].decode("utf-8"), "utf-8-bom")
        except UnicodeDecodeError:
            return (None, None)

    try:
        return (data.decode("utf-8"), "utf-8")
    except UnicodeDecodeError:
        pass

    # Common Windows Chinese encodings; gb18030 is a superset of gbk/cp936
    try:
        return (data.decode("gb18030"), "gb18030")
    except UnicodeDecodeError:
        return (None, None)


def normalize_to_utf8_no_bom(text: str) -> bytes:
    return text.encode("utf-8")


def scan_one(path: Path) -> tuple[list[ScanResult], bytes | None]:
    data = path.read_bytes()

    if looks_binary(data):
        return ([], None)

    issues: list[ScanResult] = []

    text, enc = decode_best_effort(data)
    if text is None or enc is None:
        issues.append(ScanResult(path=path, issue="non_text_or_unknown_encoding"))
        return (issues, None)

    if enc == "utf-8-bom":
        issues.append(ScanResult(path=path, issue="utf8_bom"))

    if enc == "utf-16":
        issues.append(ScanResult(path=path, issue="utf16_bom"))

    if enc == "gb18030":
        issues.append(ScanResult(path=path, issue="non_utf8", detail=enc))

    # 本脚本内会包含检测用 token，避免自触发。
    if path.name != "normalize_utf8.py" and any(token in text for token in SUSPECT_MOJIBAKE):
        issues.append(ScanResult(path=path, issue="suspect_mojibake"))

    normalized = normalize_to_utf8_no_bom(text)
    if normalized != data:
        return (issues, normalized)
    return (issues, None)


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="normalize_utf8.py",
        description="扫描并修复项目中文本文件编码：统一为 UTF-8（无 BOM）。",
    )
    parser.add_argument(
        "--root",
        default=".",
        help="扫描根目录（默认：当前目录）。",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--check",
        action="store_true",
        help="仅检查，不写入文件；若发现问题以非 0 退出。",
    )
    group.add_argument(
        "--fix",
        action="store_true",
        help="自动修复：移除 UTF-8 BOM、将 GB18030/UTF-16 转为 UTF-8（无 BOM）。",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=0,
        help="限制扫描文件数（0 表示不限制）。",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    paths = iter_candidate_files(root)
    if args.max_files and args.max_files > 0:
        paths = paths[: args.max_files]

    all_issues: list[ScanResult] = []
    changed: list[Path] = []

    for p in paths:
        issues, normalized = scan_one(p)
        all_issues.extend(issues)
        if normalized is not None:
            if args.fix:
                p.write_bytes(normalized)
                changed.append(p)
            else:
                # In check-mode, treat as an issue as well (needs normalization)
                all_issues.append(ScanResult(path=p, issue="needs_normalize"))

    # 输出报告（稳定、可 grep）
    if all_issues:
        for it in all_issues:
            suffix = f" ({it.detail})" if it.detail else ""
            print(f"[issue] {it.issue}{suffix}: {it.path.as_posix()}")
    if changed:
        for p in changed:
            print(f"[fixed] {p.as_posix()}")

    if args.fix:
        return 0

    # 默认行为：未指定 --fix 时按检查处理（方便 CI/本地自检）
    return 1 if all_issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
