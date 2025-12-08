import { useState, useEffect, useCallback, createContext } from "react";
import ControlPanel from "./EditorHeader/ControlPanel";
import Canvas from "./EditorCanvas/Canvas";
import { CanvasContextProvider } from "../context/CanvasContext";
import SidePanel from "./EditorSidePanel/SidePanel";
import { DB, State } from "../data/constants";
import { db } from "../data/db";
import {
  useLayout,
  useSettings,
  useTransform,
  useDiagram,
  useUndoRedo,
  useAreas,
  useNotes,
  useTypes,
  useTasks,
  useSaveState,
  useEnums,
} from "../hooks";
import FloatingControls from "./FloatingControls";
import { Button, Modal, Tag } from "@douyinfe/semi-ui";
import { IconAlertTriangle } from "@douyinfe/semi-icons";
import { useTranslation } from "react-i18next";
import { databases } from "../data/databases";
import { isRtl } from "../i18n/utils/rtl";
import { useSearchParams } from "react-router-dom";
import { get, SHARE_FILENAME } from "../api/gists";
import { nanoid } from "nanoid";

export const IdContext = createContext({
  gistId: "",
  setGistId: () => {},
  version: "",
  setVersion: () => {},
});

const SIDEPANEL_MIN_WIDTH = 384;

export default function WorkSpace() {
  const [id, setId] = useState(0);
  const [gistId, setGistId] = useState("");
  const [version, setVersion] = useState("");
  const [loadedFromGistId, setLoadedFromGistId] = useState("");
  const [title, setTitle] = useState("Untitled Diagram");
  const [resize, setResize] = useState(false);
  const [width, setWidth] = useState(SIDEPANEL_MIN_WIDTH);
  const [lastSaved, setLastSaved] = useState("");
  const [showSelectDbModal, setShowSelectDbModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedDb, setSelectedDb] = useState("");
  const { layout, setLayout } = useLayout();
  const { settings } = useSettings();
  const { types, setTypes } = useTypes();
  const { areas, setAreas } = useAreas();
  const { tasks, setTasks } = useTasks();
  const { notes, setNotes } = useNotes();
  const { saveState, setSaveState } = useSaveState();
  const { transform, setTransform } = useTransform();
  const { enums, setEnums } = useEnums();
  const {
    tables,
    relationships,
    setTables,
    setRelationships,
    database,
    setDatabase,
  } = useDiagram();
  const { undoStack, redoStack, setUndoStack, setRedoStack } = useUndoRedo();
  const { t, i18n } = useTranslation();
  let [searchParams, setSearchParams] = useSearchParams();
  const handleResize = (e) => {
    if (!resize) return;
    const w = isRtl(i18n.language) ? window.innerWidth - e.clientX : e.clientX;
    if (w > SIDEPANEL_MIN_WIDTH) setWidth(w);
  };

  const save = useCallback(async () => {
    console.log("[DEBUG] save() called. window.name:", window.name);
    const name = window.name.split(" ");
    const op = name[0];
    // Allow "drawdb" as a valid diagram save operation (Wujie environment)
    const saveAsDiagram = window.name === "" || op === "d" || op === "lt" || op === "drawdb";
    console.log("[DEBUG] saveAsDiagram:", saveAsDiagram, "op:", op);

    if (saveAsDiagram) {
      if (searchParams.has("shareId")) {
        searchParams.delete("shareId");
        setSearchParams(searchParams, { replace: true });
      }
      // Treat id=0 with window.name="drawdb" as a new save
      if ((id === 0 && (window.name === "" || op === "drawdb")) || op === "lt") {
        const data = {
          database: database,
          name: title,
          gistId: gistId ?? "",
          lastModified: new Date(),
          tables: tables,
          references: relationships,
          notes: notes,
          areas: areas,
          todos: tasks,
          pan: transform.pan,
          zoom: transform.zoom,
          loadedFromGistId: loadedFromGistId,
          ...(databases[database].hasEnums && { enums: enums }),
          ...(databases[database].hasTypes && { types: types }),
        };
        
        // Save to Backend
        console.log("Saving to backend (new)...");
        fetch("http://127.0.0.1:5031/api/diagram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: title,
            jsonData: JSON.stringify(data)
          })
        })
        .then(res => {
            if(res.ok) console.log("Backend save success");
            else console.error("Backend save failed", res.status);
        })
        .catch(e => console.error("Backend save failed", e));

        await db.diagrams
          .add(data)
          .then((id) => {
            setId(id);
            window.name = `d ${id}`;
            setSaveState(State.SAVED);
            setLastSaved(new Date().toLocaleString());
          });
      } else {
        const data = {
          database: database,
          name: title,
          lastModified: new Date(),
          tables: tables,
          references: relationships,
          notes: notes,
          areas: areas,
          todos: tasks,
          gistId: gistId ?? "",
          pan: transform.pan,
          zoom: transform.zoom,
          loadedFromGistId: loadedFromGistId,
          ...(databases[database].hasEnums && { enums: enums }),
          ...(databases[database].hasTypes && { types: types }),
        };

        // Save to Backend
        console.log("Saving to backend (update)...");
        fetch("http://127.0.0.1:5031/api/diagram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: title,
            jsonData: JSON.stringify(data)
          })
        })
        .then(res => {
            if(res.ok) console.log("Backend save success");
            else console.error("Backend save failed", res.status);
        })
        .catch(e => console.error("Backend save failed", e));

        await db.diagrams
          .update(id, data)
          .then(() => {
            setSaveState(State.SAVED);
            setLastSaved(new Date().toLocaleString());
          });
      }
    } else {
      console.log("[DEBUG] Saving as template (else block reached)");
      await db.templates
        .update(id, {
          database: database,
          title: title,
          tables: tables,
          relationships: relationships,
          notes: notes,
          subjectAreas: areas,
          todos: tasks,
          pan: transform.pan,
          zoom: transform.zoom,
          ...(databases[database].hasEnums && { enums: enums }),
          ...(databases[database].hasTypes && { types: types }),
        })
        .then(() => {
          setSaveState(State.SAVED);
          setLastSaved(new Date().toLocaleString());
        })
        .catch(() => {
          setSaveState(State.ERROR);
        });
    }
  }, [
    searchParams,
    setSearchParams,
    tables,
    relationships,
    notes,
    areas,
    types,
    title,
    id,
    tasks,
    transform,
    setSaveState,
    database,
    enums,
    gistId,
    loadedFromGistId,
  ]);

  const load = useCallback(async () => {
    const loadLatestDiagram = async () => {
      let loadedFromBackend = false;
      try {
        console.log("[DEBUG] Loading from backend...");
        const response = await fetch("http://127.0.0.1:5031/api/diagram");
        console.log("[DEBUG] Backend response status:", response.status);
        if (response.ok) {
          const diagramEntity = await response.json();
          console.log("[DEBUG] Loaded diagram from backend:", diagramEntity.name);
          const d = JSON.parse(diagramEntity.jsonData);
          console.log("[DEBUG] Parsed JSON data:", d);
          if (d) {
            if (d.database) {
              setDatabase(d.database);
            } else {
              setDatabase(DB.GENERIC);
            }
            
            setTitle(d.name ?? "Untitled Diagram");
            setTables(d.tables ?? []);
            setRelationships(d.references ?? []);
            setNotes(d.notes ?? []);
            setAreas(d.areas ?? []);
            setTasks(d.todos ?? []);
            setTransform({ pan: d.pan ?? { x: 0, y: 0 }, zoom: d.zoom ?? 1 });
            
            // IMPORTANT: Check database type before accessing databases[d.database]
            // If d.database is valid, use it. Otherwise fallback or be careful.
            const dbConfig = databases[d.database];
            if (dbConfig && dbConfig.hasTypes) {
              if (d.types) {
                setTypes(
                  d.types.map((t) =>
                    t.id
                      ? t
                      : {
                          ...t,
                          id: nanoid(),
                          fields: t.fields.map((f) =>
                            f.id ? f : { ...f, id: nanoid() },
                          ),
                        },
                  ),
                );
              } else {
                setTypes([]);
              }
            }
            if (dbConfig && dbConfig.hasEnums) {
              setEnums(
                d.enums?.map((e) => (!e.id ? { ...e, id: nanoid() } : e)) ?? [],
              );
            }
            
            // Force window.name to be compatible with our save logic
            // We don't have a local ID, so we can use 0 or keep it empty but ensure 'drawdb' op is handled
            // But wait, if we don't set window.name, the next save might be treated as 'new' (id=0)
            // which is fine, but we want to update if possible.
            // For now, let's just ensure it loads.
            loadedFromBackend = true;
            console.log("[DEBUG] Backend load successful, skipping local DB load.");
          }
        }
      } catch (e) {
        console.error("[DEBUG] Failed to load from backend", e);
      }

      if (loadedFromBackend) return;
      
      console.log("[DEBUG] Loading from local DB (fallback)...");

      await db.diagrams
        .orderBy("lastModified")
        .last()
        .then((d) => {
          if (d) {
            if (d.database) {
              setDatabase(d.database);
            } else {
              setDatabase(DB.GENERIC);
            }
            setId(d.id);
            setGistId(d.gistId);
            setLoadedFromGistId(d.loadedFromGistId);
            setTitle(d.name);
            setTables(d.tables);
            setRelationships(d.references);
            setNotes(d.notes);
            setAreas(d.areas);
            setTasks(d.todos ?? []);
            setTransform({ pan: d.pan, zoom: d.zoom });
            if (databases[database].hasTypes) {
              if (d.types) {
                setTypes(
                  d.types.map((t) =>
                    t.id
                      ? t
                      : {
                          ...t,
                          id: nanoid(),
                          fields: t.fields.map((f) =>
                            f.id ? f : { ...f, id: nanoid() },
                          ),
                        },
                  ),
                );
              } else {
                setTypes([]);
              }
            }
            if (databases[database].hasEnums) {
              setEnums(
                d.enums.map((e) => (!e.id ? { ...e, id: nanoid() } : e)) ?? [],
              );
            }
            window.name = `d ${d.id}`;
          } else {
            window.name = "";
            if (selectedDb === "") setShowSelectDbModal(true);
          }
        })
        .catch((error) => {
          console.log(error);
        });
    };

    const loadDiagram = async (id) => {
      await db.diagrams
        .get(id)
        .then((diagram) => {
          if (diagram) {
            if (diagram.database) {
              setDatabase(diagram.database);
            } else {
              setDatabase(DB.GENERIC);
            }
            setId(diagram.id);
            setGistId(diagram.gistId);
            setLoadedFromGistId(diagram.loadedFromGistId);
            setTitle(diagram.name);
            setTables(diagram.tables);
            setRelationships(diagram.references);
            setAreas(diagram.areas);
            setNotes(diagram.notes);
            setTasks(diagram.todos ?? []);
            setTransform({
              pan: diagram.pan,
              zoom: diagram.zoom,
            });
            setUndoStack([]);
            setRedoStack([]);
            if (databases[database].hasTypes) {
              if (diagram.types) {
                setTypes(
                  diagram.types.map((t) =>
                    t.id
                      ? t
                      : {
                          ...t,
                          id: nanoid(),
                          fields: t.fields.map((f) =>
                            f.id ? f : { ...f, id: nanoid() },
                          ),
                        },
                  ),
                );
              } else {
                setTypes([]);
              }
            }
            if (databases[database].hasEnums) {
              setEnums(
                diagram.enums.map((e) =>
                  !e.id ? { ...e, id: nanoid() } : e,
                ) ?? [],
              );
            }
            window.name = `d ${diagram.id}`;
          } else {
            window.name = "";
          }
        })
        .catch((error) => {
          console.log(error);
        });
    };

    const loadTemplate = async (id) => {
      await db.templates
        .get(id)
        .then((diagram) => {
          if (diagram) {
            if (diagram.database) {
              setDatabase(diagram.database);
            } else {
              setDatabase(DB.GENERIC);
            }
            setId(diagram.id);
            setTitle(diagram.title);
            setTables(diagram.tables);
            setRelationships(diagram.relationships);
            setAreas(diagram.subjectAreas);
            setTasks(diagram.todos ?? []);
            setNotes(diagram.notes);
            setTransform({
              zoom: 1,
              pan: { x: 0, y: 0 },
            });
            setUndoStack([]);
            setRedoStack([]);
            if (databases[database].hasTypes) {
              if (diagram.types) {
                setTypes(
                  diagram.types.map((t) =>
                    t.id
                      ? t
                      : {
                          ...t,
                          id: nanoid(),
                          fields: t.fields.map((f) =>
                            f.id ? f : { ...f, id: nanoid() },
                          ),
                        },
                  ),
                );
              } else {
                setTypes([]);
              }
            }
            if (databases[database].hasEnums) {
              setEnums(
                diagram.enums.map((e) =>
                  !e.id ? { ...e, id: nanoid() } : e,
                ) ?? [],
              );
            }
          } else {
            if (selectedDb === "") setShowSelectDbModal(true);
          }
        })
        .catch((error) => {
          console.log(error);
          if (selectedDb === "") setShowSelectDbModal(true);
        });
    };

    const loadFromGist = async (shareId) => {
      try {
        const { data } = await get(shareId);
        const parsedDiagram = JSON.parse(data.files[SHARE_FILENAME].content);
        setUndoStack([]);
        setRedoStack([]);
        setGistId(shareId);
        setLoadedFromGistId(shareId);
        setDatabase(parsedDiagram.database);
        setTitle(parsedDiagram.title);
        setTables(parsedDiagram.tables);
        setRelationships(parsedDiagram.relationships);
        setNotes(parsedDiagram.notes);
        setAreas(parsedDiagram.subjectAreas);
        setTransform(parsedDiagram.transform);
        if (databases[parsedDiagram.database].hasTypes) {
          if (parsedDiagram.types) {
            setTypes(
              parsedDiagram.types.map((t) =>
                t.id
                  ? t
                  : {
                      ...t,
                      id: nanoid(),
                      fields: t.fields.map((f) =>
                        f.id ? f : { ...f, id: nanoid() },
                      ),
                    },
              ),
            );
          } else {
            setTypes([]);
          }
        }
        if (databases[parsedDiagram.database].hasEnums) {
          setEnums(
            parsedDiagram.enums.map((e) =>
              !e.id ? { ...e, id: nanoid() } : e,
            ) ?? [],
          );
        }
      } catch (e) {
        console.log(e);
        setSaveState(State.FAILED_TO_LOAD);
      }
    };

    const shareId = searchParams.get("shareId");
    if (shareId) {
      const existingDiagram = await db.diagrams.get({
        loadedFromGistId: shareId,
      });

      if (existingDiagram) {
        window.name = "d " + existingDiagram.id;
        setId(existingDiagram.id);
      } else {
        window.name = "";
        setId(0);
      }
      await loadFromGist(shareId);
      return;
    }

    console.log("[DEBUG] load() called. window.name:", window.name);

    if (window.name === "" || window.name === "drawdb") {
      console.log("[DEBUG] window.name is empty or 'drawdb', loading latest.");
      await loadLatestDiagram();
    } else {
      const name = window.name.split(" ");
      const op = name[0];
      const id = parseInt(name[1]);
      console.log("[DEBUG] Parsing window.name. op:", op, "id:", id);
      switch (op) {
        case "d": {
          await loadDiagram(id);
          break;
        }
        case "t":
        case "lt": {
          await loadTemplate(id);
          break;
        }
        default:
          console.log("[DEBUG] Unknown op:", op, "Loading latest as fallback.");
          await loadLatestDiagram();
          break;
      }
    }
  }, [
    setTransform,
    setRedoStack,
    setUndoStack,
    setRelationships,
    setTables,
    setAreas,
    setNotes,
    setTypes,
    setTasks,
    setDatabase,
    database,
    setEnums,
    selectedDb,
    setSaveState,
    searchParams,
  ]);

  const returnToCurrentDiagram = async () => {
    await load();
    setLayout((prev) => ({ ...prev, readOnly: false }));
    setVersion(null);
  };

  useEffect(() => {
    if (
      tables?.length === 0 &&
      areas?.length === 0 &&
      notes?.length === 0 &&
      types?.length === 0 &&
      tasks?.length === 0
    )
      return;

    if (settings.autosave) {
      setSaveState(State.SAVING);
    }
  }, [
    undoStack,
    redoStack,
    settings.autosave,
    tables?.length,
    areas?.length,
    notes?.length,
    types?.length,
    relationships?.length,
    tasks?.length,
    transform.zoom,
    title,
    gistId,
    setSaveState,
  ]);

  useEffect(() => {
    console.log("[DEBUG] Save effect triggered. saveState:", saveState, "readOnly:", layout.readOnly);
    if (layout.readOnly) return;

    if (saveState !== State.SAVING) return;

    save();
  }, [saveState, layout, save]);

  useEffect(() => {
    document.title = "Editor | drawDB";

    load();
  }, [load]);

  return (
    <div className="h-full flex flex-col overflow-hidden theme">
      <IdContext.Provider value={{ gistId, setGistId, version, setVersion }}>
        <ControlPanel
          diagramId={id}
          setDiagramId={setId}
          title={title}
          setTitle={setTitle}
          lastSaved={lastSaved}
          setLastSaved={setLastSaved}
        />
      </IdContext.Provider>
      <div
        className="flex h-full overflow-y-auto"
        onPointerUp={(e) => e.isPrimary && setResize(false)}
        onPointerLeave={(e) => e.isPrimary && setResize(false)}
        onPointerMove={(e) => e.isPrimary && handleResize(e)}
        onPointerDown={(e) => {
          // Required for onPointerLeave to trigger when a touch pointer leaves
          // https://stackoverflow.com/a/70976017/1137077
          e.target.releasePointerCapture(e.pointerId);
        }}
        style={isRtl(i18n.language) ? { direction: "rtl" } : {}}
      >
        {layout.sidebar && (
          <SidePanel resize={resize} setResize={setResize} width={width} />
        )}
        <div className="relative w-full h-full overflow-hidden">
          <CanvasContextProvider className="h-full w-full">
            <Canvas saveState={saveState} setSaveState={setSaveState} />
          </CanvasContextProvider>
          {version && (
            <div className="absolute right-8 top-2 space-x-2">
              <Button
                icon={<i className="fa-solid fa-rotate-right mt-0.5"></i>}
                onClick={() => setShowRestoreModal(true)}
              >
                {t("restore_version")}
              </Button>
              <Button
                type="tertiary"
                onClick={returnToCurrentDiagram}
                icon={<i className="bi bi-arrow-return-right mt-1"></i>}
              >
                {t("return_to_current")}
              </Button>
            </div>
          )}
          {!(layout.sidebar || layout.toolbar || layout.header) && (
            <div className="fixed right-5 bottom-4">
              <FloatingControls />
            </div>
          )}
        </div>
      </div>
      <Modal
        centered
        size="medium"
        closable={false}
        hasCancel={false}
        title={t("pick_db")}
        okText={t("confirm")}
        visible={showSelectDbModal}
        onOk={() => {
          if (selectedDb === "") return;
          setDatabase(selectedDb);
          setShowSelectDbModal(false);
        }}
        okButtonProps={{ disabled: selectedDb === "" }}
      >
        <div className="grid grid-cols-3 gap-4 place-content-center">
          {Object.values(databases).map((x) => (
            <div
              key={x.name}
              onClick={() => setSelectedDb(x.label)}
              className={`space-y-3 p-3 rounded-md border-2 select-none ${
                settings.mode === "dark"
                  ? "bg-zinc-700 hover:bg-zinc-600"
                  : "bg-zinc-100 hover:bg-zinc-200"
              } ${selectedDb === x.label ? "border-zinc-400" : "border-transparent"}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{x.name}</div>
                {x.beta && (
                  <Tag size="small" color="light-blue">
                    Beta
                  </Tag>
                )}
              </div>
              {x.image && (
                <img
                  src={x.image}
                  className="h-8"
                  style={{
                    filter:
                      "opacity(0.4) drop-shadow(0 0 0 white) drop-shadow(0 0 0 white)",
                  }}
                />
              )}
              <div className="text-xs">{x.description}</div>
            </div>
          ))}
        </div>
      </Modal>
      <Modal
        visible={showRestoreModal}
        centered
        closable
        onCancel={() => setShowRestoreModal(false)}
        title={
          <span className="flex items-center gap-2">
            <IconAlertTriangle className="text-amber-400" size="extra-large" />{" "}
            {t("restore_version")}
          </span>
        }
        okText={t("continue")}
        cancelText={t("cancel")}
        onOk={() => {
          setLayout((prev) => ({ ...prev, readOnly: false }));
          setShowRestoreModal(false);
          setVersion(null);
        }}
      >
        {t("restore_warning")}
      </Modal>
    </div>
  );
}
