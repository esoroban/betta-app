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
  const [showPublish, setShowPublish] = useState(false);
  const [publishVersions, setPublishVersions] = useState<any[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState("");
  const [otherLessons, setOtherLessons] = useState<{ lesson_id: string; title: Record<string, string>; scenes: string[] }[]>([]);
  // Poll editor state
  const [pollOptions, setPollOptions] = useState<string[]>([]);
  const [pollCorrect, setPollCorrect] = useState("");
  const [pollExplanation, setPollExplanation] = useState("");
  // Overlay editor state
  const [overlayOpacity, setOverlayOpacity] = useState(80);
  const [overlayFontSize, setOverlayFontSize] = useState(20);
  const [overlayColor, setOverlayColor] = useState("#ffffff");
  const [overlayBgColor, setOverlayBgColor] = useState("#0d1524");
  // Image selection state (for picking from other lessons / drafts)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [selectedImageSource, setSelectedImageSource] = useState<string>(""); // description of where image came from
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
  const canReviewRole = ["owner", "administrator"].includes(session.activeRoleMode);

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
      setEditorDraft(step ? (step.prompt?.[lang] || t(step.prompt)) : "");
    } else if (type === "poll") {
      setEditorDraft(step ? (step.prompt?.[lang] || t(step.prompt)) : "");
      // Initialize poll options from step data
      if (step?.options) {
        setPollOptions(step.options.map(o => o.text?.[lang] || t(o.text)));
      } else {
        setPollOptions(["", ""]); // Default: 2 empty options for new poll
      }
      setPollCorrect(step?.correct_answer || "");
      setPollExplanation(step?.explanation ? (step.explanation[lang] || t(step.explanation)) : "");
    } else if (type === "brief") {
      setEditorDraft(`Scene ${scene.scene_id} brief`);
    } else if (type === "overlay") {
      setEditorDraft("Overlay text");
    } else if (type === "image") {
      setEditorDraft("");
      // Load other lessons for browsing their images
      if (otherLessons.length === 0) {
        fetch("/api/lessons").then(r => r.ok ? r.json() : null).then(data => {
          if (data?.lessons) {
            setOtherLessons(
              data.lessons
                .filter((l: { lessonId: string }) => l.lessonId !== id)
                .slice(0, 10)
                .map((l: { lessonId: string; title: Record<string, string>; sceneCount?: number }) => ({
                  lesson_id: l.lessonId,
                  title: l.title || {},
                  scenes: Array.from({ length: l.sceneCount || 4 }, (_, i) => `sc${i + 1}`),
                }))
            );
          }
        });
      }
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

    const candidateType = editor === "image" ? "image"
      : editor === "poll" ? "poll"
      : editor === "overlay" ? "overlay"
      : "text";

    const originalValue = editor === "teacher"
      ? (step.step_type === "single_choice" && step.explanation ? t(step.explanation) : t(step.prompt))
      : editor === "poll" ? t(step.prompt)
      : editor === "brief" ? ""
      : editor === "overlay" ? ""
      : "";

    // Build proposedValue based on editor type
    let proposedValue: string;
    if (editor === "poll") {
      proposedValue = JSON.stringify({
        question: editorDraft,
        options: pollOptions.filter(o => o.trim()),
        correctAnswer: pollCorrect,
        explanation: pollExplanation,
      });
    } else if (editor === "overlay") {
      proposedValue = JSON.stringify({
        text: editorDraft,
        opacity: overlayOpacity,
        fontSize: overlayFontSize,
        color: overlayColor,
        backgroundColor: overlayBgColor,
      });
    } else {
      proposedValue = editorDraft;
    }

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
          proposedValue,
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

  async function handleSaveSelectedImage() {
    if (!selectedImageUrl || saving) return;
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
          proposedValue: selectedImageUrl,
          languageCode: null,
          sourceLanguage: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(`Error: ${data.error}`);
      } else {
        setSaveMsg(`Image candidate created from ${selectedImageSource} — pending review`);
        setCandidates(prev => [data.candidate, ...prev]);
        setTimeout(() => { closeEditor(); setSelectedImageUrl(null); setSelectedImageSource(""); }, 1500);
      }
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

  async function loadPublishVersions() {
    const res = await fetch(`/api/lessons/${id}/publish`);
    if (res.ok) {
      const data = await res.json();
      setPublishVersions(data.versions || []);
    }
  }

  async function handlePublish() {
    if (publishing) return;
    setPublishing(true);
    setPublishMsg("");
    try {
      const acceptedCount = candidates.filter(c => c.status === "accepted" && !c.publishVersionId).length;
      const res = await fetch(`/api/lessons/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `Publish ${acceptedCount} accepted revisions`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPublishMsg(`Error: ${data.error}`);
      } else {
        setPublishMsg(`Published version ${data.version.versionNumber} (${data.version.candidateCount} changes)`);
        await loadPublishVersions();
        // Refresh candidates
        const cRes = await fetch(`/api/candidates?lessonId=${id}`);
        if (cRes.ok) {
          const cData = await cRes.json();
          if (cData.candidates) setCandidates(cData.candidates);
        }
      }
    } catch {
      setPublishMsg("Network error");
    } finally {
      setPublishing(false);
    }
  }

  async function handleRollback(versionId: string) {
    if (publishing) return;
    setPublishing(true);
    setPublishMsg("");
    try {
      const res = await fetch(`/api/lessons/${id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback", versionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPublishMsg(`Error: ${data.error}`);
      } else {
        setPublishMsg(data.message);
        await loadPublishVersions();
      }
    } catch {
      setPublishMsg("Network error");
    } finally {
      setPublishing(false);
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
          {canReviewRole && (
            <button style={showPublish ? S.publishBtnActive : S.publishBtn}
              onClick={() => { setShowPublish(!showPublish); if (!showPublish) loadPublishVersions(); }}
              data-testid="btn-publish-panel">
              Publish
            </button>
          )}
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
      {showCandidates && (() => {
        // Show: pending + rejected (author can withdraw rejected). Hide: accepted + withdrawn.
        const actionable = candidates.filter(c => c.status === "pending" || c.status === "rejected");
        const hidden = candidates.filter(c => c.status === "accepted" || c.status === "withdrawn");
        return (
        <div style={S.candidatesPanel} data-testid="candidates-panel">
          <div style={S.candidatesPanelHead}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(240,242,245,0.5)" }}>
              Revisions ({actionable.length}){hidden.length > 0 ? ` · ${hidden.length} done` : ""}
            </span>
            <button style={S.xBtn} onClick={() => setShowCandidates(false)}>×</button>
          </div>
          {actionable.length === 0 && (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "rgba(240,242,245,0.3)" }}>
              No actionable revisions. {hidden.length > 0 ? `${hidden.length} completed — hidden.` : "Open an editor and save a draft to create one."}
            </div>
          )}
          {actionable.map((c: any) => (
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
              {c.status === "pending" && canReviewRole && (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(46,125,50,0.4)", background: "rgba(46,125,50,0.15)", color: "#66bb6a", fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                    data-testid={`approve-btn-${c.id}`}
                    onClick={async () => {
                      const res = await fetch(`/api/candidates/${c.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "approve" }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setCandidates(prev => prev.map(x => x.id === c.id ? data.candidate : x));
                      }
                    }}>Approve</button>
                  <button style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(200,40,40,0.4)", background: "rgba(200,40,40,0.15)", color: "#ef5350", fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                    data-testid={`reject-btn-${c.id}`}
                    onClick={async () => {
                      const res = await fetch(`/api/candidates/${c.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "reject", note: "Rejected by admin" }),
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setCandidates(prev => prev.map(x => x.id === c.id ? data.candidate : x));
                      }
                    }}>Reject</button>
                </div>
              )}
              {(c.status === "pending" || c.status === "rejected") && c.authorUserId === session?.user?.id && (
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
        );
      })()}

      {/* ═══ PUBLISH PANEL ═══ */}
      {showPublish && canReviewRole && (
        <div style={S.publishPanel} data-testid="publish-panel">
          <div style={S.candidatesPanelHead}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(240,242,245,0.5)" }}>
              Publish & Versions
            </span>
            <button style={S.xBtn} onClick={() => setShowPublish(false)}>x</button>
          </div>

          {/* Publish action */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {(() => {
              const unpub = candidates.filter(c => c.status === "accepted" && !c.publishVersionId);
              return (
                <>
                  <div style={{ fontSize: 12, color: "rgba(240,242,245,0.5)", marginBottom: 8 }}>
                    {unpub.length} accepted revision{unpub.length !== 1 ? "s" : ""} ready to publish
                  </div>
                  <button style={unpub.length > 0 ? S.primaryBtn : S.ghostBtn}
                    disabled={unpub.length === 0 || publishing}
                    onClick={handlePublish}
                    data-testid="btn-publish-now">
                    {publishing ? "Publishing..." : `Publish ${unpub.length} revision${unpub.length !== 1 ? "s" : ""}`}
                  </button>
                </>
              );
            })()}
            {publishMsg && (
              <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 6, background: publishMsg.startsWith("Error") ? "rgba(200,40,40,0.15)" : "rgba(46,125,50,0.15)", color: publishMsg.startsWith("Error") ? "#ef5350" : "#66bb6a", fontSize: 12 }}
                data-testid="publish-msg">{publishMsg}</div>
            )}
          </div>

          {/* Version history */}
          <div style={{ padding: "8px 0" }}>
            <div style={{ padding: "4px 16px", fontSize: 10, fontWeight: 800, color: "rgba(240,242,245,0.3)", textTransform: "uppercase" as const }}>
              Version History
            </div>
            {publishVersions.length === 0 && (
              <div style={{ padding: "8px 16px", fontSize: 12, color: "rgba(240,242,245,0.3)" }}>
                No versions published yet
              </div>
            )}
            {publishVersions.map((v: any) => (
              <div key={v.id} style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                data-testid={`version-row-${v.id}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    v{v.versionNumber}
                    {v.isActive && (
                      <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: "rgba(46,125,50,0.2)", color: "#66bb6a" }}>
                        ACTIVE
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(240,242,245,0.3)" }}>
                    {new Date(v.publishedAt).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(240,242,245,0.4)", marginTop: 2 }}>
                  {v.description || `${v.candidates?.length || 0} changes`}
                </div>
                {!v.isActive && (
                  <button style={{ marginTop: 6, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(255,152,0,0.3)", background: "rgba(255,152,0,0.1)", color: "#ff9800", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    onClick={() => handleRollback(v.id)}
                    disabled={publishing}
                    data-testid={`rollback-btn-${v.id}`}>
                    Rollback to v{v.versionNumber}
                  </button>
                )}
              </div>
            ))}
          </div>
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
                      onClick={() => {
                        setSourceLang(l);
                        // Update editorDraft with text for the selected language
                        if (step && (editor === "teacher" || editor === "poll")) {
                          const val = step.prompt?.[l] || "";
                          setEditorDraft(val);
                        }
                        // Update poll options/explanation for the selected language
                        if (step && editor === "poll") {
                          if (step.options) {
                            setPollOptions(step.options.map(o => o.text?.[l] || ""));
                          }
                          if (step.explanation) {
                            setPollExplanation(step.explanation[l] || "");
                          }
                        }
                      }}
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
                <div style={S.fieldLabel}>Current ({sourceLang.toUpperCase()})</div>
                <div style={S.oldText} data-testid="editor-current-text">{step.prompt?.[sourceLang] || t(step.prompt)}</div>
                <div style={S.fieldLabel}>New text ({sourceLang.toUpperCase()})</div>
                <textarea style={S.textarea} rows={6} value={editorDraft}
                  onChange={e => setEditorDraft(e.target.value)} data-testid="editor-textarea" />
              </div>
            )}

            {/* ── Poll Editor ── */}
            {editor === "poll" && (
              <div style={S.editorBody} data-testid="poll-editor-body">
                {step && (
                  <>
                    <div style={S.fieldLabel}>Current question ({sourceLang.toUpperCase()})</div>
                    <div style={S.oldText}>{step.prompt?.[sourceLang] || t(step.prompt)}</div>
                  </>
                )}
                <div style={S.fieldLabel}>New question</div>
                <textarea style={S.textarea} rows={3} value={editorDraft}
                  onChange={e => setEditorDraft(e.target.value)}
                  data-testid="poll-question-input"
                  placeholder="Enter the poll question..." />

                <div style={S.fieldLabel}>Options</div>
                {pollOptions.map((opt, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                    <input
                      type="radio"
                      name="pollCorrect"
                      checked={pollCorrect === `opt_${i}`}
                      onChange={() => setPollCorrect(`opt_${i}`)}
                      data-testid={`poll-correct-${i}`}
                      style={{ accentColor: "#66bb6a" }}
                    />
                    <input style={{ ...S.input, flex: 1, marginBottom: 0 }}
                      value={opt}
                      onChange={e => {
                        const next = [...pollOptions];
                        next[i] = e.target.value;
                        setPollOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                      data-testid={`poll-option-${i}`} />
                  </div>
                ))}
                <button style={S.ghostBtn}
                  onClick={() => setPollOptions([...pollOptions, ""])}
                  data-testid="poll-add-option">
                  + Add option
                </button>

                <div style={S.fieldLabel}>Explanation (shown after answer)</div>
                <textarea style={S.textarea} rows={2} value={pollExplanation}
                  onChange={e => setPollExplanation(e.target.value)}
                  data-testid="poll-explanation-input"
                  placeholder="Why this answer is correct..." />
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
              <div style={S.editorBody} data-testid="overlay-editor-body">
                <div style={S.fieldLabel}>Overlay text</div>
                <textarea style={S.textarea} rows={3} value={editorDraft}
                  onChange={e => setEditorDraft(e.target.value)}
                  data-testid="overlay-text-input"
                  placeholder="Enter overlay text..." />
                <div style={S.fieldLabel}>Position &amp; Style</div>
                <div style={S.rangeGrid}>
                  <label style={S.rangeLabel}>Opacity: {overlayOpacity}%
                    <input type="range" min="10" max="100" value={overlayOpacity}
                      onChange={e => setOverlayOpacity(Number(e.target.value))}
                      data-testid="overlay-opacity" />
                  </label>
                  <label style={S.rangeLabel}>Font size: {overlayFontSize}px
                    <input type="range" min="12" max="42" value={overlayFontSize}
                      onChange={e => setOverlayFontSize(Number(e.target.value))}
                      data-testid="overlay-fontsize" />
                  </label>
                  <label style={S.rangeLabel}>Color
                    <input type="color" value={overlayColor}
                      onChange={e => setOverlayColor(e.target.value)}
                      style={S.colorInput} data-testid="overlay-color" />
                  </label>
                  <label style={S.rangeLabel}>Background
                    <input type="color" value={overlayBgColor}
                      onChange={e => setOverlayBgColor(e.target.value)}
                      style={S.colorInput} data-testid="overlay-bgcolor" />
                  </label>
                </div>
                {/* Preview */}
                <div style={S.fieldLabel}>Preview</div>
                <div style={{
                  padding: "10px 14px", borderRadius: 8,
                  background: overlayBgColor, color: overlayColor,
                  opacity: overlayOpacity / 100, fontSize: overlayFontSize,
                  minHeight: 40, border: "1px solid rgba(255,255,255,0.12)",
                }} data-testid="overlay-preview">
                  {editorDraft || "Preview text..."}
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
                  <div style={S.fieldLabel}>This lesson&apos;s images (click to select)</div>
                  <div style={S.thumbRow} data-testid="current-lesson-images">
                    {sceneIds.slice(0, 8).map(sid => {
                      const url = `/api/assets/${id}/${id.toLowerCase()}_${sid}_bg.png`;
                      return (
                        <div key={sid} style={{
                          ...S.thumbCard,
                          backgroundImage: `url(${url})`,
                          borderColor: selectedImageUrl === url ? "#ff9800" : sid === activeSceneId ? "#4f7df9" : "transparent",
                        }}
                        onClick={() => { setSelectedImageUrl(url); setSelectedImageSource(`lesson ${id} ${sid}`); }}
                        data-testid={`select-image-${id}-${sid}`} />
                      );
                    })}
                  </div>

                  {/* Other lessons' images */}
                  <div style={S.fieldLabel}>Browse other lessons</div>
                  <div style={S.browserScroll} data-testid="other-lesson-images">
                    {otherLessons.length === 0 && (
                      <div style={{ fontSize: 11, color: "rgba(240,242,245,0.3)" }}>Loading...</div>
                    )}
                    {otherLessons.map(ol => (
                      <div key={ol.lesson_id} style={S.browserLesson} data-testid={`other-lesson-${ol.lesson_id}`}>
                        <div style={S.browserTitle}>{ol.lesson_id} — {ol.title?.en || ol.title?.ru || ""}</div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {ol.scenes.slice(0, 4).map(sid => {
                            const url = `/api/assets/${ol.lesson_id}/${ol.lesson_id.toLowerCase()}_${sid}_bg.png`;
                            return (
                              <div key={sid} style={{
                                ...S.thumbSmall,
                                width: 64,
                                backgroundImage: `url(${url})`,
                                border: selectedImageUrl === url ? "2px solid #ff9800" : "none",
                              }}
                              onClick={() => { setSelectedImageUrl(url); setSelectedImageSource(`lesson ${ol.lesson_id} ${sid}`); }}
                              data-testid={`select-image-${ol.lesson_id}-${sid}`} />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Generated draft / candidate images */}
                  {candidates.filter(c => c.candidateType === "image").length > 0 && (
                    <>
                      <div style={S.fieldLabel}>Generated drafts &amp; candidates</div>
                      <div style={S.thumbRow} data-testid="draft-candidate-images">
                        {candidates
                          .filter(c => c.candidateType === "image")
                          .slice(0, 8)
                          .map(c => {
                            const draftUrl = `/api/candidates/generate-image?file=${c.proposedValue}`;
                            return (
                              <div key={c.id} style={{
                                ...S.thumbCard,
                                position: "relative" as never,
                                backgroundImage: `url(${draftUrl})`,
                                border: selectedImageUrl === draftUrl ? "2px solid #ff9800"
                                  : c.status === "accepted" ? "2px solid #66bb6a"
                                  : c.status === "rejected" ? "2px solid #ef5350"
                                  : "2px solid rgba(255,152,0,0.4)",
                              }}
                              onClick={() => { setSelectedImageUrl(c.proposedValue); setSelectedImageSource(`draft candidate ${c.id.slice(0, 8)}`); }}
                              data-testid={`select-draft-${c.id}`}>
                                <span style={{
                                  position: "absolute" as never, top: 2, right: 2,
                                  padding: "1px 5px", borderRadius: 4, fontSize: 8, fontWeight: 700,
                                  background: c.status === "pending" ? "rgba(255,165,0,0.8)" : c.status === "accepted" ? "rgba(46,125,50,0.8)" : "rgba(200,40,40,0.8)",
                                  color: "white",
                                }}>{c.status}</span>
                              </div>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
                <div style={S.editorBody}>
                  <div style={S.fieldLabel}>Current image</div>
                  <div style={{ ...S.heroPreview, backgroundImage: `url(${bgPath})` }} />
                  {/* Save selected image from gallery */}
                  {selectedImageUrl && !generatedImage && (
                    <>
                      <div style={S.fieldLabel}>Selected: {selectedImageSource}</div>
                      <div style={{ ...S.heroPreview, backgroundImage: `url(${selectedImageUrl})`, border: "2px solid #ff9800" }}
                        data-testid="selected-image-preview" />
                      <button style={S.primaryBtn}
                        onClick={handleSaveSelectedImage}
                        disabled={saving}
                        data-testid="btn-save-selected-image">
                        {saving ? "Saving..." : "Save selected as candidate"}
                      </button>
                    </>
                  )}
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

  // Publish button
  publishBtn: { padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(46,125,50,0.3)", background: "rgba(46,125,50,0.1)", color: "#66bb6a", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" },
  publishBtnActive: { padding: "5px 12px", borderRadius: 6, border: "1px solid #66bb6a", background: "rgba(46,125,50,0.25)", color: "#66bb6a", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  publishPanel: { position: "fixed" as const, top: 0, right: 0, width: "min(400px, 100vw)", height: "100vh", background: "rgba(16,22,36,0.98)", backdropFilter: "blur(20px)", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 350, display: "flex", flexDirection: "column" as const, overflowY: "auto" as const },

  // Source language selector
  sourceLangRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", flexWrap: "wrap" as const },
  sourceLangBtns: { display: "flex", gap: 3 },
  sourceLangBtn: { padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(240,242,245,0.4)", fontSize: 10, fontWeight: 800, cursor: "pointer" },
  sourceLangActive: { padding: "3px 8px", borderRadius: 4, border: "1px solid #ff9800", background: "rgba(255,152,0,0.15)", color: "#ff9800", fontSize: 10, fontWeight: 800, cursor: "pointer" },
  sourceLangHint: { fontSize: 10, color: "rgba(240,242,245,0.25)", width: "100%" },
};
