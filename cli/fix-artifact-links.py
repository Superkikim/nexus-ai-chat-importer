#!/usr/bin/env python3
"""
Update artifact wikilinks in conversation files to match renamed artifact paths.

Builds a map of old artifact paths → new paths by reading frontmatter from
all migrated artifact files, then updates links in conversation markdown files.

Usage: python3 fix-artifact-links.py /path/to/vault [--dry-run]
"""

import os
import re
import sys


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


def extract_second_alias(aliases_str):
    """Extract the second alias (old filename stem) from aliases field."""
    content = aliases_str.strip().strip("[]")
    parts = [p.strip().strip("'\"").strip() for p in content.split(",")]
    return parts[1] if len(parts) > 1 else ""


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} /path/to/vault [--dry-run]")
        sys.exit(1)

    vault = sys.argv[1]
    dry_run = "--dry-run" in sys.argv

    artifacts_dir = os.path.join(vault, "AI", "Attachments", "claude", "artifacts")
    conversations_dir = os.path.join(vault, "AI", "Conversations", "claude")

    # Build map: old wikilink path (without .md) → new wikilink path (without .md)
    # Old format: AI/Attachments/claude/artifacts/<uuid>/<old_filename_stem>
    # New format: AI/Attachments/claude/artifacts/<date - title>/<new_filename_stem>
    link_map = {}

    print("Building artifact path map...")
    for folder_name in sorted(os.listdir(artifacts_dir)):
        folder = os.path.join(artifacts_dir, folder_name)
        if not os.path.isdir(folder):
            continue

        for fname in os.listdir(folder):
            if not fname.endswith(".md"):
                continue

            fpath = os.path.join(folder, fname)
            fm = parse_frontmatter(fpath)

            conv_id = fm.get("conversation_id", "")
            aliases = fm.get("aliases", "")
            if not conv_id or not aliases:
                continue

            # The second alias is the old filename stem (e.g. "casey-gollan-website_v1")
            old_stem = extract_second_alias(aliases)
            if not old_stem:
                continue

            new_stem = fname[:-3]  # remove .md

            # Old link path
            old_link = f"AI/Attachments/claude/artifacts/{conv_id}/{old_stem}"
            # New link path
            new_link = f"AI/Attachments/claude/artifacts/{folder_name}/{new_stem}"

            if old_link != new_link:
                link_map[old_link] = new_link

    print(f"Found {len(link_map)} path mappings")

    # Now scan all conversation files and replace links
    updated_files = 0
    updated_links = 0

    for root, _, files in os.walk(conversations_dir):
        for fname in files:
            if not fname.endswith(".md"):
                continue

            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception:
                continue

            if "artifacts/" not in content:
                continue

            new_content = content
            file_changes = 0

            for old_path, new_path in link_map.items():
                if old_path in new_content:
                    new_content = new_content.replace(old_path, new_path)
                    file_changes += new_content.count(new_path) - content.count(new_path)

            # Also update 🎨 [[ to ![[ while we're at it
            if "🎨 [[" in new_content:
                count = new_content.count("🎨 [[")
                new_content = new_content.replace("🎨 [[", "![[")
                file_changes += count

            if new_content != content:
                if dry_run:
                    print(f"  UPDATE: {os.path.relpath(fpath, vault)} ({file_changes} changes)")
                else:
                    with open(fpath, "w", encoding="utf-8") as f:
                        f.write(new_content)
                    print(f"  UPDATED: {os.path.relpath(fpath, vault)}")
                updated_files += 1
                updated_links += file_changes

    # Also check artifact files themselves (they link back to conversations, and to each other)
    for folder_name in sorted(os.listdir(artifacts_dir)):
        folder = os.path.join(artifacts_dir, folder_name)
        if not os.path.isdir(folder):
            continue
        for fname in os.listdir(folder):
            if not fname.endswith(".md"):
                continue
            fpath = os.path.join(folder, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception:
                continue

            if "artifacts/" not in content:
                continue

            new_content = content
            for old_path, new_path in link_map.items():
                if old_path in new_content:
                    new_content = new_content.replace(old_path, new_path)

            if new_content != content:
                if dry_run:
                    print(f"  UPDATE (artifact): {folder_name}/{fname}")
                else:
                    with open(fpath, "w", encoding="utf-8") as f:
                        f.write(new_content)
                updated_files += 1

    print()
    print("--- Link Update Summary ---")
    print(f"Files updated:  {updated_files}")
    print(f"Links changed:  {updated_links}")
    if dry_run:
        print("(dry run — no changes made)")


if __name__ == "__main__":
    main()
