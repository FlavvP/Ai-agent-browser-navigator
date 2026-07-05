import time


def _state_names(node):
    try:
        states = node.getState()
        return [states.getStates()[i].name for i in range(states.getStates().__len__())]
    except Exception:
        return []


def _role_name(node):
    try:
        return str(node.getRoleName() or "")
    except Exception:
        return ""


def _text(node, limit=500):
    try:
        iface = node.queryText()
        text = iface.getText(0, min(iface.characterCount, limit))
        return text or ""
    except Exception:
        return ""


def _value(node):
    try:
        return str(node.queryValue().currentValue)
    except Exception:
        return ""


def _bounds(node):
    try:
        component = node.queryComponent()
        x, y, width, height = component.getExtents(0)
        return {"x": x, "y": y, "width": width, "height": height}
    except Exception:
        return None


def _name(node):
    try:
        return str(node.name or "")
    except Exception:
        return ""


def _description(node):
    try:
        return str(node.description or "")
    except Exception:
        return ""


def _actions(node):
    try:
        action = node.queryAction()
        return [str(action.getName(index) or "") for index in range(action.nActions) if action.getName(index)]
    except Exception:
        return []


def _interfaces(node):
    checks = [
        ("Action", "queryAction"),
        ("Component", "queryComponent"),
        ("Text", "queryText"),
        ("EditableText", "queryEditableText"),
        ("Value", "queryValue"),
        ("Selection", "querySelection"),
        ("Table", "queryTable"),
        ("Hypertext", "queryHypertext"),
    ]
    names = []
    for name, method in checks:
        try:
            getattr(node, method)()
            names.append(name)
        except Exception:
            pass
    return names


def _children(node):
    try:
        return [node.getChildAtIndex(index) for index in range(min(node.childCount, 200))]
    except Exception:
        return []


def _read_accessibility_tree_once(pyatspi, max_nodes, max_depth):
    nodes = []

    def visit(node, depth, path):
        if len(nodes) >= max_nodes or depth > max_depth:
            return

        role = _role_name(node)
        name = _name(node)
        text = _text(node)
        value = _value(node)
        description = _description(node)
        states = _state_names(node)
        bounds = _bounds(node)
        actions = _actions(node)
        interfaces = _interfaces(node)

        nodes.append(
            {
                "id": "/".join(str(part) for part in path),
                "role": role,
                "name": name,
                "text": text,
                "value": value,
                "description": description,
                "states": states,
                "bounds": bounds,
                "actions": actions,
                "interfaces": interfaces,
                "depth": depth,
            }
        )

        for index, child in enumerate(_children(node)):
            visit(child, depth + 1, [*path, index])

    desktop = pyatspi.Registry.getDesktop(0)
    visit(desktop, 0, [0])
    return nodes


def _looks_incomplete(nodes):
    if len(nodes) <= 1:
        return True
    application_nodes = [node for node in nodes if node.get("depth") == 1 and node.get("role") == "application"]
    return not application_nodes


def read_accessibility_tree(max_nodes=1200, max_depth=14):
    try:
        import pyatspi
    except Exception as error:
        return {"ok": False, "error": f"pyatspi unavailable: {error}", "nodes": []}

    last_nodes = []
    try:
        for attempt in range(4):
            last_nodes = _read_accessibility_tree_once(pyatspi, max_nodes, max_depth)
            if not _looks_incomplete(last_nodes):
                return {"ok": True, "nodes": last_nodes}
            if attempt < 3:
                time.sleep(0.35)
        return {
            "ok": True,
            "warning": "AT-SPI2 returned an incomplete tree after retries.",
            "nodes": last_nodes,
        }
    except Exception as error:
        return {"ok": False, "error": str(error), "nodes": last_nodes}
