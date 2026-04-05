"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

interface Session {
  user: { id: string; displayName: string; baseRole: string };
  activeRoleMode: string;
}

interface Step {
  step_id: string;
  scene_id: string;
  step_type: string;
  text_audience: string;
  prompt: Record<string, string>;
  options?: { id: string; text: Record<string, string> }[];
  correct_answer?: string;
  explanation?: Record<string, string>;
}

interface Scene {
  scene_id: string;
  title: Record<string, string>;
  step_ids: string[];
}

interface LessonData {
  lesson_id: string;
  title: Record<string, string>;
  supported_langs: string[];
  scenes: Record<string, Scene>;
  steps: Step[];
  step_image_map?: Record<string, string>;
}

type EditorType = "teacher" | "poll" | "brief" | "overlay" | "image" | null;

export default function LessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<Session | null>(null);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState("en");
  const [activeSceneId, setActiveSceneId] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [sceneDrawerOpen, setSceneDrawerOpen] = useState(false);
  const [editor, setEditor] = useState<EditorType>(null);
  const [editorDraft, setEditorDraft] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [showCandidates, setShowCandidates] = useState(false);
  const [sourceLang, setSourceLang] = useState("en");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageGenerating, setImageGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{
    tempId: string; filename: string; previewUrl: string;
    originalPrompt: string; englishPrompt: string; improvedPrompt: string;
  } | null>(null);
  const [imageError, setImageError] = useState("");
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then(r => r.ok ? r.json() : null),
      fetch(`/api/lessons/${id}`).then(r => r.ok ? r.json() : null),
    ]).then(([sess, lessonData]) => {
      if (!sess || sess.error) { router.push("/login"); return; }
      setSession(sess);
      if (lessonData?.lesson) {
        const l = lessonData.lesson;
        setLesson(l);
        const sceneIds = Object.keys(l.scenes);
        if (sceneIds.length > 0) setActiveSceneId(sceneIds[0]);
      }
      // Load my candidates for this lesson
      if (sess && !sess.error) {
        fetch(`/api/candidates?lessonId=${id}`).then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.candidates) setCandidates(d.candidates); });
      }
    }).finally(() => setLoading(false));
  }, [id, router]);

  function t(obj: Record<string, string> | undefined) {
    if (!obj) return "";
    return obj[lang] || obj.en || obj.ru || "";
  }

  if (loading) return <div style={S.page}><div style={S.center}>Loading...</div></div>;
  if (!session || !lesson) return null;

  const sceneIds = Object.keys(lesson.scenes);
  const scene = lesson.scenes[activeSceneId] || lesson.scenes[sceneIds[0]];
  if (!scene) return <div style={S.page}><div style={S.center}>No scenes</div></div>;

  const sceneSteps = lesson.steps.filter(s => s.scene_id === scene.scene_id);
  const step = sceneSteps[stepIndex] || sceneSteps[0];
  const canEdit = ["owner", "administrator", "revisioner"].includes(session.activeRoleMode);

  // Resolve background: step_image_map → scene default
  function getStepBg(): string {
    if (step && lesson?.step_image_map) {
      const mapped = lesson.step_image_map[step.step_id];
      if (mapped) {
        // mapped is like "../ASSETS/1A/1a_sc2_bg_children_icecream.png"
        const match = mapped.match(/ASSETS\/(.+)/);
        if (match) return `/api/assets/${match[1]}`;
      }
    }
    return `/api/assets/${id}/${id.toLowerCase()}_${scene.scene_id}_bg.png`;
  }
  const bgPath = getStepBg();

  function goScene(sceneId: string) {
    setActiveSceneId(sceneId);
    setStepIndex(0);
    setSceneDrawerOpen(false);
  }

  const currentSceneIndex = sceneIds.indexOf(activeSceneId);
  const isLastStep = stepIndex >= sceneSteps.length - 1;
  const isLastScene = currentSceneIndex >= sceneIds.length - 1;

  function handleNext() {
    if (!isLastStep) {
      setStepIndex(stepIndex + 1);
    } else if (!isLastScene) {
      // Move to next scene
      goScene(sceneIds[currentSceneIndex + 1]);
    }
  }

  function handleBack() {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    } else if (currentSceneIndex > 0) {
      // Move to previous scene, last step
      const prevSceneId = sceneIds[currentSceneIndex - 1];
      const prevSteps = lesson?.steps.filter(s => s.scene_id === prevSceneId) ?? [];
      setActiveSceneId(prevSceneId);
      setStepIndex(Math.max(0, prevSteps.length - 1));
    }
  }

  function openEditor(type: EditorType) {
    if (!canEdit) return;
    setSaveMsg("");
    setSourceLang(lang);
    if (type === "teacher") {
      setEditorDraft(step ? t(step.prompt) : "");
    } else if (type === "poll") {
      setEditorDraft(step ? t(step.prompt) : "");
    } else if (type === "brief") {
      setEditorDraft(`Scene ${scene.scene_id} brief`);
    } else if (type === "overlay") {
      setEditorDraft("Overlay text");
    } else if (type === "image") {
      setEditorDraft("");
    }
    setEditor(type);
  }

  function closeEditor() {
    setEditor(null);
    setSaveMsg("");
  }

  async function handleSave() {
    if (!editor || !step || saving) return;
    setSaving(true);
    setSaveMsg("");

    const candidateType = editor === "image" ? "image" : "text";
    const originalValue = editor === "teacher"
      ? (step.step_type === "single_choice" && step.explanation ? t(step.explanation) : t(step.prompt))
      : editor === "poll" ? t(step.prompt)
      : editor === "brief" ? ""
      : editor === "overlay" ? ""
      : "";

    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: id,
          sceneId: scene.scene_id,
          stepId: step.step_id,
          field: editor,
          candidateType,
          originalValue,
          proposedValue: editorDraft,
          languageCode: lang,
          sourceLanguage: sourceLang,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(`Error: ${data.error}`);
        setSaving(false);
        return;
      }
      setSaveMsg("Revision created — pending review");
      setCandidates(prev => [data.candidate, ...prev]);
      setTimeout(() => closeEditor(), 1500);
    } catch {
      setSaveMsg("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateImage() {
    if (!imagePrompt.trim() || imageGenerating) return;
    setImageGenerating(true);
    setImageError("");
    setGeneratedImage(null);
    try {
      const res = await fetch("/api/candidates/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imagePrompt,
          sourceLang: lang,
          lessonId: id,
          sceneId: scene.scene_id,
          stepId: step?.step_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImageError(data.error || "Generation failed");
      } else {
        setGeneratedImage(data);
      }
    } catch {
      setImageError("Network error — try again");
    } finally {
      setImageGenerating(false);
    }
  }

  async function handleSaveImageCandidate() {
    if (!generatedImage || saving) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: id,
          sceneId: scene.scene_id,
          stepId: step?.step_id,
          field: "image",
          candidateType: "image",
          originalValue: bgPath,
          proposedValue: generatedImage.filename,
          languageCode: null,
          sourceLanguage: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(`Error: ${data.error}`);
      } else {
        setSaveMsg("Image candidate created — pending review");
        setCandidates(prev => [data.candidate, ...prev]);
        setTimeout(() => { closeEditor(); setGeneratedImage(null); }, 1500);
      }
    } catch {
      setSaveMsg("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  // Editor title map
  const editorTitles: Record<string, string> = {
    teacher: "Edit Teacher Text",
    poll: "Edit Poll / Question",
    brief: "Edit Brief",
    overlay: "Edit Overlay",
    image: "Edit Image",
  };

  const teacherText = step
    ? (step.step_type === "single_choice" && step.explanation ? t(step.explanation) : t(step.prompt))
    : "";

  return (
    <div style={S.page}>
      {/* ═══ TOPBAR ═══ */}
      <header style={S.topbar} data-testid="lesson-topbar">
        <div style={S.topLeft}>
          <button style={S.backBtn} onClick={() => router.push("/dashboard")} data-testid="lesson-back-btn">←</button>
          <button style={S.hamburger} onClick={() => setSceneDrawerOpen(true)} data-testid="lesson-hamburger">
            <span style={S.bar} /><span style={S.bar} /><span style={S.bar} />
          </button>
          <span style={S.lessonId} data-testid="lesson-id">{lesson.lesson_id}</span>
          <span style={S.sceneTitle} data-testid="lesson-scene-title">{t(scene.title)}</span>
        </div>
        <div style={S.topRight}>
          {["en", "ru", "uk"].map(l => (
            <button key={l} style={lang === l ? S.langActive : S.langBtn}
              onClick={() => setLang(l)} data-testid={`lesson-lang-${l}`}>{l.toUpperCase()}</button>
          ))}
        </div>
      </header>

      {/* ═══ ACTION STRIP ═══ */}
      {canEdit && (
        <div style={S.actionStrip} data-testid="action-strip">
          {([
            ["image", "Image"],
            ["brief", "Brief"],
            ["poll", "Poll"],
            ["overlay", "Overlay"],
            ["teacher", "Teacher Text"],
          ] as [EditorType, string][]).map(([type, label]) => (
            <button key={type} style={editor === type ? S.actionBtnActive : S.actionBtn}
              onClick={() => openEditor(type)} data-testid={`editor-btn-${type}`}>{label}</button>
          ))}
          <button style={showCandidates ? S.actionBtnActive : S.actionBtn}
            onClick={() => setShowCandidates(!showCandidates)}
            data-testid="btn-my-revisions">
            Revisions{candidates.length > 0 ? ` (${candidates.length})` : ""}
          </button>
        </div>
      )}

      {/* ═══ HERO IMAGE ═══ */}
      <div style={{ ...S.stage, backgroundImage: `url(${bgPath})` }} data-testid="lesson-stage">
        {step && step.step_type === "single_choice" && step.options && (
          <div style={S.pollWrap}>
            <div style={S.pollQ}>{t(step.prompt)}</div>
            <div style={S.pollOpts}>
              {step.options.map(o => (
                <button key={o.id} style={{
                  ...S.pollOpt,
                  ...(o.id === step.correct_answer ? S.pollOptCorrect : {}),
                }}>{t(o.text)}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ TEACHER TEXT ═══ */}
      <div style={S.teacherPanel} data-testid="teacher-panel">{teacherText}</div>

      {/* ═══ CONTROLS ═══ */}
      <div style={S.controls} data-testid="lesson-controls">
        <button style={S.ctrlBtn} disabled={stepIndex === 0 && currentSceneIndex === 0}
          onClick={handleBack} data-testid="btn-back">← Back</button>
        <span style={S.stepInfo} data-testid="step-info">
          {scene.scene_id} · Step {stepIndex + 1}/{sceneSteps.length}
          {' · '}Scene {currentSceneIndex + 1}/{sceneIds.length}
        </span>
        <button style={S.ctrlBtn} data-testid="btn-reveal">Reveal</button>
        <button style={S.ctrlBtnPrimary} disabled={isLastStep && isLastScene}
          onClick={handleNext} data-testid="btn-next">
          {isLastStep && !isLastScene ? "Next Scene →" : "Next →"}
        </button>
      </div>

      {/* ═══ CANDIDATES PANEL ═══ */}
      {showCandidates && (
        <div style={S.candidatesPanel} data-testid="candidates-panel">
          <div style={S.candidatesPanelHead}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(240,242,245,0.5)" }}>
              My Revisions ({candidates.length})
            </span>
            <button style={S.xBtn} onClick={() => setShowCandidates(false)}>×</button>
          </div>
          {candidates.length === 0 && (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "rgba(240,242,245,0.3)" }}>
              No revisions yet. Open an editor and save a draft to create one.
            </div>
          )}
          {candidates.map((c: any) => (
            <div key={c.id} style={S.candidateRow} data-testid={`candidate-row-${c.id}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{c.field}</span>
                <span style={{
                  ...S.statusBadge,
                  background: c.status === "pending" ? "rgba(255,165,0,0.15)" : c.status === "accepted" ? "rgba(46,125,50,0.15)" : c.status === "rejected" ? "rgba(200,40,40,0.15)" : "rgba(120,120,120,0.15)",
                  color: c.status === "pending" ? "#ffa500" : c.status === "accepted" ? "#66bb6a" : c.status === "rejected" ? "#ef5350" : "#888",
                }} data-testid={`candidate-status-${c.id}`}>{c.status}</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(240,242,245,0.4)", marginTop: 2 }}>
                {c.candidateType} · {c.sceneId || "—"} · {new Date(c.createdAt).toLocaleString()}
                {c.sourceLanguage && <> · src: <strong>{c.sourceLanguage.toUpperCase()}</strong></>}
              </div>
              {c.candidateType === "image" && (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "rgba(240,242,245,0.3)", marginBottom: 2 }}>OLD</div>
                    <div style={{ height: 48, borderRadius: 6, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#1a2030", backgroundImage: c.originalValue ? `url(${c.originalValue})` : "none" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "rgba(240,242,245,0.3)", marginBottom: 2 }}>NEW</div>
                    <div style={{ height: 48, borderRadius: 6, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#1a2030", backgroundImage: `url(/api/candidates/generate-image?file=${c.proposedValue})` }} />
                  </div>
                </div>
              )}
              {c.status === "accepted" && c.translatedValues && (
                <div style={{ fontSize: 11, marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                  {Object.entries(c.translatedValues as Record<string, any>)
                    .filter(([k]) => k !== "_error")
                    .map(([langCode, val]: [string, any]) => (
                      <span key={langCode} style={{
                        padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: val?.success ? "rgba(46,125,50,0.2)" : "rgba(200,40,40,0.2)",
                        color: val?.success ? "#66bb6a" : "#ef5350",
                      }} title={val?.text || val?.error || ""}>
                        {langCode.toUpperCase()} {val?.success ? "\u2713" : "\u2717"}
                      </span>
                    ))}
                </div>
              )}
              {c.reviewNote && (
                <div style={{ fontSize: 11, color: "#ef5350", marginTop: 4 }}>
                  Note: {c.reviewNote}
                </div>
              )}
              {(c.status === "pending" || c.status === "rejected") && (
                <button style={{ marginTop: 6, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(240,242,245,0.5)", fontSize: 11, cursor: "pointer" }}
                  data-testid={`withdraw-btn-${c.id}`}
                  onClick={async () => {
                    const res = await fetch(`/api/candidates/${c.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "withdraw" }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setCandidates(prev => prev.map(x => x.id === c.id ? data.candidate : x));
                    }
                  }}>Withdraw</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ SCENE DRAWER ═══ */}
      {sceneDrawerOpen && (
        <>
          <div style={S.backdrop} onClick={() => setSceneDrawerOpen(false)} />
          <div style={S.sceneDrawer} data-testid="scene-drawer">
            <div style={S.drawerHead}>
              <h2 style={{ margin: 0, fontSize: 14 }}>Scenes</h2>
              <button style={S.xBtn} onClick={() => setSceneDrawerOpen(false)}>×</button>
            </div>
            {sceneIds.map(sid => {
              const sc = lesson.scenes[sid];
              return (
                <button key={sid} style={sid === activeSceneId ? S.sceneActive : S.sceneRow}
                  onClick={() => goScene(sid)}>
                  <div style={S.sceneRowTitle}>{t(sc.title)}</div>
                  <div style={S.sceneRowMeta}>{sc.step_ids.length} steps · {sid}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ═══ EDITOR DRAWER ═══ */}
      {editor && (
        <>
          <div style={S.backdrop} onClick={closeEditor} />
          <div style={editor === "image" ? S.editorWide : S.editorDrawer} data-testid={`editor-drawer-${editor}`}>
            <div style={S.drawerHead}>
              <div>
                <div style={S.eyebrow}>Edit Mode · {session.activeRoleMode}</div>
                <h2 style={{ margin: 0, fontSize: 16 }}>{editorTitles[editor] || "Edit"}</h2>
              </div>
              <button style={S.xBtn} onClick={closeEditor}>×</button>
            </div>

            {/* ── Source Language Selector ── */}
            {(editor === "teacher" || editor === "poll" || editor === "brief" || editor === "overlay") && (
              <div style={S.sourceLangRow} data-testid="source-lang-selector">
                <span style={S.fieldLabel}>Source of truth language</span>
                <div style={S.sourceLangBtns}>
                  {["en", "ru", "uk"].map(l => (
                    <button key={l}
                      style={sourceLang === l ? S.sourceLangActive : S.sourceLangBtn}
                      onClick={() => setSourceLang(l)}
                      data-testid={`source-lang-${l}`}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
                <span style={S.sourceLangHint}>
                  On approve, this text will be translated to all other languages
                </span>
              </div>
            )}

            {/* ── Teacher Text Editor ── */}
            {editor === "teacher" && step && (
              <div style={S.editorBody}>
                <div style={S.fieldLabel}>Current</div>
                <div style={S.oldText}>{t(step.prompt)}</div>
                <div style={S.fieldLabel}>New text ({sourceLang.toUpperCase()})</div>
                <textarea style={S.textarea} rows={6} value={editorDraft}
                  onChange={e => setEditorDraft(e.target.value)} data-testid="editor-textarea" />
              </div>
            )}

            {/* ── Poll Editor ── */}
            {editor === "poll" && step && (
              <div style={S.editorBody}>
                <div style={S.fieldLabel}>Current question</div>
                <div style={S.oldText}>{t(step.prompt)}</div>
                <div style={S.fieldLabel}>New question</div>
                <textarea style={S.textarea} rows={4} value={editorDraft}
                  onChange={e => setEditorDraft(e.target.value)} />
                {step.options && (
                  <>
                    <div style={S.fieldLabel}>Options</div>
                    {step.options.map((o, i) => (
                      <input key={o.id} style={S.input} defaultValue={t(o.text)}
                        placeholder={`Option ${i + 1}`} />
                    ))}
                  </>
                )}
                {step.explanation && (
                  <>
                    <div style={S.fieldLabel}>Explanation</div>
                    <textarea style={S.textarea} rows={3} defaultValue={t(step.explanation)} />
                  </>
                )}
              </div>
            )}

            {/* ── Brief Editor ── */}
            {editor === "brief" && (
              <div style={S.editorBody}>
                <div style={S.fieldLabel}>Scene brief for {scene.scene_id}</div>
                <textarea style={S.textarea} rows={6} value={editorDraft}
                  onChange={e => setEditorDraft(e.target.value)}
                  placeholder="Describe the scene purpose, visual direction, overlay needs..." />
              </div>
            )}

            {/* ── Overlay Editor ── */}
            {editor === "overlay" && (
              <div style={S.editorBody}>
                <div style={S.fieldLabel}>Overlay text</div>
                <textarea style={S.textarea} rows={3} value={editorDraft}
                  onChange={e => setEditorDraft(e.target.value)} />
                <div style={S.fieldLabel}>Position &amp; Style</div>
                <div style={S.rangeGrid}>
                  <label style={S.rangeLabel}>Opacity <input type="range" min="10" max="100" defaultValue="80" /></label>
                  <label style={S.rangeLabel}>Font size <input type="range" min="12" max="42" defaultValue="20" /></label>
                  <label style={S.rangeLabel}>Color <input type="color" defaultValue="#ffffff" style={S.colorInput} /></label>
                  <label style={S.rangeLabel}>Background <input type="color" defaultValue="#0d1524" style={S.colorInput} /></label>
                </div>
              </div>
            )}

            {/* ── Image Editor ── */}
            {editor === "image" && (
              <div style={S.imageEditorGrid}>
                <div style={S.editorBody}>
                  <div style={S.fieldLabel}>1. Describe the image (any language)</div>
                  <textarea style={S.textarea} rows={3} value={imagePrompt}
                    onChange={e => setImagePrompt(e.target.value)}
                    placeholder="Describe the image you need..."
                    data-testid="image-prompt-input" />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button style={S.primaryBtn}
                      onClick={handleGenerateImage}
                      disabled={imageGenerating || !imagePrompt.trim()}
                      data-testid="btn-generate-image">
                      {imageGenerating ? "Generating..." : "Translate & Generate"}
                    </button>
                    {generatedImage && (
                      <button style={S.ghostBtn}
                        onClick={handleGenerateImage}
                        disabled={imageGenerating}
                        data-testid="btn-regenerate-image">
                        Regenerate
                      </button>
                    )}
                  </div>
                  {imageError && (
                    <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(200,40,40,0.15)", border: "1px solid rgba(200,40,40,0.3)", color: "#ef5350", fontSize: 12 }}
                      data-testid="image-error">{imageError}</div>
                  )}
                  {generatedImage && (
                    <div style={S.editorBody} data-testid="image-generation-result">
                      <div style={S.fieldLabel}>Prompt pipeline</div>
                      <div style={{ fontSize: 11, color: "rgba(240,242,245,0.4)", lineHeight: 1.5 }}>
                        <div><strong>Original:</strong> {generatedImage.originalPrompt}</div>
                        <div><strong>English:</strong> {generatedImage.englishPrompt}</div>
                        <div><strong>Improved:</strong> {generatedImage.improvedPrompt}</div>
                      </div>
                    </div>
                  )}
                  <div style={S.fieldLabel}>This lesson&apos;s images</div>
                  <div style={S.thumbRow}>
                    {sceneIds.slice(0, 8).map(sid => (
                      <div key={sid} style={{
                        ...S.thumbCard,
                        backgroundImage: `url(/api/assets/${id}/${id.toLowerCase()}_${sid}_bg.png)`,
                        ...(sid === activeSceneId ? { borderColor: "#4f7df9" } : {}),
                      }} />
                    ))}
                  </div>
                </div>
                <div style={S.editorBody}>
                  <div style={S.fieldLabel}>Current image</div>
                  <div style={{ ...S.heroPreview, backgroundImage: `url(${bgPath})` }} />
                  {generatedImage && (
                    <>
                      <div style={S.fieldLabel}>Generated preview</div>
                      <div style={{ ...S.heroPreview, backgroundImage: `url(${generatedImage.previewUrl})` }}
                        data-testid="generated-image-preview" />
                      <button style={S.primaryBtn}
                        onClick={handleSaveImageCandidate}
                        disabled={saving}
                        data-testid="btn-save-image-candidate">
                        {saving ? "Saving..." : "Save as candidate"}
                      </button>
                    </>
                  )}
                  <div style={S.fieldLabel}>Image candidates</div>
                  <div style={S.candidateGrid}>
                    {candidates
                      .filter(c => c.candidateType === "image" && c.sceneId === scene.scene_id)
                      .slice(0, 4)
                      .map(c => (
                        <div key={c.id} style={{
                          ...S.thumbCard,
                          backgroundImage: `url(/api/candidates/generate-image?file=${c.proposedValue})`,
                          border: c.status === "accepted" ? "2px solid #66bb6a" : c.status === "rejected" ? "2px solid #ef5350" : "2px solid rgba(255,255,255,0.12)",
                        }}>
                          <span style={{
                            ...S.statusBadge,
                            position: "absolute" as never, top: 2, right: 2,
                            background: c.status === "pending" ? "rgba(255,165,0,0.8)" : c.status === "accepted" ? "rgba(46,125,50,0.8)" : "rgba(200,40,40,0.8)",
                            color: "white",
                          }}>{c.status}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Save / Cancel ── */}
            {saveMsg && <div style={S.saveMsg} data-testid="save-msg">{saveMsg}</div>}
            <div style={S.editorActions}>
              <button style={S.ghostBtn} onClick={() => { closeEditor(); setGeneratedImage(null); setImageError(""); }} data-testid="editor-cancel">Cancel</button>
              {editor !== "image" && (
                <button style={S.primaryBtn} onClick={handleSave} disabled={saving} data-testid="editor-save">
                  {saving ? "Saving..." : "Save draft"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════ STYLES ═══════════ */

const S: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", height: "100vh", background: "#0a0e16", fontFamily: "Inter, system-ui, sans-serif", color: "#f0f2f5", overflow: "hidden" },
  center: { display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#667" },

  topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", height: 48, background: "rgba(15,20,30,0.85)", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 },
  topLeft: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  topRight: { display: "flex", gap: 3, flexShrink: 0 },
  backBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(240,242,245,0.6)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  hamburger: { display: "flex", flexDirection: "column" as const, gap: 3, width: 30, height: 30, padding: 7, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, background: "transparent", cursor: "pointer", justifyContent: "center" },
  bar: { display: "block", width: "100%", height: 2, background: "#f0f2f5", borderRadius: 1 },
  lessonId: { fontSize: 13, fontWeight: 800, color: "#4f7df9", flexShrink: 0 },
  sceneTitle: { fontSize: 13, fontWeight: 500, color: "rgba(240,242,245,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  langBtn: { padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(240,242,245,0.4)", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  langActive: { padding: "4px 8px", borderRadius: 6, border: "1px solid #4f7df9", background: "#4f7df9", color: "white", fontSize: 11, fontWeight: 800, cursor: "pointer" },

  actionStrip: { display: "flex", gap: 4, padding: "6px 16px", background: "rgba(15,20,30,0.7)", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 },
  actionBtn: { padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(240,242,245,0.6)", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" },
  actionBtnActive: { padding: "5px 12px", borderRadius: 6, border: "1px solid #4f7df9", background: "rgba(79,125,249,0.15)", color: "#4f7df9", fontSize: 12, fontWeight: 700, cursor: "pointer" },

  stage: { flex: 1, position: "relative" as const, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#1a2030", minHeight: 0 },

  pollWrap: { position: "absolute" as const, left: 16, right: 16, bottom: 16, display: "flex", flexDirection: "column" as const, gap: 8, zIndex: 2 },
  pollQ: { padding: "10px 14px", borderRadius: 12, background: "rgba(10,14,22,0.75)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 15, lineHeight: 1.4, color: "white" },
  pollOpts: { display: "flex", gap: 8, flexWrap: "wrap" as const },
  pollOpt: { padding: "8px 16px", borderRadius: 999, background: "rgba(10,14,22,0.75)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  pollOptCorrect: { background: "rgba(46,125,50,0.5)", borderColor: "rgba(102,187,106,0.6)" },

  teacherPanel: { padding: "12px 20px", height: 120, overflowY: "auto" as const, background: "rgba(15,20,30,0.85)", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 14, lineHeight: 1.6, flexShrink: 0 },

  controls: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 48, background: "rgba(15,20,30,0.85)", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 },
  ctrlBtn: { padding: "6px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#f0f2f5", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  ctrlBtnPrimary: { padding: "6px 14px", borderRadius: 6, border: "none", background: "#4f7df9", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  stepInfo: { fontSize: 12, fontWeight: 700, color: "rgba(240,242,245,0.4)" },

  // Scene drawer
  backdrop: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 399 },
  sceneDrawer: { position: "fixed" as const, top: 0, left: 0, width: 280, height: "100vh", background: "rgba(15,20,30,0.96)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(255,255,255,0.08)", zIndex: 400, overflowY: "auto" as const },
  drawerHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  xBtn: { width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#f0f2f5", fontSize: 18, cursor: "pointer", display: "grid", placeItems: "center" },
  sceneRow: { display: "flex", flexDirection: "column" as const, gap: 2, width: "100%", padding: "10px 16px", border: "none", borderLeft: "3px solid transparent", background: "transparent", color: "#f0f2f5", textAlign: "left" as const, cursor: "pointer" },
  sceneActive: { display: "flex", flexDirection: "column" as const, gap: 2, width: "100%", padding: "10px 16px", border: "none", borderLeft: "3px solid #4f7df9", background: "rgba(79,125,249,0.1)", color: "#f0f2f5", textAlign: "left" as const, cursor: "pointer" },
  sceneRowTitle: { fontSize: 12, fontWeight: 700, lineHeight: 1.3 },
  sceneRowMeta: { fontSize: 11, color: "rgba(240,242,245,0.4)" },

  // Editor drawer
  editorDrawer: { position: "fixed" as const, top: 0, right: 0, width: "min(480px, 100vw)", height: "100vh", background: "rgba(16,22,36,0.98)", backdropFilter: "blur(20px)", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 400, display: "flex", flexDirection: "column" as const, padding: 20, gap: 16, overflowY: "auto" as const },
  editorWide: { position: "fixed" as const, top: 0, right: 0, width: "min(960px, 96vw)", height: "100vh", background: "rgba(16,22,36,0.98)", backdropFilter: "blur(20px)", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 400, display: "flex", flexDirection: "column" as const, padding: 20, gap: 16, overflowY: "auto" as const },
  eyebrow: { fontSize: 10, fontWeight: 800, color: "#4f7df9", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 2 },
  editorBody: { display: "flex", flexDirection: "column" as const, gap: 10 },
  fieldLabel: { fontSize: 10, fontWeight: 800, color: "rgba(240,242,245,0.35)", textTransform: "uppercase" as const, letterSpacing: "0.06em" },
  oldText: { padding: "10px 12px", borderRadius: 8, background: "rgba(200,60,40,0.12)", border: "1px solid rgba(200,60,40,0.25)", color: "rgba(255,160,140,0.85)", textDecoration: "line-through", fontSize: 13, lineHeight: 1.5 },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#f0f2f5", fontSize: 13, resize: "vertical" as const, minHeight: 70, outline: "none", fontFamily: "inherit" },
  input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#f0f2f5", fontSize: 13, outline: "none", marginBottom: 4 },
  rangeGrid: { display: "grid", gap: 8 },
  rangeLabel: { display: "grid", gap: 4, fontSize: 12, color: "rgba(240,242,245,0.4)" },
  colorInput: { width: "100%", height: 32, borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", padding: 2 },
  editorActions: { display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 8 },
  ghostBtn: { padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#f0f2f5", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  primaryBtn: { padding: "8px 14px", borderRadius: 8, border: "none", background: "#4f7df9", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  saveMsg: { padding: "8px 12px", borderRadius: 8, background: "rgba(46,125,50,0.2)", border: "1px solid rgba(102,187,106,0.3)", color: "#66bb6a", fontSize: 13 },

  // Image editor
  imageEditorGrid: { display: "grid", gridTemplateColumns: "1.4fr 0.6fr", gap: 20 },
  thumbRow: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 6 },
  thumbCard: { height: 56, borderRadius: 8, backgroundSize: "cover", backgroundPosition: "center", border: "2px solid transparent", cursor: "pointer" },
  thumbSmall: { height: 48, borderRadius: 6, backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer" },
  browserScroll: { maxHeight: 240, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const, gap: 8 },
  browserLesson: { padding: 8, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" },
  browserTitle: { fontSize: 11, fontWeight: 800, color: "rgba(240,242,245,0.4)", marginBottom: 6 },
  heroPreview: { height: 180, borderRadius: 10, backgroundSize: "cover", backgroundPosition: "center" },
  candidateGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 },

  // Candidates panel
  candidatesPanel: { position: "fixed" as const, top: 0, right: 0, width: "min(400px, 100vw)", height: "100vh", background: "rgba(16,22,36,0.98)", backdropFilter: "blur(20px)", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 350, display: "flex", flexDirection: "column" as const, overflowY: "auto" as const },
  candidatesPanelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  candidateRow: { padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" },
  statusBadge: { padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700 },

  // Source language selector
  sourceLangRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", flexWrap: "wrap" as const },
  sourceLangBtns: { display: "flex", gap: 3 },
  sourceLangBtn: { padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(240,242,245,0.4)", fontSize: 10, fontWeight: 800, cursor: "pointer" },
  sourceLangActive: { padding: "3px 8px", borderRadius: 4, border: "1px solid #ff9800", background: "rgba(255,152,0,0.15)", color: "#ff9800", fontSize: 10, fontWeight: 800, cursor: "pointer" },
  sourceLangHint: { fontSize: 10, color: "rgba(240,242,245,0.25)", width: "100%" },
};
