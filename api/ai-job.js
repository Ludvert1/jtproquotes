/* ============================================================
   JTProQuotes — /api/ai-job
   Lets the app check on an AI draft that was running when the
   phone locked or the app was closed.

     { idToken, jobId }            -> that job (if it's yours)
     { idToken, quoteId }          -> latest job for that quote
     { idToken, jobId, applied }   -> mark it applied

   Reads with the server's key and hands back only the caller's own
   jobs (managers may see any), so no extra database rule is needed.
============================================================ */

const { bad, parseBody, verifyCaller, getDocAsServer, setDocAsServer, queryAsServer } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return bad(res, 405, "POST only.");
  const body = parseBody(req);
  if (!body) return bad(res, 400, "Missing or invalid request body.");
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return res.status(200).json({ job: null, note: "Job lookup isn't available." });

  const idToken = typeof body.idToken === "string" ? body.idToken : "";
  if (!idToken) return bad(res, 401, "Sign in again.");
  let caller;
  try { caller = await verifyCaller(idToken); } catch { return bad(res, 503, "Couldn't check your sign-in."); }
  if (!caller) return bad(res, 403, "Your account isn't approved.");
  const isManager = caller.role === "owner" || caller.role === "assistant";
  const mine = (j) => j && (j.uid === caller.uid || isManager);

  try {
    const jobId = typeof body.jobId === "string" && /^[\w-]{6,40}$/.test(body.jobId) ? body.jobId : "";
    if (jobId) {
      const job = await getDocAsServer("aiJobs/" + jobId);
      if (!job) return res.status(200).json({ job: null });
      if (!mine(job)) return bad(res, 403, "Not your draft.");
      if (body.applied === true) {
        await setDocAsServer("aiJobs/" + jobId, Object.assign({}, job, { applied: true, appliedAt: new Date().toISOString() }));
        return res.status(200).json({ ok: true });
      }
      return res.status(200).json({ job: Object.assign({ id: jobId }, job) });
    }
    const quoteId = typeof body.quoteId === "string" ? body.quoteId.slice(0, 60) : "";
    if (!quoteId) return bad(res, 400, "Name a job or a quote.");
    const jobs = (await queryAsServer("aiJobs", { quoteId, uid: caller.uid })).filter(mine);
    jobs.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
    return res.status(200).json({ job: jobs[0] || null });
  } catch (e) {
    console.error("[ai-job]", e.message);
    return bad(res, 502, "Couldn't check the draft just now.");
  }
};
