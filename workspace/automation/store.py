import time


class SnapshotStore:
    def __init__(self):
        self.snapshot_id = None
        self.refs = {}
        self.counter = 0

    def replace(self, refs):
        self.counter += 1
        self.snapshot_id = f"s{self.counter}"
        self.refs = refs
        return self.snapshot_id

    def get(self, snapshot_id, ref):
        if not self.snapshot_id or snapshot_id != self.snapshot_id:
            raise ValueError("Ref obsolete: snapshot_id is not the latest snapshot.")
        item = self.refs.get(ref)
        if not item:
            raise ValueError(f"Unknown ref: {ref}")
        return item


STORE = SnapshotStore()


def now_ms():
    return int(time.time() * 1000)
