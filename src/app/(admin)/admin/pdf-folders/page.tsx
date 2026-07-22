"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  role: string;
};

type FolderUser = UserRow & { folderId: string };

type FolderGroup = {
  name: string;
  count: number;
  folderIds: string[];
  users: FolderUser[];
  createdAt: string;
};

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

function message(json: any, fallback: string) {
  if (json?.error === "invalid_payload") return "Μη έγκυρα στοιχεία.";
  if (json?.error === "not_found") return "Ο φάκελος δεν βρέθηκε.";
  return json?.detail || json?.error || fallback;
}

export default function AdminPdfFoldersPage() {
  const [folders, setFolders] = useState<FolderGroup[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [folderSearch, setFolderSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newUserIds, setNewUserIds] = useState<string[]>([]);
  const [createForAll, setCreateForAll] = useState(false);
  const [addIds, setAddIds] = useState<string[]>([]);
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const [renameValue, setRenameValue] = useState("");

  const load = useCallback(async (preferred?: string | null) => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/pdf-folders", { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(message(json, "Αποτυχία φόρτωσης."));

      const nextFolders = json.folders || [];
      setFolders(nextFolders);
      setUsers(json.users || []);
      setSelectedName((current) => {
        const wanted = preferred ?? current;
        if (wanted && nextFolders.some((folder: FolderGroup) => folder.name === wanted)) return wanted;
        return nextFolders[0]?.name ?? null;
      });
    } catch (error: any) {
      alert(error?.message || "Αποτυχία φόρτωσης.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => folders.find((folder) => folder.name === selectedName) || null,
    [folders, selectedName]
  );

  useEffect(() => {
    setRenameValue(selected?.name || "");
    setAddIds([]);
    setRemoveIds([]);
    setUserSearch("");
  }, [selected?.name]);

  const filteredFolders = useMemo(() => {
    const q = folderSearch.trim().toLocaleLowerCase("el");
    return q ? folders.filter((folder) => folder.name.toLocaleLowerCase("el").includes(q)) : folders;
  }, [folders, folderSearch]);

  const assignedSet = useMemo(
    () => new Set((selected?.users || []).map((user) => user.id)),
    [selected]
  );

  const available = useMemo(
    () => users.filter((user) => !assignedSet.has(user.id)),
    [users, assignedSet]
  );

  function filterUsers<T extends { email: string; name: string | null }>(list: T[]) {
    const q = userSearch.trim().toLocaleLowerCase("el");
    return q
      ? list.filter((user) => `${user.name || ""} ${user.email}`.toLocaleLowerCase("el").includes(q))
      : list;
  }

  async function request(method: "POST" | "PATCH" | "DELETE", body: object) {
    const response = await fetch("/api/admin/pdf-folders", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(message(json, "Η ενέργεια απέτυχε."));
    return json;
  }

  async function createFolder() {
    const name = newName.trim();
    if (!name) return alert("Συμπληρώστε όνομα φακέλου.");
    if (!createForAll && !newUserIds.length) return alert("Επιλέξτε χρήστες.");

    setWorking(true);
    try {
      const json = await request("POST", createForAll ? { name, all: true } : { name, userIds: newUserIds });
      alert(`Δημιουργήθηκαν: ${json.created ?? 0}\nΥπήρχαν ήδη: ${json.skipped ?? 0}`);
      setNewName("");
      setNewUserIds([]);
      setCreateForAll(false);
      await load(name);
    } catch (error: any) {
      alert(error?.message || "Αποτυχία δημιουργίας.");
    } finally {
      setWorking(false);
    }
  }

  async function addUsers(all: boolean) {
    if (!selected) return;
    const ids = all ? available.map((user) => user.id) : addIds;
    if (!ids.length) return alert("Δεν υπάρχουν χρήστες για προσθήκη.");
    if (!confirm(`Να προστεθεί ο φάκελος σε ${ids.length} χρήστη/χρήστες;`)) return;

    setWorking(true);
    try {
      await request("POST", { name: selected.name, userIds: ids });
      await load(selected.name);
    } catch (error: any) {
      alert(error?.message || "Αποτυχία προσθήκης.");
    } finally {
      setWorking(false);
    }
  }

  async function removeUsers(all: boolean) {
    if (!selected) return;
    const ids = all ? selected.users.map((user) => user.id) : removeIds;
    if (!ids.length) return alert("Επιλέξτε χρήστες.");
    if (!confirm(`Να αφαιρεθεί ο φάκελος από ${ids.length} χρήστη/χρήστες;\n\nΤα PDF δεν θα διαγραφούν.`)) return;

    setWorking(true);
    try {
      const json = await request("DELETE", { name: selected.name, userIds: ids });
      alert(`Διαγράφηκαν φάκελοι: ${json.deletedFolders ?? 0}\nΑποσυνδέθηκαν PDF: ${json.detachedFiles ?? 0}`);
      await load(all ? null : selected.name);
    } catch (error: any) {
      alert(error?.message || "Αποτυχία αφαίρεσης.");
    } finally {
      setWorking(false);
    }
  }

  async function renameFolder() {
    if (!selected) return;
    const next = renameValue.trim();
    if (!next || next === selected.name) return;
    if (!confirm(`Να μετονομαστεί ο φάκελος σε "${next}" για όλους;`)) return;

    setWorking(true);
    try {
      const json = await request("PATCH", { oldName: selected.name, newName: next });
      alert(`Μετονομάστηκαν: ${json.renamed ?? 0}\nΣυγχωνεύτηκαν: ${json.merged ?? 0}`);
      await load(next);
    } catch (error: any) {
      alert(error?.message || "Αποτυχία μετονομασίας.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-xl font-semibold">PDF Φάκελοι</h1>
        <p className="mt-1 text-sm text-gray-500">Διαχείριση φακέλων και χρηστών από ένα σημείο.</p>
      </header>

      <section className="rounded-2xl border bg-[color:var(--card,#fff)] p-4">
        <h2 className="font-semibold">Νέος φάκελος</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="grid content-start gap-3">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Όνομα νέου φακέλου"
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 rounded-xl border bg-gray-50 px-3 py-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={createForAll}
                onChange={(event) => {
                  setCreateForAll(event.target.checked);
                  if (event.target.checked) setNewUserIds([]);
                }}
              />
              Δημιουργία για όλους τους ενεργούς χρήστες
            </label>
            <button
              onClick={createFolder}
              disabled={working || !newName.trim() || (!createForAll && !newUserIds.length)}
              className="rounded-xl bg-[color:var(--brand,#25C3F4)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {working ? "Επεξεργασία…" : "Δημιουργία φακέλου"}
            </button>
          </div>

          {!createForAll && (
            <Checklist
              users={users}
              selectedIds={newUserIds}
              onToggle={(id) => setNewUserIds((current) => toggleId(current, id))}
              onToggleAll={() => setNewUserIds(newUserIds.length === users.length ? [] : users.map((user) => user.id))}
            />
          )}
        </div>
      </section>

      <div className="grid min-h-[620px] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border bg-[color:var(--card,#fff)]">
          <div className="border-b p-4">
            <h2 className="font-semibold">Όλοι οι φάκελοι</h2>
            <input
              value={folderSearch}
              onChange={(event) => setFolderSearch(event.target.value)}
              placeholder="Αναζήτηση φακέλου…"
              className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
            />
          </div>
          <div className="max-h-[650px] overflow-y-auto p-2">
            {loading ? (
              <div className="p-3 text-sm text-gray-500">Φόρτωση…</div>
            ) : filteredFolders.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">Δεν βρέθηκαν φάκελοι.</div>
            ) : (
              filteredFolders.map((folder) => (
                <button
                  key={folder.name}
                  onClick={() => setSelectedName(folder.name)}
                  className={`mb-1 w-full rounded-xl border px-3 py-3 text-left ${
                    selectedName === folder.name
                      ? "border-[color:var(--brand,#25C3F4)] bg-cyan-50"
                      : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <span className="block break-words text-sm font-semibold">{folder.name}</span>
                  <span className="mt-1 block text-xs text-gray-500">{folder.count} χρήστης/χρήστες</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-[color:var(--card,#fff)] p-4">
          {!selected ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500">Επιλέξτε φάκελο.</div>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:justify-between">
                <div>
                  <h2 className="break-words text-lg font-semibold">{selected.name}</h2>
                  <p className="text-sm text-gray-500">{selected.count} από {users.length} ενεργούς χρήστες</p>
                </div>
                <button
                  onClick={() => removeUsers(true)}
                  disabled={working}
                  className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  Διαγραφή από όλους
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                />
                <button
                  onClick={renameFolder}
                  disabled={working || !renameValue.trim() || renameValue.trim() === selected.name}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  Μετονομασία
                </button>
              </div>

              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Αναζήτηση χρήστη…"
                className="rounded-xl border px-3 py-2 text-sm"
              />

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <h3 className="text-sm font-semibold">Έχουν τον φάκελο ({selected.users.length})</h3>
                  <div className="mt-3">
                    <Checklist
                      users={filterUsers(selected.users)}
                      selectedIds={removeIds}
                      onToggle={(id) => setRemoveIds((current) => toggleId(current, id))}
                      onToggleAll={() => setRemoveIds(removeIds.length === selected.users.length ? [] : selected.users.map((user) => user.id))}
                    />
                  </div>
                  <button
                    onClick={() => removeUsers(false)}
                    disabled={working || !removeIds.length}
                    className="mt-3 w-full rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                  >
                    Αφαίρεση επιλεγμένων ({removeIds.length})
                  </button>
                </div>

                <div className="rounded-xl border p-3">
                  <h3 className="text-sm font-semibold">Δεν έχουν τον φάκελο ({available.length})</h3>
                  <div className="mt-3">
                    <Checklist
                      users={filterUsers(available)}
                      selectedIds={addIds}
                      onToggle={(id) => setAddIds((current) => toggleId(current, id))}
                      onToggleAll={() => setAddIds(addIds.length === available.length ? [] : available.map((user) => user.id))}
                    />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      onClick={() => addUsers(false)}
                      disabled={working || !addIds.length}
                      className="rounded-xl bg-[color:var(--brand,#25C3F4)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      Προσθήκη ({addIds.length})
                    </button>
                    <button
                      onClick={() => addUsers(true)}
                      disabled={working || !available.length}
                      className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Προσθήκη σε όλους
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Checklist({
  users,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  users: Array<{ id: string; email: string; name: string | null }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  const allChecked = users.length > 0 && users.every((user) => selectedIds.includes(user.id));

  return (
    <div className="overflow-hidden rounded-xl border bg-gray-50">
      <label className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm font-semibold">
        <input type="checkbox" checked={allChecked} onChange={onToggleAll} />
        Επιλογή όλων
      </label>
      <div className="max-h-72 overflow-y-auto p-2">
        {users.length === 0 ? (
          <div className="px-2 py-3 text-sm text-gray-500">Δεν υπάρχουν χρήστες.</div>
        ) : (
          users.map((user) => (
            <label key={user.id} className="flex cursor-pointer gap-2 rounded-lg px-2 py-2 hover:bg-white">
              <input
                type="checkbox"
                checked={selectedIds.includes(user.id)}
                onChange={() => onToggle(user.id)}
                className="mt-1"
              />
              <span className="min-w-0 text-sm">
                {user.name && <span className="block break-words font-medium">{user.name}</span>}
                <span className="block break-words text-xs text-gray-500">{user.email}</span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
