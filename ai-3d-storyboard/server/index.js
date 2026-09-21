import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const actions = ["idle","walk","talk","wave","jump","point"];
const cameras = ["wide","close","pan-left","pan-right","over-shoulder"];

function parseScript(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return [];
  const names = ["Robot","Boy","Girl","Alien"];
  const found = names.filter(n => new RegExp("\\b" + n + "\\b","i").test(text));
  const actor = found[0] || "Robot";
  const other = found[1] || "Boy";
  const clips = [];
  const sentences = text.split(/(?:\\.|!|\\?)+/).map(s => s.trim()).filter(Boolean);
  sentences.forEach((sentence, i) => {
    const speaker = names.find(n => new RegExp("\\b" + n + "\\b","i").test(sentence)) || (i % 2 ? other : actor);
    const movement = /wave|waves|waving/i.test(sentence) ? "wave"
      : /walk|walks|walking/i.test(sentence) ? "walk"
      : /jump|jumps|jumping/i.test(sentence) ? "jump"
      : /point|points|pointing/i.test(sentence) ? "point"
      : /talk|talks|say|says|hello|hi|speak/i.test(sentence) ? "talk" : "idle";
    const dialogue = /say|says|speak|speaks|hello|hi|asks|replies/i.test(sentence)
      ? sentence.replace(new RegExp("^" + speaker + "\\s*[:,-]?\\s*","i"), "")
      : "";
    clips.push({
      id: crypto.randomUUID(),
      name: `Scene ${i + 1}`,
      duration: Math.max(2.5, Math.min(8, 2.5 + sentence.length / 22)),
      character: speaker,
      action: movement,
      dialogue,
      camera: /close/i.test(sentence) ? "close" : /pan left/i.test(sentence) ? "pan-left" : /pan right/i.test(sentence) ? "pan-right" : "wide"
    });
  });
  if (!clips.length) clips.push({ id:crypto.randomUUID(), name:"Scene 1", duration:4, character:actor, action:"idle", dialogue:"", camera:"wide" });
  return clips;
}

app.get("/api/health", (_, res) => res.json({ ok:true, service:"ai-3d-storyboard", time:new Date().toISOString() }));
app.post("/api/parse-script", (req, res) => res.json({ clips:parseScript(req.body?.prompt) }));

app.listen(8787, () => console.log("Storyboard API listening on http://localhost:8787"));