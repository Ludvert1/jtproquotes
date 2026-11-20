// Frozen pre-reviewer public billing response.
function publicView(co) {
  const left = co.trialEnds ? Math.max(0, Math.ceil((new Date(co.trialEnds).getTime() - Date.now()) / DAY)) : 0;
  const used = Number(co.trialQuotesUsed || 0);
  return {
    access: accessOf(co), trialDaysLeft: left,
    quotesUsed: used, quoteLimit: TRIAL_QUOTES,
    // Can a new checkout still start with free days? (not once the 7 free quotes are used)
    trialAvailable: !co.stripeSubscriptionId && left > 0 && used < TRIAL_QUOTES, referralDiscount: !!co.referredBy && !co.stripeSubscriptionId,
    plan: co.plan || "trial", billingStatus: co.billingStatus || "", trialEnds: co.trialEnds || "",
    currentPeriodEnd: co.currentPeriodEnd || "", cancelAtPeriodEnd: !!co.cancelAtPeriodEnd,
    hasCard: !!co.stripeSubscriptionId, cardCheck: co.cardCheck || "",
    offersUsed: co.retentionOffers || [],
    testMode: testMode(), enabled: stripeOn(),
    plans: Object.keys(PLANS).map((k) => ({ id: k, name: PLANS[k].name, price: PLANS[k].amount / 100, users: PLANS[k].users, blurb: PLANS[k].blurb })),
  };
}

