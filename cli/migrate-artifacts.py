#!/usr/bin/env python3
"""
Migrate existing Claude artifact folders/files to human-readable names with date prefixes.

Reads frontmatter from each artifact .md file to determine:
  - conversation_id → looks up conversation title from vault
  - create_time → date prefix for the artifact file
  - aliases[0] → human-readable artifact title
  - version_number → appended as "v{n}" only if > 1

Usage: python3 migrate-artifacts.py /path/to/vault [--dry-run]
"""

import os
import re
import sys
import shutil
from pathlib import Path


def parse_frontmatter(filepath):
    """Extract frontmatter key-value pairs from a markdown file."""
    fm = {}
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except Exception:
        return fm

    in_fm = False
    for line in lines:
        stripped = line.rstrip("\n")
        if stripped == "---":
            if in_fm:
                break
            in_fm = True
            continue
        if not in_fm:
            continue
        m = re.match(r"^(\w+):\s*(.+)$", stripped)
        if m:
            fm[m.group(1)] = m.group(2)
    return fm


def extract_first_alias(aliases_str):
    """Extract the first alias from a frontmatter aliases field."""
    # Remove brackets
    content = aliases_str.strip()
    if content.startswith("["):
        content = content[1:]
    if content.endswith("]"):
        content = content[:-1]

    # Split on comma, take first
    first = content.split(",")[0].strip()
    # Remove surrounding quotes
    first = first.strip("'\"").strip()
    return first


def sanitize(name):
    """Sanitize for filesystem. Allow spaces, remove dangerous chars."""
    result = re.sub(r'[/\\:*?"<>|#^\[\].\'\"''""]', "_", name)
    result = re.sub(r"\s+", " ", result).strip()
    return result


def date_prefix(iso_str):
    """Extract YYYY-MM-DD from an ISO timestamp string."""
    if not iso_str:
        return ""
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})T", iso_str)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    return ""


def build_conversation_index(conversations_dir):
    """Build maps of conversation_id → title and conversation_id → create_time."""
    titles = {}
    dates = {}

    if not os.path.isdir(conversations_dir):
        return titles, dates

    for root, dirs, files in os.walk(conversations_dir):
        for fname in files:
            if not fname.endswith(".md"):
                continue
            fpath = os.path.join(root, fname)
            fm = parse_frontmatter(fpath)
            cid = fm.get("conversation_id", "")
            aliases = fm.get("aliases", "")
            ctime = fm.get("create_time", "")
            if cid and aliases:
                titles[cid] = aliases
                dates[cid] = ctime

    return titles, dates


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} /path/to/vault [--dry-run]")
        sys.exit(1)

    vault = sys.argv[1]
    dry_run = "--dry-run" in sys.argv

    artifacts_dir = os.path.join(vault, "AI", "Attachments", "claude", "artifacts")
    conversations_dir = os.path.join(vault, "AI", "Conversations", "claude")

    if not os.path.isdir(artifacts_dir):
        print(f"Error: Artifacts directory not found: {artifacts_dir}")
        sys.exit(1)

    print("Building conversation index...")
    conv_titles, conv_dates = build_conversation_index(conversations_dir)
    print(f"Found {len(conv_titles)} conversations")

    moved = 0
    skipped = 0
    file_renames = 0

    uuid_re = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
    date_prefix_re = re.compile(r"^\d{4}-\d{2}-\d{2} - ")

    for entry in sorted(os.listdir(artifacts_dir)):
        folder = os.path.join(artifacts_dir, entry)
        if not os.path.isdir(folder):
            continue

        # Skip already-migrated folders
        if date_prefix_re.match(entry):
            continue

        # Only process UUID-named folders
        if not uuid_re.match(entry):
            continue

        conv_id = entry
        conv_title = conv_titles.get(conv_id, "")
        conv_date = conv_dates.get(conv_id, "")

        if not conv_title:
            print(f"  WARN: No conversation found for {conv_id}, skipping")
            skipped += 1
            continue

        # Build new folder name
        safe_title = sanitize(conv_title)
        cdp = date_prefix(conv_date)
        new_foldername = f"{cdp} - {safe_title}" if cdp else safe_title
        new_folder = os.path.join(artifacts_dir, new_foldername)

        # Rename individual artifact files
        for art_fname in sorted(os.listdir(folder)):
            if not art_fname.endswith(".md"):
                continue
            art_path = os.path.join(folder, art_fname)
            fm = parse_frontmatter(art_path)

            aliases = fm.get("aliases", "")
            art_title = extract_first_alias(aliases) if aliases else ""
            art_version = fm.get("version_number", "1")
            art_time = fm.get("create_time", "")

            if not art_title:
                print(f"  WARN: No title in {art_path}, skipping file")
                skipped += 1
                continue

            safe_art = sanitize(art_title)
            adp = date_prefix(art_time)

            new_name = safe_art
            try:
                if int(art_version) > 1:
                    new_name = f"{new_name} v{art_version}"
            except ValueError:
                pass
            if adp:
                new_name = f"{adp} - {new_name}"
            new_name = f"{new_name}.md"

            if art_fname != new_name:
                if dry_run:
                    print(f"  RENAME: {art_fname} → {new_name}")
                else:
                    os.rename(art_path, os.path.join(folder, new_name))
                file_renames += 1

        # Move/rename the folder
        if folder != new_folder:
            if dry_run:
                print(f"FOLDER: {entry} → {new_foldername}")
            else:
                if os.path.isdir(new_folder):
                    # Merge into existing
                    for f in os.listdir(folder):
                        src = os.path.join(folder, f)
                        dst = os.path.join(new_folder, f)
                        if not os.path.exists(dst):
                            shutil.move(src, dst)
                    try:
                        os.rmdir(folder)
                    except OSError:
                        pass
                    print(f"  MERGED: {entry} → {new_foldername}")
                else:
                    os.rename(folder, new_folder)
                    print(f"  MOVED: {entry} → {new_foldername}")
            moved += 1

    print()
    print("--- Migration Summary ---")
    print(f"Folders moved:  {moved}")
    print(f"Files renamed:  {file_renames}")
    print(f"Skipped:        {skipped}")
    if dry_run:
        print("(dry run — no changes made)")


if __name__ == "__main__":
    main()
