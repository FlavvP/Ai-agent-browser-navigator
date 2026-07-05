import re

import gi
from store import STORE
from accessibility import read_accessibility_tree

gi.require_version("Atspi", "2.0")
from gi.repository import Atspi  # noqa: E402


INVISIBLE_CHARS = [
    "\ufeff",
    "\u200b",
    "\u200c",
    "\u200d",
    "\u2060",
    "\u00a0",
    "\ufffc",
]

ROLE_ALIASES = {
    "push button": "button",
    "entry": "textbox",
    "password text": "textbox",
    "check box": "checkbox",
    "radio button": "radio",
    "combo box": "combobox",
    "page tab": "tab",
    "page tab list": "tablist",
    "menu item": "menuitem",
    "toggle button": "button",
    "document web": "document",
    "document frame": "document",
    "desktop frame": "desktop",
    "internal frame": "frame",
    "tool bar": "toolbar",
    "menu bar": "menubar",
    "table cell": "cell",
    "list item": "listitem",
    "landmark": "region",
}

INTERACTIVE_ROLES = {
    "button",
    "link",
    "textbox",
    "checkbox",
    "radio",
    "combobox",
    "listbox",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "option",
    "searchbox",
    "slider",
    "spinbutton",
    "switch",
    "tab",
    "treeitem",
    "image",
}

CONTENT_ROLES = {
    "heading",
    "cell",
    "gridcell",
    "columnheader",
    "rowheader",
    "listitem",
    "article",
    "region",
    "main",
    "navigation",
    "paragraph",
    "label",
    "caption",
    "text",
    "static",
    "header",
    "footer",
    "notification",
    "video",
    "document",
    "dialog",
    "list",
}

STRUCTURAL_ROLES = {
    "application",
    "desktop",
    "frame",
    "panel",
    "section",
    "group",
    "toolbar",
    "tablist",
    "menubar",
    "menu",
    "separator",
    "scrollbar",
    "unknown",
}

IMPORTANT_STATES = {
    "active",
    "checked",
    "collapsed",
    "editable",
    "expanded",
    "focusable",
    "focused",
    "has-popup",
    "pressed",
    "required",
    "selected",
    "single-line",
    "supports-autocompletion",
}

IGNORED_STATES = {
    "enabled",
    "sensitive",
    "showing",
    "visible",
    "selectable-text",
}

MAX_REFS = {"compact": 140, "expanded": 320}
MAX_NODES = {"compact": 6000, "expanded": 14000}
MAX_ROOT_SEARCH_NODES = 6000
MAX_DEPTH = {"compact": 16, "expanded": 24}
MAX_CHILDREN_PER_NODE = {"compact": 80, "expanded": 120}
ACCERCISER_MAX_LINES = 1200
ACCERCISER_MAX_CHARS = 90000

STATE_BY_VALUE = {value: enum.value_nick for value, enum in Atspi.StateType.__enum_values__.items()}


def _clean(value, limit=260):
    text = str(value or "")
    for char in INVISIBLE_CHARS:
        text = text.replace(char, " ")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > limit:
        return text[: limit - 1] + "..."
    return text


def _normalize_role(role):
    role = _clean(role, 80).lower()
    return ROLE_ALIASES.get(role, role)


def _safe_get(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def _role_of(node):
    return _normalize_role(_safe_get(lambda: node.roleName, "")) or "unknown"


def _name_of(node):
    return _clean(_safe_get(lambda: node.name, ""), 260)


def _text_of(node):
    try:
        text = node.queryText()
        return _clean(text.getText(0, min(text.characterCount, 500)), 500)
    except Exception:
        return ""


def _value_of(node):
    try:
        value = node.queryValue()
        return _clean(value.currentValue, 160)
    except Exception:
        return ""


def _description_of(node):
    return _clean(_safe_get(lambda: node.description, ""), 260)


def _states_of(node):
    state_set = _safe_get(lambda: node.getState(), None)
    if not state_set:
        return []

    states = []
    for value, label in STATE_BY_VALUE.items():
        if label in IGNORED_STATES:
            continue
        try:
            if state_set.contains(value) and label in IMPORTANT_STATES:
                states.append(label)
        except Exception:
            pass
    return states[:12]


def _actions_of(node):
    actions = []
    try:
        action = node.queryAction()
        for index in range(action.nActions):
            action_name = _clean(action.getName(index), 80)
            if action_name and action_name not in actions:
                actions.append(action_name)
    except Exception:
        pass
    return actions[:8]


def _bounds_of(node):
    try:
        component = node.queryComponent()
        x, y = component.getPosition(0)
        width, height = component.getSize()
        if width > 0 and height > 0:
            return {"x": int(x), "y": int(y), "width": int(width), "height": int(height)}
    except Exception:
        pass
    return None


def _children_of(node, mode):
    children = _safe_get(lambda: list(node.children), []) or []
    return children[: MAX_CHILDREN_PER_NODE[mode]]


def _has_meaningful_text(descriptor):
    return bool(
        descriptor.get("name")
        or descriptor.get("text")
        or descriptor.get("description")
        or descriptor.get("value")
    )


def _is_actionable(descriptor):
    states = set(descriptor.get("states", []))
    role = descriptor.get("role")
    actions = set(descriptor.get("actions", []))
    useful_actions = actions - {"showContextMenu", "doDefault"}
    if role in INTERACTIVE_ROLES:
        return True
    if role in STRUCTURAL_ROLES or role in CONTENT_ROLES:
        return False
    return bool(useful_actions and _has_meaningful_text(descriptor)) or bool(states & {"editable", "focused"})


def _should_ref(descriptor, mode):
    if _is_actionable(descriptor):
        return True
    if mode == "expanded" and descriptor.get("role") in CONTENT_ROLES and _has_meaningful_text(descriptor):
        return True
    return False


def _dedupe_key(descriptor):
    bounds = descriptor.get("bounds") or {}
    bucket = (
        int(bounds.get("x", 0) / 40),
        int(bounds.get("y", 0) / 40),
        int(bounds.get("width", 0) / 40),
        int(bounds.get("height", 0) / 40),
    )
    return (
        descriptor.get("role", ""),
        str(descriptor.get("name", "")).lower(),
        str(descriptor.get("text", "")).lower(),
        str(descriptor.get("value", "")).lower(),
        bucket,
    )


def _expand_key(descriptor, depth):
    bounds = descriptor.get("bounds") or {}
    return (
        descriptor.get("role", ""),
        str(descriptor.get("name", "")).lower(),
        int(bounds.get("x", 0) / 20),
        int(bounds.get("y", 0) / 20),
        int(bounds.get("width", 0) / 20),
        int(bounds.get("height", 0) / 20),
        min(depth, 10),
    )


def _should_expand(descriptor, depth, expanded_counts):
    return True


def _child_priority(node):
    role = _role_of(node)
    name = _name_of(node).lower()
    if role == "document":
        return 0
    if "web" in role or "document" in name:
        return 1
    if role in {"main", "navigation", "article", "region"}:
        return 2
    if role in INTERACTIVE_ROLES:
        return 3
    if role in CONTENT_ROLES:
        return 4
    if role in {"panel", "frame", "section", "group"}:
        return 5
    return 6


def _ordered_children(node, mode):
    children = _children_of(node, mode)
    return sorted(children, key=_child_priority)


def _find_document_roots(root, mode):
    documents = []
    traversed = 0
    stack = [(root, 0)]

    while stack:
        node, depth = stack.pop()
        traversed += 1
        if traversed > MAX_ROOT_SEARCH_NODES or depth > MAX_DEPTH[mode]:
            continue

        descriptor = _base_descriptor_for(node)
        if descriptor.get("role") == "document" and _has_meaningful_text(descriptor):
            documents.append((node, descriptor))

        for child in reversed(_ordered_children(node, mode)):
            stack.append((child, depth + 1))

    def score(item):
        _, descriptor = item
        states = set(descriptor.get("states", []))
        name = str(descriptor.get("name", "")).lower()
        return (
            10 if "focused" in states else 0,
            6 if "active" in states else 0,
            4 if name and name not in {"untitled", "new tab"} else 0,
            len(name),
        )

    documents.sort(key=score, reverse=True)
    return [node for node, _ in documents[:2]]


def _base_descriptor_for(node):
    descriptor = {
        "_node": node,
        "role": _role_of(node),
        "name": _name_of(node),
        "states": _states_of(node),
    }
    return {key: value for key, value in descriptor.items() if value not in ("", None, [], {})}


def _needs_full_descriptor(descriptor):
    role = descriptor.get("role")
    states = set(descriptor.get("states", []))
    return bool(
        descriptor.get("name")
        or role in INTERACTIVE_ROLES
        or role in CONTENT_ROLES
        or role not in STRUCTURAL_ROLES
        or states & {"editable", "focused"}
    )


def _full_descriptor_for(node, base_descriptor=None):
    descriptor = {
        "_node": node,
        "role": _role_of(node),
        "name": _name_of(node),
        "text": _text_of(node),
        "description": _description_of(node),
        "value": _value_of(node),
        "states": _states_of(node),
        "actions": _actions_of(node),
        "bounds": _bounds_of(node),
    }
    if base_descriptor:
        descriptor.update(base_descriptor)
    return {key: value for key, value in descriptor.items() if value not in ("", None, [], {})}


def _descriptor_for(node):
    base = _base_descriptor_for(node)
    if not _needs_full_descriptor(base):
        return base
    return _full_descriptor_for(node, base)


def _llm_ref(ref, descriptor):
    result = {"ref": ref}
    for key in ("role", "name", "text", "description", "value", "states"):
        value = descriptor.get(key)
        if value not in ("", None, [], {}):
            result[key] = value
    return result


def _walk_dogtail(root, mode):
    refs = {}
    llm_refs = []
    seen = set()
    expanded_counts = {}
    warning = None
    traversed = 0
    roots = _find_document_roots(root, mode)
    if roots:
        stack = [(node, 0) for node in reversed(roots)]
    else:
        stack = [(root, 0)]
        warning = "No document subtree found; fallback to full accessibility tree."

    while stack:
        node, depth = stack.pop()
        traversed += 1
        if traversed > MAX_NODES[mode]:
            warning = f"Snapshot truncated at {MAX_NODES[mode]} traversed nodes."
            break
        if depth > MAX_DEPTH[mode]:
            continue

        descriptor = _descriptor_for(node)
        if _should_ref(descriptor, mode):
            key = _dedupe_key(descriptor)
            if key not in seen:
                seen.add(key)
                ref = f"@e{len(refs) + 1}"
                refs[ref] = descriptor
                llm_refs.append(_llm_ref(ref, descriptor))
                if len(refs) >= MAX_REFS[mode]:
                    warning = f"Refs truncated at {MAX_REFS[mode]}."
                    break

        if not _should_expand(descriptor, depth, expanded_counts):
            continue

        for child in reversed(_ordered_children(node, mode)):
            stack.append((child, depth + 1))

    return refs, llm_refs, warning


def _descriptor_from_raw_node(node):
    descriptor = {
        "role": _normalize_role(node.get("role", "")),
        "name": _clean(node.get("name", ""), 260),
        "text": _clean(node.get("text", ""), 500),
        "description": _clean(node.get("description", ""), 260),
        "value": _clean(node.get("value", ""), 160),
        "states": [
            _clean(state, 80)
            for state in (node.get("states") or [])
            if _clean(state, 80) and _clean(state, 80) not in IGNORED_STATES
        ],
        "actions": [_clean(action, 80) for action in (node.get("actions") or []) if _clean(action, 80)],
        "bounds": node.get("bounds"),
        "raw_id": node.get("id"),
        "depth": node.get("depth"),
    }
    return {key: value for key, value in descriptor.items() if value not in ("", None, [], {})}


def _document_prefixes(nodes):
    documents = []
    for node in nodes:
        descriptor = _descriptor_from_raw_node(node)
        if descriptor.get("role") != "document" or not _has_meaningful_text(descriptor):
            continue
        states = set(descriptor.get("states", []))
        name = str(descriptor.get("name", "")).lower()
        score = (
            10 if "focused" in states else 0,
            6 if "active" in states else 0,
            4 if name and name not in {"untitled", "new tab"} else 0,
            len(name),
        )
        documents.append((score, str(node.get("id", ""))))
    documents.sort(reverse=True)
    return [prefix for _, prefix in documents[:2] if prefix]


def _is_under_prefix(node_id, prefixes):
    return any(node_id == prefix or node_id.startswith(prefix + "/") for prefix in prefixes)


def _walk_raw_tree(tree, mode):
    nodes = tree.get("nodes", []) if isinstance(tree, dict) else []
    prefixes = _document_prefixes(nodes)
    selected_nodes = [
        node
        for node in nodes
        if not prefixes or _is_under_prefix(str(node.get("id", "")), prefixes)
    ]

    refs = {}
    llm_refs = []
    seen = set()
    warning = None

    for node in selected_nodes[: MAX_NODES[mode]]:
        descriptor = _descriptor_from_raw_node(node)
        if not _should_ref(descriptor, mode):
            continue

        key = _dedupe_key(descriptor)
        if key in seen:
            continue
        seen.add(key)

        ref = f"@e{len(refs) + 1}"
        refs[ref] = descriptor
        llm_refs.append(_llm_ref(ref, descriptor))
        if len(refs) >= MAX_REFS[mode]:
            warning = f"Refs truncated at {MAX_REFS[mode]}."
            break

    if not prefixes:
        warning = warning or "No document subtree found; fallback to full accessibility tree."
    elif not refs:
        warning = warning or "Document subtree found but no useful refs matched filters."

    return refs, llm_refs, warning


def build_snapshot(mode="expanded", raw_tree=None):
    mode = "compact" if mode == "compact" else "expanded"
    try:
        tree = raw_tree or build_raw_snapshot()
        refs, llm_refs, warning = _walk_raw_tree(tree, mode)
        snapshot_id = STORE.replace(refs)
        return {
            "ok": True,
            "snapshot_id": snapshot_id,
            "mode": mode,
            "refs": llm_refs,
            "warning": warning,
        }
    except Exception as error:
        snapshot_id = STORE.replace({})
        return {
            "ok": False,
            "snapshot_id": snapshot_id,
            "mode": mode,
            "refs": [],
            "warning": f"Dogtail snapshot failed: {error}",
        }


def build_raw_snapshot():
    return read_accessibility_tree(max_nodes=4000, max_depth=20)


def _text_value(node, limit=260):
    parts = []
    for key in ("name", "text", "description", "value"):
        value = _clean(node.get(key), limit)
        if value and value not in parts:
            parts.append(value)
    return " | ".join(parts[:2])


def _accerciser_line(node):
    role = _clean(node.get("role"), 100) or "unknown"
    label = _text_value(node, 320)
    line = f"- {role}"
    if label:
        line += f' "{label.replace(chr(34), chr(92) + chr(34))}"'

    attrs = []
    states = [_clean(state, 80) for state in node.get("states", []) if _clean(state, 80)]
    useful_states = [
        state
        for state in states
        if state
        in {
            "active",
            "checked",
            "editable",
            "enabled",
            "expanded",
            "focusable",
            "focused",
            "modal",
            "pressed",
            "selected",
            "sensitive",
            "showing",
            "visible",
        }
    ]
    if useful_states:
        attrs.append("states=" + ",".join(useful_states[:12]))

    actions = [_clean(action, 80) for action in node.get("actions", []) if _clean(action, 80)]
    if actions:
        attrs.append("actions=" + ",".join(actions[:8]))

    interfaces = [_clean(interface, 80) for interface in node.get("interfaces", []) if _clean(interface, 80)]
    if interfaces:
        attrs.append("interfaces=" + ",".join(interfaces[:10]))

    bounds = node.get("bounds")
    if bounds and bounds.get("width", 0) > 0 and bounds.get("height", 0) > 0:
        attrs.append(
            "bounds="
            + f'{bounds.get("x", 0)},{bounds.get("y", 0)},{bounds.get("width", 0)}x{bounds.get("height", 0)}'
        )

    if attrs:
        line += " [" + "; ".join(attrs) + "]"
    return line


def build_accerciser_snapshot(tree=None):
    tree = tree or read_accessibility_tree(max_nodes=5000, max_depth=24)
    lines = []
    truncated = False

    for node in tree.get("nodes", []):
        depth = min(int(node.get("depth", 0) or 0), 24)
        lines.append(f"{'  ' * depth}{_accerciser_line(node)}")
        if len(lines) >= ACCERCISER_MAX_LINES or sum(len(line) + 1 for line in lines) >= ACCERCISER_MAX_CHARS:
            truncated = True
            break

    return {
        "ok": tree.get("ok", False),
        "tree": "\n".join(lines).strip() or "(empty accessibility tree)",
        "node_count": len(tree.get("nodes", [])),
        "warning": (
            tree.get("error")
            or tree.get("warning")
            or (
                f"Accerciser-style tree truncated at {ACCERCISER_MAX_LINES} lines or {ACCERCISER_MAX_CHARS} chars."
                if truncated
                else None
            )
        ),
    }


def build_debug_snapshot(mode="expanded"):
    raw_snapshot = build_raw_snapshot()
    return {
        "ok": bool(raw_snapshot.get("ok", False)),
        "raw_snapshot": raw_snapshot,
        "accerciser_snapshot": build_accerciser_snapshot(raw_snapshot),
        "cleaned_snapshot": build_snapshot(mode, raw_snapshot),
    }
